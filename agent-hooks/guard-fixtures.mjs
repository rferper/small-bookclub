#!/usr/bin/env node
// PreToolUse(Write|Edit|MultiEdit): keep real-looking data out of tests, fixtures,
// seeds and demo files. The project uses fictional data only (AGENTS.md).
import { block, readEvent } from "./lib.mjs";

const FIXTURE_PATH = /(^|[\/])(tests?|__tests__|fixtures?|seeds?|demo|mock)([\/]|$)|\.(test|spec)\.[cm]?[jt]sx?$|(^|[\/])(conftest|test_[^\/]*)\.py$/i;
// Real people use public mail providers; invented addresses on made-up domains are fine.
const REAL_MAIL_PROVIDER = /(^|\.)(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|aol|proton|protonmail|gmx|web|mail|yandex|qq|163)\.[a-z.]+$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
const TOKENS = [
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, "GitHub token"],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, "API key"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/, "Slack token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/i, "Discord webhook URL"],
  [/\b[\w-]{24}\.[\w-]{6}\.[\w-]{27,}\b/, "Discord bot token"],
];

export function isFixturePath(path) {
  return FIXTURE_PATH.test(String(path ?? ""));
}

export function findProblems(text) {
  const problems = [];
  for (const [, domain] of String(text).matchAll(EMAIL)) {
    if (REAL_MAIL_PROVIDER.test(domain)) problems.push(`email on a real mail provider (@${domain}); use example.com`);
  }
  for (const [re, label] of TOKENS) if (re.test(text)) problems.push(`${label}`);
  return [...new Set(problems)];
}

function newText(input = {}) {
  const parts = [input.content, input.new_string];
  for (const edit of input.edits ?? []) parts.push(edit.new_string);
  return parts.filter((part) => typeof part === "string").join("\n");
}

if (process.argv[1]?.endsWith("guard-fixtures.mjs")) {
  const event = readEvent();
  const input = event.tool_input ?? {};
  if (["Write", "Edit", "MultiEdit"].includes(event.tool_name) && isFixturePath(input.file_path)) {
    const problems = findProblems(newText(input));
    if (problems.length) {
      block(`${input.file_path} looks like it contains real data (${problems.join("; ")}). Use fictional values only.`);
    }
  }
}
