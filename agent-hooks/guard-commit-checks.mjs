#!/usr/bin/env node
// PreToolUse(Bash): before `git commit`, run the fast checks for the areas staged.
// Full test suites are too slow for a hook; run them before merge as AGENTS.md says.
import { execFileSync, spawnSync } from "node:child_process";
import { readEvent, simpleCommands, isGit, block } from "./lib.mjs";

export function areasFor(files) {
  return {
    backend: files.some((file) => file.startsWith("backend/") && file.endsWith(".py")),
    frontend: files.some((file) => file.startsWith("frontend/") && /\.(tsx?|css)$/.test(file)),
  };
}

export function isCommit(command) {
  return simpleCommands(command).some((simple) => isGit(simple, "commit"));
}

function run(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  return result.status === 0 ? null : `${command} ${args.join(" ")} failed in ${cwd}:\n${(result.stdout + result.stderr).slice(-1500)}`;
}

if (process.argv[1]?.endsWith("guard-commit-checks.mjs")) {
  const event = readEvent();
  if (event.tool_name === "Bash" && isCommit(event.tool_input?.command)) {
    const files = execFileSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
    const areas = areasFor(files);
    const failure =
      (areas.backend && run("backend", "uv", ["run", "ruff", "check", "."])) ||
      (areas.frontend && run("frontend", "npm", ["run", "lint"]));
    if (failure) block(`fast checks must pass before committing.\n${failure}`);
  }
}
