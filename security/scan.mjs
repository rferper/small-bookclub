import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const versions = { semgrep: '1.181.0', pipAudit: '2.10.1', gitleaks: '8.30.1' }
export function scannerEnvironment(temporary, input = process.env) {
  return { ...Object.fromEntries(Object.entries(input).filter(([key]) => /^(path|systemroot|windir|comspec|pathext|userprofile|home|temp|tmp|localappdata|appdata|uv_cache_dir)$/iu.test(key))),
    SEMGREP_SEND_METRICS: 'off', SEMGREP_ENABLE_VERSION_CHECK: '0',
    SEMGREP_SETTINGS_FILE: join(temporary, 'semgrep-settings.yml'), PIP_DISABLE_PIP_VERSION_CHECK: '1' }
}
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_@./:+<>=*~^| -]{1,200}$/u.test(value) ? value : (() => { throw new Error('Invalid identifier') })()
const path = value => typeof value === 'string' && /^[a-zA-Z0-9_@./+-]{1,250}$/u.test(value) && !value.startsWith('/') && !value.split('/').includes('..') ? value : (() => { throw new Error('Invalid path') })()
const line = value => Number.isInteger(value) && value > 0 && value < 10000000 ? value : (() => { throw new Error('Invalid line') })()
const severity = value => ['critical', 'high', 'moderate', 'medium', 'low', 'info', 'warning', 'error'].includes(value?.toLowerCase()) ? value.toLowerCase() : 'unknown'

// Never retain scanner snippets, messages, secret values, hashes of secrets,
// author identities, commit messages, request details or arbitrary error text.
export function projectFindings(tool, raw, { treeRoot } = {}) {
  let findings
  if (tool === 'semgrep') {
    if (!Array.isArray(raw.results) || !Array.isArray(raw.errors) || raw.errors.length) throw new Error('Invalid scan')
    findings = raw.results.map(item => ({ id: identifier(item.check_id), path: path(item.path.replaceAll('\\', '/')), line: line(item.start.line), severity: severity(item.extra.severity) }))
  } else if (tool === 'gitleaks-history' || tool === 'gitleaks-tree') {
    if (!Array.isArray(raw)) throw new Error('Invalid scan')
    findings = raw.map(item => {
      if (!/^[a-f0-9]{40}$/u.test(item.Commit ?? '') && tool === 'gitleaks-history') throw new Error('Invalid commit')
      let filename = item.File
      if (tool === 'gitleaks-tree' && treeRoot && isAbsolute(filename)) {
        if (!resolve(filename).startsWith(resolve(treeRoot) + sep)) throw new Error('Outside tracked tree')
        filename = relative(treeRoot, filename)
      }
      return { id: identifier(item.RuleID), path: path(filename.replaceAll('\\', '/')), line: line(item.StartLine),
        ...(tool === 'gitleaks-history' ? { commit: item.Commit } : {}), severity: 'high' }
    })
  } else if (tool === 'pip-audit') {
    if (!Array.isArray(raw.dependencies) || raw.dependencies.length === 0 || raw.dependencies.some(item => item.skip_reason || !Array.isArray(item.vulns))) throw new Error('Incomplete audit')
    findings = raw.dependencies.flatMap(item => item.vulns.map(vuln => ({ id: identifier(vuln.id), package: identifier(item.name), version: identifier(item.version), fixedVersions: vuln.fix_versions.map(identifier), severity: 'unknown' })))
  } else if (tool === 'npm-audit') {
    if (raw.auditReportVersion !== 2 || !raw.vulnerabilities || !raw.metadata?.vulnerabilities || !(raw.metadata?.dependencies?.total > 0)) throw new Error('Invalid audit')
    findings = Object.values(raw.vulnerabilities).map(item => ({ id: identifier(item.name), package: identifier(item.name), version: identifier(item.range), severity: severity(item.severity) }))
  } else throw new Error('Invalid tool')
  if (findings.length > 5000) throw new Error('Finding limit')
  return findings.map(item => ({ ...item, key: `${tool}:${item.id}:${item.path ?? item.package}:${item.line ?? item.version}${item.commit ? `:${item.commit}` : ''}` })).sort((a, b) => a.key.localeCompare(b.key))
}

export function classifyScan(tool, result, raw, options) {
  if (result.error || ![0, 1].includes(result.status)) return { tool, status: 'scanner-failed', findings: [] }
  try {
    const findings = projectFindings(tool, raw, options)
    if (result.status === 1 && findings.length === 0) return { tool, status: 'scanner-failed', findings: [] }
    return { tool, status: findings.length ? 'findings' : 'passed', findings }
  } catch { return { tool, status: 'invalid-output', findings: [] } }
}

export function applyTriage(scans, triage, today = new Date().toISOString().slice(0, 10)) {
  if (triage.schemaVersion !== 1 || !Array.isArray(triage.exceptions)) throw new Error('Invalid triage')
  const keys = new Set(scans.flatMap(scan => scan.findings.map(item => item.key)))
  const exceptions = new Map()
  for (const item of triage.exceptions) {
    if (!keys.has(item.key) || exceptions.has(item.key) || item.disposition !== 'false-positive'
      || typeof item.rationale !== 'string' || item.rationale.length < 20 || item.rationale.length > 1000
      || !/^\d{4}-\d\d-\d\d$/u.test(item.reviewBy) || item.reviewBy < today) throw new Error('Invalid or stale triage')
    exceptions.set(item.key, item)
  }
  return scans.map(scan => ({ ...scan, findings: scan.findings.map(item => ({ ...item, disposition: exceptions.has(item.key) ? 'false-positive' : 'untriaged' })) }))
}

export function bindSourceFindings(scans, readSource) {
  return scans.map(scan => ({ ...scan, findings: scan.findings.map(item => {
    if (!['semgrep', 'gitleaks-tree'].includes(scan.tool)) return item
    // Bind an exception to the entire reviewed source file, never a secret match.
    const sourceSha256 = createHash('sha256').update(readSource(item.path).toString('utf8').replaceAll('\r\n', '\n')).digest('hex')
    return { ...item, sourceSha256, key: `${item.key}:source-${sourceSha256}` }
  }) }))
}

export function runScans(outputDirectory, { run = spawnSync } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const temporary = mkdtempSync(join(tmpdir(), 'bookclub-security-'))
  const environment = scannerEnvironment(temporary)
  const command = (program, args, cwd = root) => run(program, args, { cwd, env: environment, encoding: 'utf8', shell: false, windowsHide: true, timeout: 240000, maxBuffer: 8 * 1024 * 1024 })
  const read = file => JSON.parse(readFileSync(file, 'utf8'))
  try {
    const tracked = command('git', ['ls-files', '-z'])
    if (tracked.status !== 0 || tracked.error) throw new Error('Tracked tree unavailable')
    const tree = join(temporary, 'tree')
    mkdirSync(tree)
    for (const name of tracked.stdout.split('\0').filter(Boolean)) {
      const filename = path(name)
      const source = join(root, filename)
      if (!lstatSync(source).isFile()) throw new Error('Unsupported tracked file')
      mkdirSync(dirname(join(tree, filename)), { recursive: true })
      copyFileSync(source, join(tree, filename))
    }
    const gitleaks = process.env.GITLEAKS_BIN || 'gitleaks'
    const actualVersion = command(gitleaks, ['version'])
    if (actualVersion.status !== 0 || actualVersion.stdout.trim() !== versions.gitleaks) throw new Error('Pinned Gitleaks required')
    const scans = []
    const semgrep = command('uv', ['tool', 'run', '--from', `semgrep==${versions.semgrep}`, 'semgrep', 'scan', '--config', 'security/rules', '--metrics=off', '--disable-version-check', '--no-rewrite-rule-ids', '--strict', '--error', '--json', '--quiet', '--no-git-ignore', '--exclude', 'security/rules/*.py', '--exclude', 'security/rules/*.js', '.'], tree)
    try { scans.push(classifyScan('semgrep', semgrep, JSON.parse(semgrep.stdout))) }
    catch { scans.push({ tool: 'semgrep', status: 'invalid-output', findings: [] }) }
    const requirements = join(temporary, 'requirements.txt')
    const exported = command('uv', ['export', '--frozen', '--all-groups', '--no-emit-project', '--no-hashes', '--output-file', requirements], join(root, 'backend'))
    if (exported.status !== 0 || exported.error) scans.push({ tool: 'pip-audit', status: 'lock-export-failed', findings: [] })
    else {
      const audited = command('uv', ['tool', 'run', '--from', `pip-audit==${versions.pipAudit}`, 'pip-audit', '-r', requirements, '--disable-pip', '--no-deps', '--format', 'json', '--progress-spinner', 'off'])
      try { scans.push(classifyScan('pip-audit', audited, JSON.parse(audited.stdout))) }
      catch { scans.push({ tool: 'pip-audit', status: 'invalid-output', findings: [] }) }
    }
    // npm.cmd requires cmd.exe on Windows; use Node's installed npm entrypoint instead.
    const npmCommand = process.platform === 'win32' ? ['node', [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')]] : ['npm', []]
    const npmVersion = command(npmCommand[0], [...npmCommand[1], '--version'])
    if (npmVersion.status !== 0 || !/^\d+\.\d+\.\d+$/u.test(npmVersion.stdout?.trim() ?? '')) throw new Error('npm version unavailable')
    const npm = command(npmCommand[0], [...npmCommand[1], 'audit', '--package-lock-only', '--json', '--ignore-scripts'], join(root, 'frontend'))
    try { scans.push(classifyScan('npm-audit', npm, JSON.parse(npm.stdout))) }
    catch { scans.push({ tool: 'npm-audit', status: 'invalid-output', findings: [] }) }
    for (const [tool, mode, target] of [['gitleaks-history', 'git', root], ['gitleaks-tree', 'dir', tree]]) {
      const report = join(temporary, `${tool}.json`)
      const result = command(gitleaks, [mode, target, '--redact=100', '--no-banner', '--report-format', 'json', '--report-path', report, ...(mode === 'git' ? ['--log-opts=--all'] : [])])
      try { scans.push(classifyScan(tool, result, read(report), { treeRoot: tree })) }
      catch { scans.push({ tool, status: 'invalid-output', findings: [] }) }
    }
    const revision = command('git', ['rev-parse', 'HEAD']).stdout?.trim()
    if (!/^[a-f0-9]{40}$/u.test(revision ?? '')) throw new Error('Invalid revision')
    const bound = bindSourceFindings(scans, filename => readFileSync(join(tree, path(filename))))
    const triaged = applyTriage(bound, read(join(root, 'security/triage.json')))
    const report = { schemaVersion: 1, revision, collectedAt: new Date().toISOString(), versions: { ...versions, npm: npmVersion.stdout.trim(), node: process.version },
      scope: 'tracked-working-tree-and-all-local-git-refs', scans: triaged,
      passed: triaged.every(scan => ['passed', 'findings'].includes(scan.status) && scan.findings.every(item => item.disposition === 'false-positive')) }
    mkdirSync(outputDirectory, { recursive: true })
    writeFileSync(join(outputDirectory, 'scan-summary.json'), JSON.stringify(report, null, 2) + '\n')
    return report
  } finally {
    if (resolve(temporary).startsWith(resolve(tmpdir()) + sep + 'bookclub-security-')) rmSync(temporary, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Output directory required')
    const report = runScans(resolve(process.argv[2]))
    for (const scan of report.scans) console.log(`${scan.tool}: ${scan.status}; findings=${scan.findings.length}`)
    process.exitCode = report.passed ? 0 : 1
  } catch { console.error('Security scan failed; raw scanner details suppressed'); process.exitCode = 1 }
}
