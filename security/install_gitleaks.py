"""Install only the pinned official CLI binary, checking its committed checksum."""

import argparse
import hashlib
import io
import platform
import tarfile
import urllib.request
import zipfile
from pathlib import Path

VERSION = "8.30.1"
ASSETS = {
    "Windows": (
        "windows_x64.zip",
        "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e",
        "gitleaks.exe",
    ),
    "Linux": (
        "linux_x64.tar.gz",
        "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
        "gitleaks",
    ),
}


def install(destination):
    if platform.machine().lower() not in {"amd64", "x86_64"}:
        raise ValueError("Unsupported architecture")
    asset, checksum, filename = ASSETS[platform.system()]
    url = f"https://github.com/gitleaks/gitleaks/releases/download/v{VERSION}/gitleaks_{VERSION}_{asset}"
    with urllib.request.urlopen(url, timeout=60) as response:
        archive = response.read(32 * 1024 * 1024 + 1)
    if (
        len(archive) > 32 * 1024 * 1024
        or hashlib.sha256(archive).hexdigest() != checksum
    ):
        raise ValueError("Invalid tool archive")
    if asset.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(archive)) as package:
            binary = package.read(filename)
    else:
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as package:
            member = package.getmember(filename)
            if not member.isfile() or member.size > 32 * 1024 * 1024:
                raise ValueError("Invalid tool member")
            binary = package.extractfile(member).read()
    target = Path(destination).resolve() / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(binary)
    target.chmod(0o755)
    print(f"Installed checksum-verified Gitleaks {VERSION}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()
    try:
        install(args.destination)
    except Exception:
        raise SystemExit(
            "Pinned Gitleaks installation failed; details suppressed"
        ) from None
