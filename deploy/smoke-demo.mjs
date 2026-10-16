// Public fictional-demo smoke: actual frontend/client/API; no business-data edits.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { request } from 'node:https'
import { createRequire } from 'node:module'

const url = new URL(process.env.DEMO_URL ?? '')
assert.ok(url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash,
  'DEMO_URL must be an explicit HTTPS origin without credentials, path or query')
const localCa = process.env.SMOKE_LOCAL_CA
assert.ok(!localCa || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'A test CA is permitted only for loopback verification')
const ca = localCa ? readFileSync(localCa) : undefined
function health() {
  return new Promise((resolve, reject) => {
    const req = request(new URL('/api/health', url), { ca, agent: false, timeout: 10000 }, response => {
      let body = ''
      response.setEncoding('utf8').on('data', chunk => { body += chunk }).on('end', () => resolve({ status: response.statusCode, body }))
    })
    req.on('error', reject).on('timeout', () => req.destroy(new Error('Smoke health timeout')))
    req.end()
  })
}
// Free services may cold-start. Retry liveness only, within an absolute deadline.
const deadline = Date.now() + 120000
let ready = false
while (Date.now() < deadline) {
  try {
    const response = await health()
    ready = response.status === 200 && JSON.parse(response.body).status === 'ok'
    if (ready) break
  } catch { /* Liveness only; TLS is always verified, including a local test CA. */ }
  await new Promise(resolve => setTimeout(resolve, 2000))
}
assert.ok(ready, 'Django health must respond over verified TLS within 120 seconds')
const { chromium } = createRequire(new URL('../frontend/package.json', import.meta.url))('@playwright/test')
const browser = await chromium.launch()
let page
const errors = [], failed = [], bad = []
try {
  // Public smoke never bypasses certificate validation. Local disposable testing
  // verifies TLS above, then scopes its fictional CA exception to this context.
  const context = await browser.newContext({ ignoreHTTPSErrors: Boolean(localCa), viewport: { width: 1440, height: 1000 }, locale: 'es-ES' })
  context.setDefaultTimeout(15000)
  const bootstrap = await context.request.get(new URL('/api/session', url).href)
  assert.equal(bootstrap.status(), 200)
  assert.equal((await bootstrap.json()).demoSignInAvailable, true, 'Refuse sign-in unless the server advertises its guarded fictional demo')
  const csrf = (await context.cookies()).find(cookie => cookie.name === 'csrftoken')
  assert.ok(csrf?.secure && csrf.sameSite === 'Lax', 'Production CSRF cookie must be Secure/Lax')
  page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('requestfailed', req => failed.push(new URL(req.url()).pathname))
  page.on('response', response => { if (response.status() >= 400) bad.push(`${response.status()} ${new URL(response.url()).pathname}`) })
  const html = await page.goto(url.origin)
  assert.equal(html.status(), 200)
  assert.match(html.headers()['cache-control'], /no-store/)
  assert.match(html.headers()['x-robots-tag'], /noindex/)
  assert.equal(html.headers()['x-frame-options'], 'DENY')
  await page.getByRole('heading', { name: 'Versión de demostración', exact: true }).waitFor()
  // Observe every concurrent operation immediately: a missing home request must
  // not become an unhandled rejection that hides a failed sign-in or click.
  await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/home' && response.request().method() === 'GET')
      .then(response => assert.equal(response.status(), 200, 'Home API after demo sign-in')),
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/demo' && response.request().method() === 'POST')
      .then(response => assert.equal(response.status(), 204, 'Demo sign-in API')),
    page.getByRole('button', { name: 'Entrar con una cuenta de prueba', exact: true }).click(),
  ])
  await page.getByRole('heading', { name: 'Inicio', exact: true }).waitFor()
  const session = await context.request.get(new URL('/api/session', url).href)
  const identity = await session.json()
  assert.equal(identity.status, 'signedIn')
  assert.equal(identity.user.role, 'member')
  const cookie = (await context.cookies()).find(value => value.name === 'sessionid')
  assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax', 'Production session must be Secure/HttpOnly/Lax')
  const books = page.waitForResponse(response => new URL(response.url()).pathname === '/api/books' && response.request().method() === 'GET')
  await page.goto(new URL('/biblioteca', url).href)
  assert.equal((await books).status(), 200)
  await page.getByRole('heading', { name: 'Biblioteca', exact: true }).waitFor()
  assert.equal((await context.request.get(new URL('/api/books', url).href)).status(), 200)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  if (process.env.SMOKE_SCREENSHOT) await page.screenshot({ path: process.env.SMOKE_SCREENSHOT, fullPage: true })
  const logout = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/logout' && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  assert.equal((await logout).status(), 204)
  const anonymous = await context.request.get(new URL('/api/session', url).href)
  assert.equal((await anonymous.json()).status, 'anonymous')
  assert.deepEqual(errors, [])
  assert.deepEqual(failed, [])
  assert.deepEqual(bad, [])
  console.log(`PASS: verified TLS, fictional member UI sign-in/library/sign-out, Secure cookies and browser/network checks at ${url.origin}`)
} catch (error) {
  // Report paths/statuses only; never dump headers, cookies or response bodies.
  console.error('Smoke network failures:', JSON.stringify({ failed, bad }))
  if (page && process.env.SMOKE_SCREENSHOT) {
    try { await page.screenshot({ path: process.env.SMOKE_SCREENSHOT, fullPage: true, timeout: 5000 }) }
    catch { console.error('Smoke failure screenshot unavailable') }
  }
  throw error
} finally {
  await browser.close()
}
