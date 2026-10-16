// Source tags attest successful delivery, never immutable container bytes.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ReleaseFailure, targets, trustedPush } from './release.mjs'

const repository = 'rferper/small-bookclub'
export async function recordRelease(env, { fetch: send = globalThis.fetch, log = console.log } = {}) {
  if (!trustedPush(env)) return { recorded: false }
  const sha = env.RELEASE_SHA
  if (!/^[a-f0-9]{40}$/u.test(sha ?? '') || sha !== env.GITHUB_SHA
    || env.STAGING_DELIVERED !== 'true' || env.PRODUCTION_DELIVERED !== 'true'
    || !env.GITHUB_TOKEN || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new ReleaseFailure('tag-configuration')
  }
  const tag = `release-${sha}`
  const refUrl = `https://api.github.com/repos/${repository}/git/ref/tags/${tag}`
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.GITHUB_TOKEN}` }
  const github = (url, options = {}) => send(url, { ...options, headers: { ...headers, ...options.headers },
    redirect: 'error', signal: AbortSignal.timeout(10000) })
  const matches = async response => {
    if (response.status !== 200) return false
    const ref = await response.json()
    return ref.ref === `refs/tags/${tag}` && ref.object?.type === 'commit' && ref.object.sha === sha
  }
  const currentMain = async () => {
    const current = await github(`https://api.github.com/repos/${repository}/commits/main`)
    if (current.status !== 200) throw new Error()
    const currentSha = (await current.json()).sha
    if (!/^[a-f0-9]{40}$/u.test(currentSha ?? '')) throw new Error()
    return currentSha === sha
  }
  try {
    if (!await currentMain()) return { recorded: false }
    // No credentials accompany public reads. Both must still identify this candidate.
    for (const [environment, target] of Object.entries(targets)) {
      const options = { redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store' }
      const root = await send(`${target.origin}/`, { ...options, method: 'HEAD' })
      if (root.status !== 200 || root.headers.get('x-bookclub-revision') !== sha) throw new Error()
      const health = await send(`${target.origin}/api/health`, { ...options, signal: AbortSignal.timeout(10000) })
      const identity = await health.json()
      if (health.status !== 200 || identity.status !== 'ok' || identity.environment !== environment || identity.version !== tag) throw new Error()
    }
    const existing = await github(refUrl)
    if (existing.status !== 404) {
      if (!await matches(existing)) throw new Error()
    } else {
      if (!await currentMain()) return { recorded: false }
      const created = await github(`https://api.github.com/repos/${repository}/git/refs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/tags/${tag}`, sha }),
      })
      // An uncertain write is never repeated. A 422 may be a concurrent creation;
      // verify its exact ref rather than updating or deleting it.
      if (created.status !== 201 && created.status !== 422) throw new Error()
      if (!await matches(await github(refUrl))) throw new Error()
    }
    log(`PASS: recorded ${tag}`)
    return { recorded: true, tag, sha }
  } catch { throw new ReleaseFailure('record-release') }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await recordRelease(process.env) }
  catch { console.error('Delivery failed: record-release'); process.exitCode = 1 }
}
