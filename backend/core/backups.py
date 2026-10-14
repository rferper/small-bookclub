"""Operator-only, consistent SQLite/media archives and fresh-location recovery."""

import hashlib
import json
import os
import re
import sqlite3
import stat
import tempfile
import uuid
import zipfile
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

FORMAT = "small-bookclub-backup-v1"
NAME = re.compile(r"bookclub-backup-\d{8}T\d{12}Z-[0-9a-f]{32}\.zip")
MEMBER = re.compile(
    r"(?:database\.sqlite3|runtime\.json|media/(?:avatars|covers)/[0-9a-f]{32}\.webp)"
)
MAX_TOTAL = 2 * 1024**3


def digest(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def plain_path(path):
    """Reject symbolic components, including a symlinked parent directory."""
    path = Path(path).absolute()
    if any(part.is_symlink() or part.is_junction() for part in [path, *path.parents]):
        raise ValueError("Symbolic paths are not supported")
    return path.resolve()


def check_database(path):
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as database:
        if database.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise ValueError("Invalid SQLite snapshot")
        if database.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Invalid SQLite references")


def media_files(root, snapshot):
    files = {}
    if root.exists():
        for file in root.rglob("*"):
            plain_path(file)
            if file.is_dir():
                continue
            relative = "media/" + file.relative_to(root).as_posix()
            if not MEMBER.fullmatch(relative) or not stat.S_ISREG(file.stat().st_mode):
                raise ValueError("Unexpected private media entry")
            files[relative] = file
    # A missing referenced native upload must not silently produce a broken restore.
    with closing(sqlite3.connect(snapshot)) as database:
        for table, column, area in [
            ("users_user", "avatar_path", "avatars"),
            ("books_book", "cover_path", "covers"),
        ]:
            for (pointer,) in database.execute(f"SELECT {column} FROM {table}"):
                if not pointer:
                    continue
                match = re.fullmatch(rf"/api/media/{area}/([0-9a-f]{{32}})", pointer)
                if not match:
                    raise ValueError("Unexpected stored media pointer")
                if f"media/{area}/{match[1]}.webp" not in files:
                    raise ValueError("Missing referenced upload")
    return files


def manifest(archive):
    names = archive.namelist()
    if len(names) != len(set(names)) or "manifest.json" not in names:
        raise ValueError("Duplicate or missing manifest")
    info = archive.getinfo("manifest.json")
    if info.file_size > 1024 * 1024:
        raise ValueError("Oversized manifest")
    if any(
        stat.S_IFMT(entry.external_attr >> 16) not in {0, stat.S_IFREG}
        or entry.flag_bits & 1
        or entry.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}
        for entry in archive.infolist()
    ):
        raise ValueError("Non-regular or encrypted archive member")
    data = json.loads(archive.read(info))
    if not isinstance(data, dict) or data.get("format") != FORMAT:
        raise ValueError("Unsupported archive")
    files = data.get("files")
    if (
        not isinstance(files, dict)
        or not {"database.sqlite3", "runtime.json"} <= files.keys()
    ):
        raise ValueError("Incomplete archive")
    if set(names) != {"manifest.json", *files}:
        raise ValueError("Unexpected archive member")
    total = 0
    for name, metadata in files.items():
        if not MEMBER.fullmatch(name) or not isinstance(metadata, dict):
            raise ValueError("Unsafe archive member")
        size, sha = metadata.get("size"), metadata.get("sha256")
        entry = archive.getinfo(name)
        if (
            type(size) is not int
            or size < 0
            or size != entry.file_size
            or not isinstance(sha, str)
            or not re.fullmatch(r"[0-9a-f]{64}", sha)
            or stat.S_ISLNK(entry.external_attr >> 16)
            or entry.flag_bits & 1
        ):
            raise ValueError("Invalid archive metadata")
        total += size
    if total > MAX_TOTAL:
        raise ValueError("Oversized archive")
    return data


def rotate(destination, keep, newest):
    candidates = []
    for file in destination.iterdir():
        if not NAME.fullmatch(file.name) or file.is_symlink() or not file.is_file():
            continue
        try:
            with zipfile.ZipFile(file) as archive:
                manifest(archive)
        except (ValueError, KeyError, zipfile.BadZipFile):
            continue
        candidates.append(file)
    # A corrected system clock must never make this run delete its new snapshot.
    ordered = [
        newest,
        *sorted((file for file in candidates if file != newest), reverse=True),
    ]
    for file in ordered[keep:]:
        # Only direct, recognized archives inside the checked destination are removed.
        if plain_path(file).parent != destination:
            raise ValueError("Unsafe rotation target")
        file.unlink()


def create_backup(database, media_root, destination, keep, runtime):
    if type(keep) is not int or not 1 <= keep <= 30:
        raise ValueError("Retention must be between 1 and 30")
    database, media_root, destination = map(
        plain_path, (database, media_root, destination)
    )
    if (
        not database.is_file()
        or destination == media_root
        or destination.is_relative_to(media_root)
    ):
        raise ValueError("Invalid backup destination/source")
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    now = datetime.now(UTC)
    filename = f"bookclub-backup-{now:%Y%m%dT%H%M%S%fZ}-{uuid.uuid4().hex}.zip"
    final = destination / filename
    # A distinct writer connection freezes commits. The backup's reader connection
    # must not itself have a write transaction (SQLite would report SQLITE_LOCKED).
    with closing(
        sqlite3.connect(database.as_uri() + "?mode=rw", uri=True, timeout=5)
    ) as lock:
        lock.execute("BEGIN IMMEDIATE")
        try:
            with tempfile.TemporaryDirectory(
                prefix=".bookclub-backup-", dir=destination
            ) as temporary:
                workspace = Path(temporary)
                snapshot = workspace / "database.sqlite3"
                with closing(
                    sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)
                ) as source:
                    with closing(sqlite3.connect(snapshot)) as target:
                        source.backup(target)
                check_database(snapshot)
                files = {
                    "database.sqlite3": snapshot,
                    **media_files(media_root, snapshot),
                }
                configuration = workspace / "runtime.json"
                configuration.write_text(json.dumps(runtime), encoding="utf-8")
                files["runtime.json"] = configuration
                metadata = {
                    name: {"size": file.stat().st_size, "sha256": digest(file)}
                    for name, file in files.items()
                }
                if sum(entry["size"] for entry in metadata.values()) > MAX_TOTAL:
                    raise ValueError("Oversized backup")
                output = workspace / "archive.zip"
                with zipfile.ZipFile(
                    output, "w", compression=zipfile.ZIP_DEFLATED
                ) as archive:
                    for name, file in files.items():
                        archive.write(file, name)
                    archive.writestr(
                        "manifest.json",
                        json.dumps(
                            {
                                "format": FORMAT,
                                "createdAt": now.isoformat(),
                                "files": metadata,
                            }
                        ),
                    )
                os.chmod(output, 0o600)
                with output.open("r+b") as stream:
                    os.fsync(stream.fileno())
                if final.exists():
                    raise FileExistsError("Archive already exists")
                os.replace(output, final)
                if os.name == "posix":
                    descriptor = os.open(destination, os.O_RDONLY | os.O_DIRECTORY)
                    try:
                        os.fsync(descriptor)
                    finally:
                        os.close(descriptor)
                rotate(destination, keep, final)
        finally:
            lock.rollback()
    return final


def restore_backup(source, destination):
    source, destination = map(plain_path, (source, destination))
    if destination.exists():
        raise ValueError("Restore destination must be new")
    # Validate everything before creating the destination; never use extractall.
    with zipfile.ZipFile(source) as archive:
        data = manifest(archive)
        destination.mkdir(parents=True, mode=0o700)
        created = []
        directories = {destination}
        try:
            for name, metadata in data["files"].items():
                output = destination / name
                if not output.parent.exists():
                    directories.update([output.parent, output.parent.parent])
                output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with archive.open(name) as incoming, output.open("xb") as outgoing:
                    created.append(output)
                    sha = hashlib.sha256()
                    while chunk := incoming.read(1024 * 1024):
                        sha.update(chunk)
                        outgoing.write(chunk)
                os.chmod(output, 0o600)
                if sha.hexdigest() != metadata["sha256"]:
                    raise ValueError("Archive integrity mismatch")
            check_database(destination / "database.sqlite3")
        except Exception:
            # Only remove files created by this invocation, without recursive deletion.
            for file in reversed(created):
                if not plain_path(file).is_relative_to(destination):
                    raise ValueError("Unsafe cleanup target")
                file.unlink()
            for directory in sorted(
                directories, key=lambda path: len(path.parts), reverse=True
            ):
                if directory != destination and not directory.is_relative_to(
                    destination
                ):
                    continue
                directory.rmdir()
            raise
    return destination
