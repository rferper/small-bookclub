import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { areasFor, isCommit } from "./guard-commit-checks.mjs";
import { findProblems, isFixturePath } from "./guard-fixtures.mjs";
import { checkCommand } from "./guard-git.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const runHook = (script, event) =>
  spawnSync(process.execPath, [join(here, script)], { input: JSON.stringify(event), encoding: "utf8" });

test("guard-git blocks direct pushes to main and force pushes", () => {
  assert.match(checkCommand("git push origin main"), /pull request/);
  assert.match(checkCommand("git push origin HEAD:main"), /pull request/);
  assert.match(checkCommand("npm test && git push origin refs/heads/master"), /pull request/);
  assert.match(checkCommand("git push --force origin issue-1"), /force/);
  assert.match(checkCommand("git push -f"), /force/);
  assert.match(checkCommand("git push origin --delete issue-1"), /force or delete/);
});

test("guard-git allows ordinary branch work", () => {
  for (const command of [
    "git push -u origin issue-88-agent-hooks",
    "git push",
    "git commit -m 'Add hooks'",
    'git commit -m "tidy -n flag docs"',
    "git status && git diff",
    "gh pr merge 5 --merge",
  ]) {
    assert.equal(checkCommand(command), null, command);
  }
});

test("guard-git blocks skipped verification, hard reset, clean", () => {
  assert.match(checkCommand("git commit --no-verify -m x"), /verification/);
  assert.match(checkCommand("git commit -n -m x"), /verification/);
  assert.match(checkCommand("git reset --hard HEAD~1"), /discards/);
  assert.match(checkCommand("git clean -fd"), /untracked/);
});

test("guard-git blocks committing secrets, databases and media", () => {
  assert.match(checkCommand("git commit -m x", () => ["backend/db.sqlite3"]), /secrets/);
  assert.match(checkCommand("git commit -m x", () => ["backend/.env"]), /secrets/);
  assert.match(checkCommand("git commit -m x", () => ["backend/media/avatar.png"]), /secrets/);
  assert.equal(checkCommand("git commit -m x", () => ["README.md", "backend/core/images.py"]), null);
  assert.equal(checkCommand("git add -A", () => ["backend/.env"]), null);
});

test("guard-fixtures recognises fixture paths", () => {
  for (const path of ["backend/tests/unit/test_x.py", "frontend/src/a.test.tsx", "deploy/demo/seed.json", "backend/conftest.py"]) {
    assert.ok(isFixturePath(path), path);
  }
  for (const path of ["backend/core/images.py", "README.md", "frontend/src/App.tsx"]) {
    assert.ok(!isFixturePath(path), path);
  }
});

test("guard-fixtures flags real-looking emails and tokens only", () => {
  assert.deepEqual(findProblems("ana@example.com bea@club.test c@x.localhost"), []);
  assert.equal(findProblems("raquel@gmail.com").length, 1);
  assert.equal(findProblems("x = 'ghp_" + "a".repeat(36) + "'").length, 1);
  assert.equal(findProblems("-----BEGIN RSA PRIVATE KEY-----").length, 1);
  assert.equal(findProblems("https://discord.com/api/webhooks/123456789/abcDEF_ghi").length, 1);
});

test("guard-fixtures leaves existing repository fixtures alone", () => {
  const root = join(here, "..");
  const flagged = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".venv", ".git", "dist"].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(py|tsx?|json)$/.test(entry.name) && isFixturePath(full.replace(root, ""))) {
        if (findProblems(readFileSync(full, "utf8")).length) flagged.push(full.replace(root, ""));
      }
    }
  };
  walk(join(root, "backend", "tests"));
  walk(join(root, "frontend", "src"));
  assert.deepEqual(flagged, []);
});

test("guard-commit-checks picks areas and detects commits", () => {
  assert.deepEqual(areasFor(["backend/a.py", "README.md"]), { backend: true, frontend: false });
  assert.deepEqual(areasFor(["frontend/src/a.tsx"]), { backend: false, frontend: true });
  assert.deepEqual(areasFor(["docs/x.md"]), { backend: false, frontend: false });
  assert.ok(isCommit("git add . && git commit -m x"));
  assert.ok(!isCommit("git status"));
});

test("hooks speak the exit-code protocol end to end", () => {
  const blocked = runHook("guard-git.mjs", { tool_name: "Bash", tool_input: { command: "git push origin main" } });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /BLOCKED by agent-hooks/);
  assert.equal(runHook("guard-git.mjs", { tool_name: "Bash", tool_input: { command: "git status" } }).status, 0);
  assert.equal(runHook("guard-git.mjs", { tool_name: "Read", tool_input: {} }).status, 0);
  assert.equal(runHook("guard-git.mjs", {}).status, 0);

  const fixture = runHook("guard-fixtures.mjs", {
    tool_name: "Write",
    tool_input: { file_path: "backend/tests/unit/test_x.py", content: "EMAIL = 'real.person@gmail.com'" },
  });
  assert.equal(fixture.status, 2);
  const ok = runHook("guard-fixtures.mjs", {
    tool_name: "Write",
    tool_input: { file_path: "backend/tests/unit/test_x.py", content: "EMAIL = 'ana@example.com'" },
  });
  assert.equal(ok.status, 0);
  const notFixture = runHook("guard-fixtures.mjs", {
    tool_name: "Write",
    tool_input: { file_path: "README.md", content: "contact me@gmail.com" },
  });
  assert.equal(notFixture.status, 0);
  assert.equal(spawnSync(process.execPath, [join(here, "guard-fixtures.mjs")], { input: "not json" }).status, 0);
});
