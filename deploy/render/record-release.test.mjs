import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { recordRelease } from './record-release.mjs'
import { targets } from './release.mjs'

const sha = 'a'.repeat(40), other = 'b'.repeat(40), secret = 'fictional-tag-token'
const env = changes => ({ GITHUB_REPOSITORY: 'rferper/small-bookclub', GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'push', CI_PASSED: 'true', GITHUB_SHA: sha, RELEASE_SHA: sha,
  STAGING_DELIVERED: 'true', PRODUCTION_DELIVERED: 'true', GITHUB_TOKEN: secret, ...changes })
function harness({ existing = null, postStatus = 201, current = sha, version = `release-${sha}`,
  world, rootRevision = sha, readStatus = 200, throwOnPost = false } = {}) {
  const calls = [], logs = []
  let tag = existing, mainIndex = 0
  return { calls, logs, dependencies: {
    log: message => logs.push(message),
    fetch: async (input, options = {}) => {
      const url = new URL(input)
      calls.push({ url, options })
      assert.equal(options.redirect, 'error')
      assert.ok(options.signal)
      if (url.hostname !== 'api.github.com') {
        assert.equal(options.headers, undefined, 'Public requests must not receive GitHub credentials')
        if (url.pathname === '/') return new Response(null, { headers: { 'x-bookclub-revision': rootRevision } })
        const environment = world ?? (url.origin === targets.staging.origin ? 'staging' : 'production-demo')
        return Response.json({ status: 'ok', version, environment })
      }
      assert.equal(options.headers.Authorization, `Bearer ${secret}`)
      if (url.pathname.endsWith('/commits/main')) return Response.json({ sha: Array.isArray(current) ? current[Math.min(mainIndex++, current.length - 1)] : current })
      if (options.method === 'POST') {
        if (throwOnPost) throw new Error(secret)
        const body = JSON.parse(options.body)
        assert.deepEqual(body, { ref: `refs/tags/release-${sha}`, sha })
        if ([201, 422].includes(postStatus)) tag = { ref: body.ref, object: { type: 'commit', sha } }
        return Response.json({}, { status: postStatus })
      }
      return tag ? Response.json(tag, { status: readStatus }) : Response.json({}, { status: 404 })
    },
  } }
}

test('both live candidate identities and delivered outputs precede exact immutable tag creation', async () => {
  const h = harness()
  assert.deepEqual(await recordRelease(env(), h.dependencies), { recorded: true, tag: `release-${sha}`, sha })
  assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 1)
  assert.equal(h.calls.filter(c => c.url.pathname === '/api/health').length, 2)
  assert.equal(h.calls.some(c => ['PATCH', 'DELETE', 'PUT'].includes(c.options.method)), false)
  assert.equal(h.logs.join('').includes(secret), false)
})

for (const change of [{ GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_EVENT_NAME: 'pull_request_target' },
  { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/tags/fictional' },
  { GITHUB_REF: 'refs/heads/feature' }, { GITHUB_REPOSITORY: 'fictional/fork' }, { CI_PASSED: 'false' }]) {
  test('untrusted contexts cannot read or create release tags', async () => {
    const h = harness()
    assert.equal((await recordRelease(env(change), h.dependencies)).recorded, false)
    assert.equal(h.calls.length, 0)
  })
}
for (const change of [{ STAGING_DELIVERED: 'false' }, { PRODUCTION_DELIVERED: '' },
  { PRODUCTION_DELIVERED: 'false' }, { RELEASE_SHA: other }, { RELEASE_SHA: 'secret-invalid' },
  { GITHUB_TOKEN: '' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' }]) {
  test('invalid metadata or failed/skipped delivery cannot reach the tag API', async () => {
    const h = harness()
    await assert.rejects(recordRelease(env(change), h.dependencies), error => error.code === 'tag-configuration' && !String(error).includes('secret-invalid'))
    assert.equal(h.calls.length, 0)
  })
}
test('superseded main cannot record a release', async () => {
  const h = harness({ current: other })
  assert.equal((await recordRelease(env(), h.dependencies)).recorded, false)
  assert.equal(h.calls.length, 1)
})
test('main advancing during live verification cannot create a release tag', async () => {
  const h = harness({ current: [sha, other] })
  assert.equal((await recordRelease(env(), h.dependencies)).recorded, false)
  assert.equal(h.calls.filter(c => c.url.pathname.endsWith('/commits/main')).length, 2)
  assert.equal(h.calls.some(c => c.options.method === 'POST'), false)
})
for (const change of [{ version: 'unversioned' }, { version: `release-${other}` },
  { world: 'staging' }, { rootRevision: other }, { current: secret }]) {
  test('old or mislabeled live candidates cannot create a tag', async () => {
    const h = harness(change)
    await assert.rejects(recordRelease(env(), h.dependencies), { code: 'record-release' })
    assert.equal(h.calls.some(c => c.options.method === 'POST'), false)
  })
}
test('a matching existing tag is idempotent and never mutated', async () => {
  const h = harness({ existing: { ref: `refs/tags/release-${sha}`, object: { type: 'commit', sha } } })
  assert.equal((await recordRelease(env(), h.dependencies)).recorded, true)
  assert.equal(h.calls.some(c => c.options.method === 'POST'), false)
})
for (const existing of [
  { ref: `refs/tags/release-${sha}`, object: { type: 'commit', sha: other } },
  { ref: `refs/tags/release-${sha}`, object: { type: 'tag', sha } },
  { ref: 'refs/tags/other', object: { type: 'commit', sha } },
]) test('a conflicting ref fails without force/update/delete', async () => {
  const h = harness({ existing })
  await assert.rejects(recordRelease(env(), h.dependencies), { code: 'record-release' })
  assert.equal(h.calls.some(c => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.options.method)), false)
})
test('concurrent identical tag creation is verified after 422', async () => {
  const h = harness({ postStatus: 422 })
  assert.equal((await recordRelease(env(), h.dependencies)).recorded, true)
  assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 1)
})
for (const change of [{ throwOnPost: true }, { postStatus: 403 }, { postStatus: 500 }, { readStatus: 500 }]) {
  test('write/read failures stay failed, bounded and secret-safe without a second write', async () => {
    const h = harness(change)
    await assert.rejects(recordRelease(env(), h.dependencies), error => error.code === 'record-release' && !String(error).includes(secret) && !error.cause)
    assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 1)
    assert.equal(h.logs.length, 0)
  })
}

const { parse } = createRequire(new URL('../../frontend/package.json', import.meta.url))('yaml')
const ci = parse(readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'))
const cd = parse(readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8'))
test('actual workflow records tags only after both deliveries with isolated write permissions and no hooks', () => {
  const job = cd.jobs['record-release']
  assert.deepEqual(job.needs, ['staging', 'production-demo'])
  assert.deepEqual(cd.permissions, { contents: 'read' })
  assert.deepEqual(job.permissions, { contents: 'write' })
  assert.deepEqual(ci.jobs.deploy.permissions, { contents: 'write' })
  assert.deepEqual(ci.permissions, { contents: 'read' })
  assert.deepEqual(ci.on.push.branches, ['**'])
  assert.equal(ci.on.push.tags, undefined)
  for (const id of ['staging', 'production-demo']) {
    assert.equal(cd.jobs[id].permissions, undefined)
    assert.equal(cd.jobs[id].outputs.delivered, '${{ steps.release.outputs.delivered }}')
  }
  for (const event_name of ['push', 'pull_request', 'workflow_dispatch']) {
    for (const ref of ['refs/heads/main', 'refs/heads/feature', `refs/tags/release-${sha}`]) {
      for (const staging of ['true', 'false', '']) for (const production of ['true', 'false', '']) {
        for (const ci_passed of [true, false]) {
          const github = { event_name, ref, repository: 'rferper/small-bookclub' }
          const needs = { staging: { outputs: { delivered: staging } }, 'production-demo': { outputs: { delivered: production } } }
          const actual = Function('github', 'needs', 'inputs', `return (${job.if})`)(github, needs, { ci_passed })
          assert.equal(actual, ci_passed && event_name === 'push' && ref === 'refs/heads/main' && staging === 'true' && production === 'true')
        }
      }
    }
  }
  assert.equal(job.steps.find(s => s.uses?.startsWith('actions/checkout')).with['persist-credentials'], false)
  for (const step of job.steps) {
    if (step.run === 'node deploy/render/record-release.mjs') {
      assert.equal(step.env.GITHUB_TOKEN, '${{ github.token }}')
      assert.equal(step.env.PRODUCTION_DELIVERED, '${{ needs.production-demo.outputs.delivered }}')
    } else assert.equal(step.env, undefined)
    assert.equal(JSON.stringify(step).includes('secrets.'), false)
  }
})
