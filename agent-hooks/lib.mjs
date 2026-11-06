// Shared helpers for the Claude Code PreToolUse guardrail hooks.
// Protocol: the event JSON arrives on stdin; exit code 2 blocks the tool call and
// stderr is shown to the agent; exit code 0 allows it.
import { readFileSync } from "node:fs";

export function readEvent(input = readFileSync(0, "utf8")) {
  try {
    const event = JSON.parse(input);
    return event && typeof event === "object" ? event : {};
  } catch {
    return {};
  }
}

export function block(reason) {
  process.stderr.write(`BLOCKED by agent-hooks: ${reason}\n`);
  process.exit(2);
}

// Split a shell command line into simple commands on ; && || | and newlines so a
// guard sees `git push` even when chained after another command.
export function simpleCommands(command) {
  return String(command ?? "")
    .split(/&&|\|\||;|\||\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function isGit(simple, sub) {
  const pattern = String.raw`^(?:\w+=\S+\s+)*git(?:\s+-C\s+\S+)?\s+` + sub + String.raw`(?:\s|$)`;
  return new RegExp(pattern).test(simple);
}
