// Own only a uniquely named disposable Compose project; never use the owner's stack.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const project = `bookclub-e2e-${process.pid}-${randomBytes(4).toString('hex')}`
const reservations = []
async function allocatePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  reservations.push(server)
  return server.address().port
}
const port = await allocatePort()
const providerPort = await allocatePort()
await Promise.all(reservations.map(server => new Promise(resolve => server.close(resolve))))
const env = { ...process.env, BOOKCLUB_PORT: String(port), BOOKCLUB_PROVIDER_PORT: String(providerPort), DEMO_MODE: 'false' }
const compose = ['compose', '-p', project, '-f', 'docker-compose.yml', '-f', 'tests/e2e/compose.yml']
function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, { cwd: root, env, stdio: 'inherit', timeout: 300000, ...options })
  if (result.error || result.status !== 0) throw new Error(`${binary} failed (${result.status}): ${result.error?.message ?? ''}`)
  return result
}
let failed = false
try {
  console.log(`Disposable browser stack: ${project} at http://localhost:${port}`)
  command('docker', [...compose, 'up', '--build', '-d', '--wait', '--wait-timeout', '180'])
  const seed = command('docker', [...compose, 'exec', '-T', 'backend', 'python', '/e2e/fixtures.py'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  command(process.execPath, [resolve(root, 'frontend/node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.e2e.config.ts'], {
    cwd: resolve(root, 'frontend'),
    env: { ...env, E2E_BASE_URL: `http://localhost:${port}`, E2E_PROVIDER_URL: `http://localhost:${providerPort}`, E2E_WORLD: seed.stdout.trim() },
    timeout: 240000,
  })
  command('docker', [...compose, 'exec', '-T', 'backend', 'python', '/e2e/fixtures.py', '--verify'])
} catch (error) {
  failed = true
  console.error(error.message)
} finally {
  try { command('docker', [...compose, 'down', '--volumes', '--remove-orphans'], { timeout: 60000 }) }
  catch (error) { failed = true; console.error(`Cleanup failed for ${project}: ${error.message}`) }
}
process.exitCode = failed ? 1 : 0
