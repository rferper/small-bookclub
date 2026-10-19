import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { scannerEnvironment } from './scan.mjs'

const temporary = mkdtempSync(join(tmpdir(), 'bookclub-rule-tests-'))
try {
  const result = spawnSync('uv', ['tool', 'run', '--from', 'semgrep==1.181.0', 'semgrep', '--test', '--json',
    'security/rules', '--metrics=off', '--disable-version-check'], {
    encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 131072,
    env: scannerEnvironment(temporary),
  })
  const report = JSON.parse(result.stdout)
  const checks = Object.values(report.results ?? {}).flatMap(config => Object.values(config.checks ?? {}))
  // The CLI can exit zero while reporting a config's test execution error.
  if (result.error || result.status !== 0 || Object.keys(report.config_with_errors ?? {}).length
    || !report.results || Object.keys(report.results).length !== 2
    || checks.length !== 7 || checks.some(check => check.passed !== true)) throw new Error()
  console.log('Semgrep fixtures passed for both rule files')
} catch { console.error('Semgrep fixture verification failed; raw tool output suppressed'); process.exitCode = 1 }
finally {
  if (resolve(temporary).startsWith(resolve(tmpdir()) + sep + 'bookclub-rule-tests-')) rmSync(temporary, { recursive: true, force: true })
}
