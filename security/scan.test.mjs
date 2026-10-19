import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import test from 'node:test'
import { applyTriage, bindSourceFindings, classifyScan, projectFindings, scannerEnvironment } from './scan.mjs'

const marker = 'fictional-private-match-never-retain'
test('all scanner commands exclude service credentials and isolate Semgrep settings', () => {
  const environment = scannerEnvironment('fictional-temp', { PATH: 'fictional-bin', SEMGREP_APP_TOKEN: marker,
    GITHUB_TOKEN: marker, OPENAI_API_KEY: marker, SECRET_KEY: marker, RENDER_API_KEY: marker })
  assert.equal(environment.PATH, 'fictional-bin')
  assert.equal(environment.SEMGREP_SETTINGS_FILE, join('fictional-temp', 'semgrep-settings.yml'))
  assert.equal(environment.SEMGREP_SEND_METRICS, 'off')
  assert.ok(!JSON.stringify(environment).includes(marker))
})
test('secret projection removes matches, snippets, author and exception details', () => {
  const value = { RuleID: 'github-pat', File: 'fictional/token.txt', StartLine: 1, Commit: 'a'.repeat(40),
    Secret: marker, Match: marker, Line: marker, Author: marker, Email: marker, Message: marker, Fingerprint: marker }
  const findings = projectFindings('gitleaks-history', [value])
  assert.equal(findings.length, 1)
  assert.ok(!JSON.stringify(findings).includes(marker))
  const semgrep = projectFindings('semgrep', { errors: [], results: [{ check_id: 'safe-id', path: 'backend/example.py', start: { line: 2 },
    extra: { severity: 'ERROR', message: marker, lines: marker, metadata: { private: marker } } }] })
  assert.ok(!JSON.stringify(semgrep).includes(marker))
})
test('failed, incomplete, malformed or unknown scanner results fail closed', () => {
  const valid = { results: [], errors: [] }
  assert.equal(classifyScan('semgrep', { status: 0 }, valid).status, 'passed')
  for (const result of [{ status: 2 }, { status: null, error: new Error(marker) }, { status: 1 }]) {
    const projected = classifyScan('semgrep', result, valid)
    assert.equal(projected.status, 'scanner-failed')
    assert.ok(!JSON.stringify(projected).includes(marker))
  }
  for (const [tool, raw] of [['semgrep', { results: [], errors: [{ message: marker }] }], ['npm-audit', { error: marker }],
    ['pip-audit', { dependencies: [{ name: 'fictional', skip_reason: marker }] }], ['unknown', {}]]) {
    assert.equal(classifyScan(tool, { status: 0 }, raw).status, 'invalid-output')
  }
  for (const filename of ['../../private', '/absolute', 'C:/private', marker + '\n']) {
    assert.throws(() => projectFindings('gitleaks-tree', [{ RuleID: 'fictional', File: filename, StartLine: 1 }]))
  }
})
test('dependency summaries project public identities and reject skipped packages', () => {
  const pip = projectFindings('pip-audit', { dependencies: [{ name: 'fictional', version: '1.0', vulns: [{ id: 'PYSEC-0000-1', fix_versions: ['1.1'], description: marker }] }] })
  assert.equal(pip[0].fixedVersions[0], '1.1')
  assert.ok(!JSON.stringify(pip).includes(marker))
  const npm = projectFindings('npm-audit', { auditReportVersion: 2, metadata: { vulnerabilities: {}, dependencies: { total: 1 } }, vulnerabilities: {
    fictional: { name: 'fictional', range: '<1.1', severity: 'high', via: [{ title: marker, url: marker }] } } })
  assert.equal(npm[0].severity, 'high')
  assert.ok(!JSON.stringify(npm).includes(marker))
})
test('triage is exact, reviewed, non-expired and cannot hide scanner failure', () => {
  const scans = [{ tool: 'semgrep', status: 'findings', findings: [{ key: 'exact-key' }] }]
  const exception = { key: 'exact-key', disposition: 'false-positive', rationale: 'Fictional bounded test data, independently inspected.', reviewBy: '2026-12-01' }
  assert.equal(applyTriage(scans, { schemaVersion: 1, exceptions: [] }, '2026-10-19')[0].findings[0].disposition, 'untriaged')
  assert.equal(applyTriage(scans, { schemaVersion: 1, exceptions: [exception] }, '2026-10-19')[0].findings[0].disposition, 'false-positive')
  for (const change of [{ key: '*' }, { key: 'missing' }, { reviewBy: '2020-01-01' }, { disposition: 'accepted-risk' }, { rationale: '' }]) {
    assert.throws(() => applyTriage(scans, { schemaVersion: 1, exceptions: [{ ...exception, ...change }] }, '2026-10-19'))
  }
  assert.throws(() => applyTriage(scans, { schemaVersion: 1, exceptions: [exception, exception] }, '2026-10-19'))
  const failure = applyTriage([{ tool: 'semgrep', status: 'scanner-failed', findings: [] }], { schemaVersion: 1, exceptions: [] })
  assert.equal(failure[0].status, 'scanner-failed')
})
test('working-tree exceptions become invalid when source changes at the same location', () => {
  const scans = [{ tool: 'semgrep', status: 'findings', findings: [{ path: 'fictional.js', key: 'same-location' }] }]
  const original = bindSourceFindings(scans, () => 'fictional safe source')
  const changed = bindSourceFindings(scans, () => 'fictional changed source')
  assert.notEqual(original[0].findings[0].key, changed[0].findings[0].key)
  const triage = { schemaVersion: 1, exceptions: [{ key: original[0].findings[0].key, disposition: 'false-positive',
    rationale: 'Reviewed exact fictional source file content.', reviewBy: '2026-12-01' }] }
  assert.equal(applyTriage(original, triage, '2026-10-19')[0].findings[0].disposition, 'false-positive')
  assert.throws(() => applyTriage(changed, triage, '2026-10-19'))
  assert.equal(bindSourceFindings(scans, () => 'one\r\ntwo')[0].findings[0].key,
    bindSourceFindings(scans, () => 'one\ntwo')[0].findings[0].key)
})
test('actual Gitleaks blocks a fictional token, redacts it, and accepts an empty directory', { skip: !process.env.GITLEAKS_BIN }, () => {
  const directory = mkdtempSync(join(tmpdir(), 'bookclub-secret-probe-'))
  try {
    const file = join(directory, 'report.json')
    const args = ['dir', directory, '--redact=100', '--no-banner', '--report-format', 'json', '--report-path', file]
    const options = { encoding: 'utf8', shell: false, windowsHide: true, timeout: 30000, maxBuffer: 65536 }
    const clean = spawnSync(process.env.GITLEAKS_BIN, args, options)
    assert.equal(clean.status, 0)
    rmSync(file)
    const fictional = 'ghp_' + randomBytes(27).toString('base64url').replaceAll('-', 'A').replaceAll('_', 'B')
    writeFileSync(join(directory, 'fictional.txt'), `fictional_token = "${fictional}"`)
    const blocked = spawnSync(process.env.GITLEAKS_BIN, args, options)
    assert.equal(blocked.status, 1)
    const raw = readFileSync(file, 'utf8')
    assert.ok(!raw.includes(fictional))
    assert.ok(!`${blocked.stdout}${blocked.stderr}`.includes(fictional))
    const report = classifyScan('gitleaks-tree', blocked, JSON.parse(raw), { treeRoot: directory })
    assert.equal(report.status, 'findings')
    assert.ok(report.findings.length >= 1)
    assert.ok(!JSON.stringify(report).includes(fictional))
  } finally {
    if (resolve(directory).startsWith(resolve(tmpdir()) + sep + 'bookclub-secret-probe-')) rmSync(directory, { recursive: true, force: true })
  }
})
