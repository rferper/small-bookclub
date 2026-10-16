import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { release, hookFor, targets, trustedPush, smokeEnvironment } from './release.mjs'
import { networkFailureCode } from '../smoke-diagnostics.mjs'

const { parse } = createRequire(new URL('../../frontend/package.json', import.meta.url))('yaml')
const sha = 'a'.repeat(40), other = 'b'.repeat(40)
const secret = 'fictional-deploy-hook-secret'
test('smoke network diagnostics retain a fixed code without reflecting secret-bearing text', () => {
  assert.equal(networkFailureCode('net::ERR_CONNECTION_RESET'), 'ERR_CONNECTION_RESET')
  for (const text of [undefined, secret, `net::ERR_CONNECTION_RESET Cookie: ${secret}`, `net::${secret}`]) {
    assert.equal(networkFailureCode(text), 'UNKNOWN_NETWORK_FAILURE')
  }
})
const environment = changes => ({
  GITHUB_REPOSITORY: 'rferper/small-bookclub', GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'push', CI_PASSED: 'true', GITHUB_SHA: sha, RELEASE_SHA: sha,
  RELEASE_TARGET: 'staging', GITHUB_TOKEN: 'fictional-github-token',
  RENDER_DEPLOY_HOOK: `https://api.render.com/deploy/${targets.staging.id}?key=${secret}`,
  ...changes,
})
function harness({ revisions = [sha], main = [sha], triggerStatus = 200, triggerBody = { deploy: { id: 'dep-fictional123' } }, smokeFails = false, healthFails = false } = {}) {
  const calls = [], logs = [], smokes = []
  let time = 0, revisionIndex = 0, mainIndex = 0
  return {
    calls, logs, smokes,
    dependencies: {
      now: () => time, sleep: async ms => { time += ms }, readinessMs: 15000,
      log: message => logs.push(message),
      smoke: async (origin, expected) => { smokes.push({ origin, expected }); if (smokeFails) throw new Error(secret) },
      fetch: async (input, options = {}) => {
        const url = new URL(input)
        calls.push({ url, options })
        assert.equal(options.redirect, 'error')
        assert.ok(options.signal)
        if (url.hostname === 'api.github.com') return Response.json({ sha: main[Math.min(mainIndex++, main.length - 1)] })
        if (url.hostname === 'api.render.com') return Response.json(triggerBody, { status: triggerStatus })
        if (url.pathname === '/') return new Response(null, { headers: { 'X-Bookclub-Revision': revisions[Math.min(revisionIndex++, revisions.length - 1)] } })
        if (url.pathname === '/api/health') return Response.json({ status: healthFails ? 'unready' : 'ok' })
        throw new Error('Unexpected fake request')
      },
    },
  }
}

test('exact tested SHA is posted once and native smoke waits for served revision and health', async () => {
  const h = harness({ revisions: [other, other, sha] })
  const result = await release(environment(), h.dependencies)
  assert.equal(result.delivered, true)
  const posts = h.calls.filter(c => c.options.method === 'POST')
  assert.equal(posts.length, 1)
  assert.equal(posts[0].url.searchParams.get('ref'), sha)
  assert.equal(posts[0].url.pathname, `/deploy/${targets.staging.id}`)
  assert.equal(h.calls.filter(c => c.options.method === 'HEAD').length, 3)
  assert.deepEqual(h.smokes, [{ origin: targets.staging.origin, expected: sha }])
  assert.equal(h.logs.some(line => line.includes(secret)), false)
})

for (const change of [
  { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_EVENT_NAME: 'pull_request_target' },
  { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/heads/issue-77' },
  { GITHUB_REPOSITORY: 'fictional/fork' }, { CI_PASSED: 'false' }, { CI_PASSED: '' },
]) test(`untrusted event is skipped without network or smoke: ${JSON.stringify(change)}`, async () => {
  const h = harness()
  assert.equal(trustedPush(environment(change)), false)
  assert.equal((await release(environment(change), h.dependencies)).delivered, false)
  assert.equal(h.calls.length, 0)
  assert.equal(h.smokes.length, 0)
})

test('a superseded main commit cannot trigger deployment', async () => {
  const h = harness({ main: [other] })
  assert.equal((await release(environment(), h.dependencies)).reason, 'superseded')
  assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 0)
})
test('production uses only its own service hook and public origin', async () => {
  const h = harness()
  const result = await release(environment({ RELEASE_TARGET: 'production-demo',
    RENDER_DEPLOY_HOOK: `https://api.render.com/deploy/${targets['production-demo'].id}?key=${secret}` }), h.dependencies)
  assert.equal(result.delivered, true)
  assert.equal(h.calls.find(c => c.options.method === 'POST').url.pathname, `/deploy/${targets['production-demo'].id}`)
  assert.equal(h.smokes[0].origin, targets['production-demo'].origin)
})

test('a provider key shorter than sixteen characters can deliver without being logged', async () => {
  const key = 'fixtureAb12'
  const h = harness()
  const result = await release(environment({
    RENDER_DEPLOY_HOOK: `https://api.render.com/deploy/${targets.staging.id}?key=${key}`,
  }), h.dependencies)
  assert.equal(result.delivered, true)
  assert.equal(h.calls.find(c => c.options.method === 'POST').url.searchParams.get('key'), key)
  assert.equal(h.logs.some(line => line.includes(key)), false)
})
test('an invalid GitHub main response fails before the secret hook is used', async () => {
  const h = harness({ main: ['not-a-sha'] })
  await assert.rejects(release(environment(), h.dependencies), { code: 'current-main' })
  assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 0)
})
test('main advancing during staging cannot authorize production promotion', async () => {
  const h = harness({ main: [sha, other] })
  assert.equal((await release(environment(), h.dependencies)).delivered, false)
  assert.equal(h.smokes.length, 1)
})

for (const raw of [
  `http://api.render.com/deploy/${targets.staging.id}?key=${secret}`,
  `https://example.invalid/deploy/${targets.staging.id}?key=${secret}`,
  `https://api.render.com/deploy/${targets['production-demo'].id}?key=${secret}`,
  `https://user:password@api.render.com/deploy/${targets.staging.id}?key=${secret}`,
  `https://api.render.com/deploy/${targets.staging.id}?key=${secret}&ref=${sha}`,
  `https://api.render.com/deploy/${targets.staging.id}?key=${secret}&key=duplicate`,
  `https://api.render.com/deploy/${targets.staging.id}?key=`,
  `https://api.render.com/deploy/${targets.staging.id}?key=invalid%20key`,
  `https://api.render.com/deploy/${targets.staging.id}?key=${'x'.repeat(257)}`,
  `https://api.render.com/deploy/${targets.staging.id}?key=${secret}#fragment`,
]) test('invalid or wrong-target hook fails closed without leaking it', () => {
  assert.throws(() => hookFor(raw, targets.staging, sha), error => error.code === 'invalid-hook' && !String(error).includes(secret) && !error.cause)
})

for (const change of [
  { RELEASE_TARGET: 'private-club' }, { RELEASE_TARGET: '__proto__' }, { RELEASE_SHA: 'abc123' }, { RELEASE_SHA: other },
  { NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { GITHUB_TOKEN: '' },
]) test('invalid release configuration triggers zero requests', async () => {
  const h = harness()
  await assert.rejects(release(environment(change), h.dependencies))
  assert.equal(h.calls.length, 0)
})

for (const status of [202, 301, 401, 409, 500]) test(`failed/ambiguous trigger ${status} never starts readiness or smoke`, async () => {
  const h = harness({ triggerStatus: status })
  await assert.rejects(release(environment(), h.dependencies), { code: 'trigger' })
  assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 1)
  assert.equal(h.calls.some(c => c.options.method === 'HEAD'), false)
  assert.equal(h.smokes.length, 0)
})
test('a trigger without a deployment identifier is failure', async () => {
  const h = harness({ triggerBody: {} })
  await assert.rejects(release(environment(), h.dependencies), { code: 'trigger' })
  assert.equal(h.smokes.length, 0)
})
test('the old healthy instance cannot pass candidate readiness', async () => {
  const h = harness({ revisions: [other] })
  await assert.rejects(release(environment(), h.dependencies), { code: 'candidate-readiness' })
  assert.equal(h.smokes.length, 0)
  assert.equal(h.calls.filter(c => c.options.method === 'POST').length, 1)
})
test('candidate header without successful migrated health never passes', async () => {
  const h = harness({ healthFails: true })
  await assert.rejects(release(environment(), h.dependencies), { code: 'candidate-readiness' })
  assert.equal(h.smokes.length, 0)
})
test('an uncertain POST is not retried and raw secret-bearing errors are suppressed', async () => {
  const h = harness(), original = h.dependencies.fetch
  h.dependencies.fetch = async (input, options) => {
    if (options?.method === 'POST') throw new Error(`Cookie: ${secret}`)
    return original(input, options)
  }
  await assert.rejects(release(environment(), h.dependencies), error => error.code === 'trigger' && !String(error).includes(secret) && !error.cause)
  assert.equal(h.smokes.length, 0)
})
test('native smoke failure cannot report delivered or leak its cause', async () => {
  const h = harness({ smokeFails: true })
  await assert.rejects(release(environment(), h.dependencies), error => error.code === 'native-smoke' && !String(error).includes(secret) && !error.cause)
  assert.equal(h.logs.some(line => line.startsWith('PASS')), false)
})
test('smoke subprocess receives no release/GitHub secrets, test CA or TLS override', () => {
  const child = smokeEnvironment({ PATH: 'fixture-path', RENDER_DEPLOY_HOOK: secret, GITHUB_TOKEN: secret,
    GH_TOKEN: secret, RENDER_API_KEY: secret, SMOKE_LOCAL_CA: secret, NODE_TLS_REJECT_UNAUTHORIZED: '0' }, targets.staging.origin, 'fixture.png')
  assert.equal(Object.values(child).some(value => value === secret || value === '0'), false)
  assert.equal(child.DEMO_URL, targets.staging.origin)
  assert.equal(child.PATH, 'fixture-path')
})

const ci = parse(readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'))
const cd = parse(readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8'))
const evaluate = (expression, github, needs, inputs = {}) => Function('github', 'needs', 'inputs', `return (${expression})`)(github, needs, inputs)
const github = { repository: 'rferper/small-bookclub', ref: 'refs/heads/main', event_name: 'push' }
test('actual caller and reusable guards require trusted main success, including production staging output', () => {
  for (const event of ['push', 'pull_request', 'pull_request_target', 'workflow_dispatch']) {
    for (const ref of ['refs/heads/main', 'refs/heads/issue-77']) {
      for (const result of ['success', 'failure', 'cancelled', 'skipped']) {
        const g = { ...github, ref, event_name: event }, expected = event === 'push' && ref === github.ref && result === 'success'
        assert.equal(evaluate(ci.jobs.deploy.if, g, { required: { result } }), expected)
        assert.equal(evaluate(cd.jobs.staging.if, g, {}, { ci_passed: result === 'success' }), expected)
        assert.equal(evaluate(cd.jobs['production-demo'].if, g, { staging: { outputs: { delivered: 'true' } } }, { ci_passed: result === 'success' }), expected)
      }
    }
  }
  assert.equal(evaluate(cd.jobs['production-demo'].if, github, { staging: { outputs: { delivered: 'false' } } }, { ci_passed: true }), false)
  assert.equal(evaluate(ci.jobs.deploy.if, { ...github, repository: 'fictional/fork' }, { required: { result: 'success' } }), false)
  assert.equal(ci.jobs.deploy.needs, 'required')
  assert.equal(cd.jobs['production-demo'].needs, 'staging')
})
test('secrets remain step-scoped and each target receives only its own hook', () => {
  assert.deepEqual(cd.permissions, { contents: 'read' })
  for (const [id, hook] of [['staging', 'RENDER_STAGING_DEPLOY_HOOK'], ['production-demo', 'RENDER_DEMO_DEPLOY_HOOK']]) {
    const job = cd.jobs[id]
    assert.equal(job.env, undefined)
    for (const step of job.steps.filter(s => s.run !== 'node deploy/render/release.mjs')) assert.equal(step.env, undefined)
    const releaseStep = job.steps.find(s => s.run === 'node deploy/render/release.mjs')
    assert.equal(releaseStep.env.RENDER_DEPLOY_HOOK, `\${{ secrets.${hook} }}`)
    assert.equal(job.steps.find(s => s.uses?.startsWith('actions/checkout')).with['persist-credentials'], false)
  }
  const cancellation = ci.concurrency['cancel-in-progress'].replace(/^\$\{\{\s*|\s*\}\}$/gu, '')
  assert.equal(evaluate(cancellation, github, {}), false)
  assert.equal(evaluate(cancellation, { ...github, ref: 'refs/heads/issue-77' }, {}), true)
})
