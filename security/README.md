# Security evidence (#82)

Run from the repository root with Node 24, uv 0.12.7 and Python 3.13. Install the
free pinned Gitleaks CLI into a temporary operator-tools directory:

```powershell
uv run --no-project --python 3.13 python security/install_gitleaks.py --destination "$env:TEMP/bookclub-security-tools"
$env:GITLEAKS_BIN = "$env:TEMP/bookclub-security-tools/gitleaks.exe"
node --test security/scan.test.mjs
node --test security/workflow.test.mjs
node security/test-rules.mjs
node security/scan.mjs "$env:TEMP/bookclub-security-report"
```

On Linux set `GITLEAKS_BIN` to the installed `gitleaks` filename. The installer
supports Windows/Linux x64 and verifies committed official release checksums;
it extracts only the named binary. Nothing changes application dependencies,
accounts, persistent scanner settings, databases, deployments or the preview.
CI runs the same checks with full git history, then gates the required aggregate.

The scanner copies only `git ls-files` regular files to an exact temporary tree.
Stage new files before local verification. Semgrep scans that tree with seven
original local rules for Python/JS dynamic execution, shell execution, disabled
Python TLS verification, unsafe YAML and React HTML injection. The two explicitly
excluded rule-fixture source files contain intentional positive examples, tested
separately. No language, severity or application/test directory is suppressed.
Rules are deliberately small, syntactic and incomplete: this is not a complete
security audit, taint analysis or a substitute for permission/spoiler tests.
Semgrep runs without registry rules, login, metrics or version checks; temporary
settings avoid touching the operator's settings. Fixture verification checks the
JSON results for all seven rules because CLI exit zero can accompany test errors.

`pip-audit` checks all pinned packages exported from `backend/uv.lock`, including
dev dependencies, without installing the application's packages. `npm audit`
checks the complete frontend lockfile, including dev dependencies. Public advisory
services receive package/version metadata; no source, secret or business record
is sent. Availability/freshness of these databases is an external dependency.
There is no automatic fix or upgrade. Gitleaks checks all available local git
refs and the tracked current tree; CI fetches full history. Local-only refs may
make local history results a superset of CI. Untracked/ignored local files and
provider secret stores are outside scope, not evidence of their safety.

Only `scan-summary.json` survives: versions, time, revision, scanner status and
projected IDs, paths/lines, public dependency versions and severity. No secret
match, snippet, author, commit message, raw exception or scanner output is
retained. Current-file findings include SHA-256 of the complete UTF-8 source file
with LF line endings, never of the secret match. Temporary source/report copies
are removed on success/failure. CI retains only this summary for three days.
The revision identifies HEAD; the scanned tracked working tree may include staged
changes. A committed snapshot describes the stated observation, not future code.

Every scanner/network/parse failure and every untriaged finding blocks success.
Gitleaks uses finding exit code 10 so an operational failure (including one that
left partial findings) cannot be mistaken for a reviewed finding result.
`triage.json` accepts only exact false-positive findings with rationale and an
expiry. History keys include the immutable commit; current-file keys include the
reviewed source hash, so changed source at the same line requires review again.
Stale/duplicate/nonexistent exceptions fail. The initial 17 reviewed identities
were seven RegExp.exec matches, eight fictional Discord user-ID matches across
history/tree, and two callable unusable-password migration matches. The current
tree adds one exact source-bound RegExp.exec false positive in the startup
protocol parser. None is a real credential or a shell command. The exact matches
and rationales remain visible in triage; rules stay enabled. Review by
2027-01-17.

The actual secret-scanner regression generates a fictional token only in a
temporary directory, proves a blocked result and complete redaction, and cleans
it. Unit cases cover hostile raw fields, malformed/failed/skipped scans, expiry,
exact identity and invalidation after source changes. No real secret is a fixture.

See the [PR audit](pr-audit-112.md). Its AI observations and owner's human
validation are distinct; pending validation must not be reported as complete.
The [verification note](verification.md) links the actual projected CI snapshot
and distinguishes security-job success from final full-pipeline acceptance.
Agent policy and the final operations report remain #83/#84; #81 is separately
parked and these scanners never invoke its model or startup experiments.
