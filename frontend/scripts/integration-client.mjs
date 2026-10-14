// Real HTTP bridge: Vite loads the production adapter; no mock API or fake fetch.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

let input = ''
for await (const chunk of process.stdin) input += chunk
const world = JSON.parse(input)
const origin = new URL(world.origin)
assert.equal(origin.hostname, 'localhost')
const server = await createServer({
  configFile: false, logLevel: 'silent',
  server: { middlewareMode: true, watch: null, hmr: false },
  optimizeDeps: { noDiscovery: true },
})
try {
  const { createHttpClient } = await server.ssrLoadModule('/src/api/httpClient.ts')
  const jar = new Map()
  const trace = []
  const cookies = () => [...jar].map(([key, value]) => `${key}=${value}`).join('; ')
  const send = async (path, options) => {
    const headers = new Headers(options.headers)
    headers.set('Cookie', cookies())
    headers.set('Origin', origin.origin)
    const response = await fetch(new URL(path, origin), { ...options, headers, redirect: 'manual' })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]
      const split = pair.indexOf('=')
      jar.set(pair.slice(0, split), pair.slice(split + 1))
    }
    const text = await response.clone().text()
    trace.push({ path: new URL(path, origin).pathname, method: options.method.toLowerCase(), status: response.status, body: text ? JSON.parse(text) : null })
    return response
  }
  const client = createHttpClient({ fetch: send, cookie: cookies })
  assert.equal((await client.getSession()).status, 'anonymous')
  await assert.rejects(client.getMyProfile(), { status: 401 })
  jar.set('sessionid', world.session)
  assert.equal((await client.getSession()).status, 'signedIn')
  await assert.rejects(client.getAdminMembers(), { status: 403 })

  const before = await client.getBookRatings(world.book)
  assert.ok(!JSON.stringify(before).includes('FOREIGN_REVIEW_SENTINEL'))
  assert.ok(!JSON.stringify(trace.at(-1).body).includes('FOREIGN_REVIEW_SENTINEL'))
  const locked = await client.getMeeting(world.meeting)
  assert.ok(!JSON.stringify(locked).includes('SUMMARY_SENTINEL'))
  assert.ok(!JSON.stringify(trace.at(-1).body).includes('SUMMARY_SENTINEL'))
  await client.updateMyProfile({
    displayName: 'Lector ficticio actualizado', bio: 'Biografia ficticia',
    favouriteQuote: null, favouriteBookIds: [], avatar: { action: 'keep' },
  })
  assert.equal((await client.getMyProfile()).member.displayName, 'Lector ficticio actualizado')
  await client.setWeekCompleted(world.week, true)
  assert.ok(JSON.stringify(await client.getMeeting(world.meeting)).includes('SUMMARY_SENTINEL'))
  await client.setApproval(world.vote, world.candidate, true)
  await client.setBookFinished(world.book, true)
  await client.getBookRatings(world.book)
  assert.ok(!JSON.stringify(trace.at(-1).body).includes('FOREIGN_REVIEW_SENTINEL'))
  await client.saveMyReview(world.book, {
    scores: { disfrute: 5, estilo: 4.5, personajes: 3, trama: 4, huella: 2.5 },
    text: 'Resena ficticia propia',
  })
  assert.ok(JSON.stringify(await client.getBookRatings(world.book)).includes('FOREIGN_REVIEW_SENTINEL'))
  assert.equal((await client.listMyReviews())[0].overall, 3.8)
  // Removing the CSRF cookie must prevent a genuine HTTP mutation.
  const token = jar.get('csrftoken')
  jar.delete('csrftoken')
  await assert.rejects(client.setWeekCompleted(world.week, false), { status: 403 })
  jar.set('csrftoken', token)
  await client.signOut()
  // Replay the original credential to prove server-side invalidation.
  jar.set('sessionid', world.session)
  assert.equal((await client.getSession()).status, 'anonymous')
  await assert.rejects(client.getBook(world.book), { status: 401 })
  process.stdout.write(JSON.stringify(trace))
} finally {
  await server.close()
}
