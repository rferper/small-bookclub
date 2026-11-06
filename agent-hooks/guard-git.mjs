#!/usr/bin/env node
// PreToolUse(Bash): refuse risky git commands. Complements the deny list in
// .claude/settings.json, but also works for agents that do not read that file.
import { execFileSync } from "node:child_process";
import { block, isGit, readEvent, simpleCommands } from "./lib.mjs";

const PROTECTED = /^(main|master)$/;
const FORBIDDEN_PATHS = [
  /(^|\/)\.env(\.|$)/,
  /\.(sqlite3?|db)$/i,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)media\//,
  /(^|\/)(id_rsa|id_ed25519)$/,
];

export function checkCommand(command, stagedFiles = () => []) {
  for (const simple of simpleCommands(command)) {
    if (isGit(simple, "push")) {
      if (/(^|\s)(--force|-f|--force-with-lease\S*|--delete|-d)(\s|$)/.test(simple)) {
        return "force or delete pushes are not allowed; ask the owner.";
      }
      const refs = simple.split(/\s+/).slice(2).filter((word) => !word.startsWith("-"));
      const target = refs.slice(1).flatMap((ref) => ref.split(":").slice(-1));
      if (target.some((name) => PROTECTED.test(name.replace(/^refs\/heads\//, "")))) {
        return "push to main goes through a pull request, not directly.";
      }
    }
    if (isGit(simple, "commit")) {
      if (/(^|\s)(--no-verify|-n|-[a-zA-Z]*n[a-zA-Z]*)(\s|$)/.test(simple.replace(/-m\s+("[^"]*"|'[^']*'|\S+)/g, ""))) {
        return "commits must not skip verification (--no-verify).";
      }
      const bad = stagedFiles().filter((file) => FORBIDDEN_PATHS.some((re) => re.test(file)));
      if (bad.length) {
        return `staged files look like secrets, databases or uploaded media: ${bad.slice(0, 5).join(", ")}`;
      }
    }
    if (isGit(simple, "reset") && /--hard/.test(simple)) return "git reset --hard discards work; ask the owner.";
    if (isGit(simple, "clean")) return "git clean deletes untracked files; ask the owner.";
  }
  return null;
}

function staged() {
  try {
    return execFileSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

if (process.argv[1]?.endsWith("guard-git.mjs")) {
  const event = readEvent();
  if (event.tool_name === "Bash") {
    const reason = checkCommand(event.tool_input?.command, staged);
    if (reason) block(reason);
  }
}
