# Verification checkpoint (2026-10-19)

Pinned tools ran locally on Windows and in the Linux CI security job at candidate
`7ce938fd61957a9654cb79d7bc271a5be52dac4f`. Both dependency audits returned zero
known vulnerabilities at observation time. Semgrep returned seven reviewed
RegExp.exec false positives; Gitleaks returned five historical and five current
reviewed matches (fictional user IDs and a callable unusable-password default).
All 17 exact, expiring exceptions were checked; no scanner category was disabled.

The [actual projected Linux report](reports/2026-10-19-ci.json) was downloaded from
[CI 39247928815](https://github.com/rferper/small-bookclub/actions/runs/39247928815).
Its security job passed, including real fictional-token detection/redaction and
all seven Semgrep rule fixtures. Only projected JSON was downloaded/committed.
The earlier workflow attempt was rejected before jobs started: runner context
was used at job-level env. It was corrected to step env; this is not a passing run.

Later offline checks pass 9/9: credential exclusion, hostile output projection,
scanner/error/partial-audit rejection, exact expiring triage, same-line source
change invalidation, actual Gitleaks detection/redaction, actual aggregate Bash
failure propagation and narrow artifact/full-history configuration. Semgrep
fixture wrapper separately confirms both files/all seven rule checks pass.
Python installer Ruff lint/format, Node syntax and git diff checks pass.

The PR audit's exact telemetry implementation/tests are unchanged from #112;
targeted real SDK/HTTP tests pass 12/12. Owner human validation of that audit is
pending; do not substitute AI approval. Full required CI for the final candidate
and merge/closure remain pending at this checkpoint. No application data,
account, deployment configuration or product/API behavior changed.
