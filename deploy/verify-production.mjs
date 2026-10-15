// Fictional, disposable local TLS verification; never selects a retained project.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { request } from 'node:https'
import { get } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = fileURLToPath(new URL('../', import.meta.url))
const evidence = mkdtempSync(join(tmpdir(), 'bookclub-production-check-'))
const backups = join(evidence, 'backups')
mkdirSync(backups)
const project = `bookclub-production-check-${randomBytes(5).toString('hex')}`
const servers = []
async function port() {
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  servers.push(server)
  return server.address().port
}
const httpPort = await port(), httpsPort = await port()
await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))))
const env = { ...process.env, SECRET_KEY: randomBytes(48).toString('hex'), BOOKCLUB_HOST: 'localhost', BACKUP_DIRECTORY: backups,
  BOOKCLUB_BIND_IP: '127.0.0.1', BOOKCLUB_HTTP_PORT: String(httpPort), BOOKCLUB_HTTPS_PORT: String(httpsPort), TLS_ISSUER: 'internal', DEMO_MODE: 'false' }
const args = ['compose', '-p', project, '-f', 'docker-compose.yml', '-f', 'deploy/compose.production.yml']
function command(extra, capture = false) {
  const result = spawnSync('docker', [...args, ...extra], { cwd: root, env, timeout: 300000, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' })
  if (result.error || result.status !== 0) throw new Error(`Verification Docker command failed: ${extra[0]} (${result.status})`)
  return result.stdout?.trim()
}
const manage = (...extra) => command(['exec', '-T', 'backend', 'python', 'manage.py', ...extra], true)
let ca, browser
function https(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: 'localhost', port: httpsPort, path, method, ca, headers, timeout: 10000 }, response => {
      let body = ''
      response.setEncoding('utf8').on('data', chunk => { body += chunk }).on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }))
    })
    req.on('error', reject).on('timeout', () => req.destroy(new Error('HTTPS verification timeout')))
    req.end()
  })
}
try {
  console.log(`Disposable production verification: ${project}; evidence: ${evidence}`)
  const config = JSON.parse(command(['config', '--format', 'json'], true))
  assert.equal(config.services.backend.environment.BOOKCLUB_ENV, 'production')
  assert.equal(config.services.backend.environment.DEMO_MODE, 'false')
  assert.equal(config.services.backend.ports, undefined)
  assert.equal(config.services.frontend.ports, undefined)
  command(['up', '--build', '-d', '--wait', '--wait-timeout', '180'])
  // This exact, newly created fictional bind directory belongs to this run only.
  command(['exec', '-T', '--user', '0:0', 'backend', 'sh', '-c', 'chown 10001:10001 /backups && chmod 700 /backups'])
  // Local issuer startup is asynchronous; no host trust store is modified.
  let ready = false
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      command(['cp', 'caddy:/data/caddy/pki/authorities/local/root.crt', join(evidence, 'root.crt')], true)
      ca = readFileSync(join(evidence, 'root.crt'))
      ready = (await https('/api/health')).status === 200
      if (ready) break
    } catch { /* Readiness only; assertions below never retry failed operations. */ }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert.ok(ready, 'Local TLS became ready')
  const redirect = await new Promise((resolve, reject) => {
    const req = get(`http://127.0.0.1:${httpPort}/api/health`, { headers: { Host: 'localhost' }, timeout: 10000 }, response => { response.resume(); resolve(response) })
    req.on('error', reject).on('timeout', () => req.destroy(new Error('HTTP verification timeout')))
  })
  assert.equal(redirect.statusCode, 308)
  assert.equal(redirect.headers.location, 'https://localhost/api/health')
  const health = await https('/api/health', 'GET', { 'X-Forwarded-Proto': 'http', 'X-Forwarded-For': '203.0.113.10' })
  assert.equal(health.status, 200, 'Forged forwarding headers cannot cause an HTTPS redirect loop')
  assert.deepEqual(JSON.parse(health.body), { status: 'ok' })
  for (const path of ['/', '/biblioteca', '/api/session']) {
    const response = await https(path)
    assert.equal(response.status, 200)
    assert.match(response.headers['strict-transport-security'], /max-age=3600/)
    assert.match(response.headers['cache-control'], /no-store/)
    assert.equal(response.headers['x-frame-options'], 'DENY')
    assert.match(response.headers['x-robots-tag'], /noindex/)
  }
  assert.equal((await https('/api/me/profile')).status, 401)
  assert.equal((await https('/api/auth/logout', 'POST')).status, 403)
  const session = await https('/api/session')
  assert.equal(JSON.parse(session.body).demoSignInAvailable, false)
  const csrf = session.headers['set-cookie'].find(value => value.startsWith('csrftoken='))
  assert.match(csrf, /; Secure/)
  const cookie = csrf.split(';')[0], token = cookie.split('=')[1]
  const headers = { Cookie: cookie, 'X-CSRFToken': token, Origin: `https://localhost:${httpsPort}` }
  assert.equal((await https('/api/auth/demo', 'POST', headers)).status, 404)
  assert.equal((await https('/api/auth/logout', 'POST', headers)).status, 204)

  // Explicit opt-in only for this separate fictional volume; production stays off.
  env.DEMO_MODE = 'true'
  command(['up', '-d', '--wait', '--wait-timeout', '180'])
  manage('seed_demo')
  const seeded = await https('/api/session')
  const newCookie = seeded.headers['set-cookie'].find(value => value.startsWith('csrftoken=')).split(';')[0]
  const signedIn = await https('/api/auth/demo', 'POST', { Cookie: newCookie, 'X-CSRFToken': newCookie.split('=')[1], Origin: `https://localhost:${httpsPort}` })
  assert.equal(signedIn.status, 204)
  assert.match(signedIn.headers['set-cookie'].find(value => value.startsWith('sessionid=')), /;.*HttpOnly.*;.*SameSite=Lax.*; Secure/)
  command(['exec', '-T', '-e', 'INITIAL_ADMIN_DISCORD_ID=990000000000000099', 'backend', 'python', 'manage.py', 'bootstrap_admin'], true)
  const actor = command(['exec', '-T', 'backend', 'python', 'manage.py', 'shell', '--verbosity', '0', '-c', "from users.models import User; print(User.objects.get(discord_user_id='990000000000000099').pk)"], true)
  console.log(manage('purge_expired', '--actor-id', actor, '--dry-run'))
  console.log(manage('backup_club', '--destination', '/backups', '--keep', '2'))
  const archive = command(['exec', '-T', 'backend', 'python', '-c', "from pathlib import Path; print(next(Path('/backups').glob('*.zip')).name)"], true)
  assert.ok(archive, 'Consistent backup archive exists')
  console.log(manage('restore_club_backup', '--archive', `/backups/${archive}`, '--destination', '/tmp/bookclub-recovered'))
  // The restore command already validates integrity. Compare native contents here;
  // a bare SQLite connection does not register Django's constraint SQL functions.
  command(['exec', '-T', 'backend', 'python', '-c', "import sqlite3; a=sqlite3.connect('/data/club.sqlite3'); b=sqlite3.connect('/tmp/bookclub-recovered/database.sqlite3'); query='select discord_user_id, display_name, bio, approved, role from users_user order by id'; assert a.execute(query).fetchall()==b.execute(query).fetchall(); assert a.execute('select title from books_book order by id').fetchall()==b.execute('select title from books_book order by id').fetchall()"], true)
  command(['up', '-d', '--force-recreate', '--wait', '--wait-timeout', '180'])
  assert.equal(JSON.parse((await https('/api/session')).body).demoSignInAvailable, true)
  const { chromium } = createRequire(new URL('../frontend/package.json', import.meta.url))('@playwright/test')
  browser = await chromium.launch()
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`https://localhost:${httpsPort}/`)
  await page.getByRole('button', { name: 'Entrar con una cuenta de prueba', exact: true }).waitFor()
  await page.screenshot({ path: join(evidence, 'production-https.png'), fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS: TLS/proxy/CSRF/cookies/isolation, fictional backup/recovery/purge dry-run and recreation persistence.')
} finally {
  await browser?.close()
  command(['down', '--volumes', '--remove-orphans'])
  console.log(`Fictional evidence/backup retained only at ${evidence}`)
}
