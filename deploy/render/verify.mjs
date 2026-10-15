// Render artifact behind disposable local TLS; no account, real data or public URL.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { request } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = fileURLToPath(new URL('../../', import.meta.url))
const evidence = mkdtempSync(join(tmpdir(), 'bookclub-render-check-'))
const reservations = []
async function port() {
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  reservations.push(server)
  return server.address().port
}
const worlds = []
for (const name of ['staging', 'production-demo']) {
  worlds.push({ name, project: `bookclub-render-${name}-${randomBytes(4).toString('hex')}`, httpPort: await port(), httpsPort: await port(),
    secret: randomBytes(48).toString('hex') })
}
await Promise.all(reservations.map(server => new Promise(resolve => server.close(resolve))))
function command(world, extra, capture = false) {
  const env = { ...process.env, SECRET_KEY: world.secret, BOOKCLUB_HOST: 'localhost', BACKUP_DIRECTORY: evidence,
    BOOKCLUB_BIND_IP: '127.0.0.1', BOOKCLUB_HTTP_PORT: String(world.httpPort), BOOKCLUB_HTTPS_PORT: String(world.httpsPort),
    TLS_ISSUER: 'internal', DEMO_MODE: 'true', DISCORD_CLIENT_ID: '', DISCORD_CLIENT_SECRET: '' }
  const args = ['compose', '-p', world.project, '-f', 'docker-compose.yml', '-f', 'deploy/compose.production.yml', '-f', 'tests/render/compose.yml', ...extra]
  const result = spawnSync('docker', args, { cwd: root, env, timeout: 300000, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' })
  if (result.error || result.status !== 0) throw new Error(`${world.project}: ${extra[0]} failed (${result.status})`)
  return result.stdout?.trim()
}
async function ready(world) {
  const cert = join(evidence, `${world.name}.crt`)
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      command(world, ['cp', 'caddy:/data/caddy/pki/authorities/local/root.crt', cert], true)
      const ca = readFileSync(cert)
      const ok = await new Promise((resolve, reject) => {
        const req = request({ hostname: 'localhost', port: world.httpsPort, path: '/api/health', ca, agent: false, timeout: 10000 }, response => { response.resume(); resolve(response.statusCode === 200) })
        req.on('error', reject).on('timeout', () => req.destroy(new Error('TLS readiness timeout')))
        req.end()
      })
      if (ok) return cert
    } catch { /* Local TLS readiness only. */ }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error(`${world.project}: TLS not ready`)
}
let browser, failed = false
try {
  console.log(`Render fixture evidence: ${evidence}`)
  for (const world of worlds) {
    console.log(`Disposable Render artifact: ${world.project}`)
    const config = JSON.parse(command(world, ['config', '--format', 'json'], true))
    assert.equal(config.services.backend.ports, undefined)
    assert.ok(!config.services.backend.volumes?.length, 'Render data must be ephemeral')
    assert.equal(config.services.backend.environment.DISCORD_CLIENT_SECRET, '')
    command(world, ['up', '--build', '-d', '--wait', '--wait-timeout', '180'])
    const cert = await ready(world)
    world.origin = `https://localhost:${world.httpsPort}`
    const smoke = spawnSync(process.execPath, [join(root, 'deploy/smoke-demo.mjs')], {
      cwd: root, env: { ...process.env, DEMO_URL: world.origin, SMOKE_LOCAL_CA: cert, SMOKE_SCREENSHOT: join(evidence, `${world.name}.png`) },
      timeout: 180000, stdio: 'inherit',
    })
    assert.ok(!smoke.error && smoke.status === 0, `${world.name} smoke passed`)
  }
  const { chromium } = createRequire(new URL('../../frontend/package.json', import.meta.url))('@playwright/test')
  browser = await chromium.launch()
  async function login(world) {
    world.context = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: world.origin })
    world.context.setDefaultTimeout(15000)
    const bootstrap = await world.context.request.get('/api/session')
    assert.equal((await bootstrap.json()).demoSignInAvailable, true)
    const csrf = (await world.context.cookies()).find(cookie => cookie.name === 'csrftoken').value
    assert.equal((await world.context.request.post('/api/auth/demo', { headers: { Origin: world.origin, 'X-CSRFToken': csrf } })).status(), 204)
    const response = await world.context.request.get('/api/me/profile')
    assert.equal(response.status(), 200)
    return response.json()
  }
  const [stage, production] = worlds
  const originalStage = await login(stage), originalProduction = await login(production)
  const page = await stage.context.newPage()
  await page.goto('/mi-perfil')
  await page.getByLabel('Nombre visible', { exact: true }).fill('Prueba ficticia staging')
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/me/profile' && response.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  assert.equal((await saved).status(), 200)
  await page.reload()
  assert.equal(await page.getByLabel('Nombre visible', { exact: true }).inputValue(), 'Prueba ficticia staging')
  assert.equal((await (await production.context.request.get('/api/me/profile')).json()).member.displayName, originalProduction.member.displayName)
  const stranger = await browser.newContext({ ignoreHTTPSErrors: true })
  const cookie = (await stage.context.cookies()).filter(value => value.name === 'sessionid').map(value => `${value.name}=${value.value}`).join('; ')
  assert.equal((await stranger.request.get(`${production.origin}/api/me/profile`, { headers: { Cookie: cookie } })).status(), 401)
  await stranger.close()
  const books = await (await stage.context.request.get('/api/books')).json()
  const finished = books.find(book => book.status === 'terminado')
  assert.ok(finished)
  assert.deepEqual((await (await stage.context.request.get(`/api/books/${finished.id}/ratings`)).json()).club, { status: 'locked' })
  // A new container reproduces loss of the free host's writable filesystem.
  command(stage, ['up', '-d', '--force-recreate', '--wait', '--wait-timeout', '180', 'backend'])
  await ready(stage)
  assert.equal((await (await stage.context.request.get('/api/session')).json()).status, 'anonymous')
  const fresh = await login(stage)
  assert.equal(fresh.member.displayName, originalStage.member.displayName, 'Recreated demo reseeded fictional data')
  assert.equal((await (await production.context.request.get('/api/me/profile')).json()).member.displayName, originalProduction.member.displayName)
  console.log('PASS: both Render artifacts, member profile reload, environment/session isolation, locked ratings and reset/reseed.')
} catch (error) {
  failed = true
  console.error(error)
} finally {
  await browser?.close()
  for (const world of worlds.reverse()) {
    try { command(world, ['down', '--volumes', '--remove-orphans']) }
    catch (error) { failed = true; console.error(`Cleanup failed: ${world.project}: ${error.message}`) }
  }
}
process.exitCode = failed ? 1 : 0
