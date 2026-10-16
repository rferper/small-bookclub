// Service-scoped delivery only; never print provider URLs, tokens or raw errors.
import { appendFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

export const targets = Object.freeze({
  staging: Object.freeze({ id: 'srv-db8tjebbc2fs73c55du0', origin: 'https://small-bookclub-staging.onrender.com' }),
  'production-demo': Object.freeze({ id: 'srv-db8tjebbc2fs73c55dtg', origin: 'https://small-bookclub-demo.onrender.com' }),
})
const repository = 'rferper/small-bookclub'
const shaPattern = /^[a-f0-9]{40}$/u
export class ReleaseFailure extends Error {
  constructor(code) { super(`Delivery failed: ${code}`); this.code = code }
}
const requireValue = (value, code) => { if (!value) throw new ReleaseFailure(code) }

export function trustedPush(env) {
  return env.GITHUB_REPOSITORY === repository && env.GITHUB_REF === 'refs/heads/main'
    && env.GITHUB_EVENT_NAME === 'push' && env.CI_PASSED === 'true'
}
export function hookFor(raw, target, sha) {
  try {
    const url = new URL(raw)
    requireValue(url.protocol === 'https:' && url.hostname === 'api.render.com' && !url.port
      && !url.username && !url.password && !url.hash && url.pathname === `/deploy/${target.id}`
      && [...url.searchParams.keys()].length === 1 && url.searchParams.has('key')
      && /^[a-zA-Z0-9_-]{1,256}$/u.test(url.searchParams.get('key') ?? '') && shaPattern.test(sha), 'invalid-hook')
    url.searchParams.set('ref', sha)
    return url
  } catch { throw new ReleaseFailure('invalid-hook') }
}
export function smokeEnvironment(parent, origin, screenshot) {
  const env = {}
  // Do not pass deployment or GitHub credentials, test CAs or TLS overrides.
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE',
    'LOCALAPPDATA', 'APPDATA', 'PLAYWRIGHT_BROWSERS_PATH']) {
    if (parent[key]) env[key] = parent[key]
  }
  return { ...env, CI: 'true', DEMO_URL: origin, SMOKE_SCREENSHOT: screenshot }
}
export function nativeSmoke(origin, sha, parent = process.env) {
  const env = smokeEnvironment(parent, origin, parent.RELEASE_SCREENSHOT)
  env.SMOKE_EXPECTED_REVISION = sha
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../smoke-demo.mjs', import.meta.url))], {
    env, timeout: 180000, stdio: 'inherit',
  })
  requireValue(!result.error && result.status === 0, 'native-smoke')
}

export async function release(env, {
  fetch: send = globalThis.fetch, now = () => performance.now(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  smoke = (origin, sha) => nativeSmoke(origin, sha, env), log = console.log,
  readinessMs = 600000,
} = {}) {
  if (!trustedPush(env)) return { delivered: false, reason: 'untrusted-event' }
  const target = Object.hasOwn(targets, env.RELEASE_TARGET) ? targets[env.RELEASE_TARGET] : undefined
  const sha = env.RELEASE_SHA
  requireValue(target && shaPattern.test(sha ?? '') && sha === env.GITHUB_SHA, 'invalid-target-or-revision')
  requireValue(env.NODE_TLS_REJECT_UNAUTHORIZED !== '0' && env.GITHUB_TOKEN, 'invalid-security-configuration')
  const hook = hookFor(env.RENDER_DEPLOY_HOOK, target, sha)
  let phase = 'current-main'
  const currentMain = async () => {
    const response = await send(`https://api.github.com/repos/${repository}/commits/main`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.GITHUB_TOKEN}` },
      redirect: 'error', signal: AbortSignal.timeout(10000),
    })
    requireValue(response.status === 200, 'current-main')
    const current = (await response.json()).sha
    requireValue(shaPattern.test(current ?? ''), 'current-main')
    return current === sha
  }
  try {
    if (!await currentMain()) return { delivered: false, reason: 'superseded' }
    phase = 'trigger'
    const triggered = await send(hook, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000) })
    // 202 may queue without an ID. An uncertain trigger is never retried blindly.
    requireValue(triggered.status === 200, 'trigger')
    const deployId = (await triggered.json()).deploy?.id
    requireValue(/^dep-[a-z0-9]+$/u.test(deployId ?? ''), 'trigger-response')
    log(`Started ${env.RELEASE_TARGET} ${deployId} at ${sha}`)
    phase = 'candidate-readiness'
    const deadline = now() + readinessMs
    let ready = false
    while (now() < deadline) {
      try {
        const timeout = () => AbortSignal.timeout(Math.max(1, Math.min(10000, Math.ceil(deadline - now()))))
        const root = await send(`${target.origin}/`, { method: 'HEAD', redirect: 'error', signal: timeout(), cache: 'no-store' })
        if (root.status === 200 && root.headers.get('x-bookclub-revision') === sha && now() < deadline) {
          const health = await send(`${target.origin}/api/health`, { redirect: 'error', signal: timeout(), cache: 'no-store' })
          ready = health.status === 200 && (await health.json()).status === 'ok' && now() <= deadline
          if (ready) break
        }
      } catch { /* Only readiness reads retry; public TLS is never bypassed. */ }
      if (now() < deadline) await sleep(Math.min(5000, deadline - now()))
    }
    requireValue(ready, 'candidate-readiness')
    phase = 'native-smoke'
    await smoke(target.origin, sha)
    phase = 'current-main'
    if (!await currentMain()) return { delivered: false, reason: 'superseded' }
    log(`PASS: ${env.RELEASE_TARGET} ${sha} is live and passed native HTTPS smoke`)
    return { delivered: true, sha, target: env.RELEASE_TARGET, deployId }
  } catch { throw new ReleaseFailure(phase) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await release(process.env)
    if (!result.delivered) console.log(`Skipped delivery: ${result.reason}`)
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `delivered=${result.delivered}\n`)
  } catch (error) {
    console.error(error instanceof ReleaseFailure ? error.message : 'Delivery failed: internal-failure')
    process.exitCode = 1
  }
}
