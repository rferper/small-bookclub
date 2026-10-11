import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'
import { readContract, schemaValidators, validateContract } from './contract.mjs'

function checkInventory(clientSource, documentation, document) {
  const source = ts.createSourceFile('client.ts', clientSource, ts.ScriptTarget.Latest, true)
  const client = source.statements.find((statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === 'ApiClient')
  assert.ok(client, 'ApiClient interface exists')
  const methods = client.members.filter(ts.isMethodSignature).map((method) => method.name.getText(source))
  const rows = documentation.split(/\r?\n/).filter((line) => /^\| `\w+` \|/.test(line))
  const inventory = new Map()
  for (const row of rows) {
    const name = /^\| `(\w+)` \|/.exec(row)[1]
    assert.equal(inventory.has(name), false, `Duplicate inventory entry: ${name}`)
    inventory.set(name, row)
  }
  assert.deepEqual([...inventory.keys()].sort(), [...methods].sort(), 'Every client method appears exactly once in inventory')
  const operations = new Map()
  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (operation.operationId) operations.set(operation.operationId, `${method.toUpperCase()} ${path}`)
    }
  }
  for (const [name, row] of inventory) {
    const route = /`((?:GET|POST|PUT|PATCH|DELETE) \/api[^`]+)`/.exec(row)
    if (route) assert.equal(operations.get(name), route[1], `Documented route matches ${name}`)
    else {
      assert.ok(row.includes('#102'), `Deferred admin method ${name} assigned to #102`)
      assert.equal(operations.has(name), false, `Deferred admin method ${name} has no completed operation`)
    }
  }
  const callback = documentation.split(/\r?\n/).find((line) => line.startsWith('| provider callback'))
  assert.ok(callback?.includes('discordCallback') && callback.includes('no client method'), 'Callback explicitly has no client method')
  const callbackRoute = /`(GET \/api[^`]+)`/.exec(callback)
  assert.equal(operations.get('discordCallback'), callbackRoute?.[1])
  assert.deepEqual([...operations.keys()].sort(), [...methods.filter((name) => !inventory.get(name).includes('#102')), 'discordCallback'].sort(), 'No undocumented contract operations')
}

test('client inventory documents every method, exact implemented routes and deferred administration', async () => {
  const client = await readFile(new URL('../src/api/client.ts', import.meta.url), 'utf8')
  const documentation = await readFile(new URL('../../docs/api.md', import.meta.url), 'utf8')
  const document = await readContract()
  checkInventory(client, documentation, document)
  assert.throws(() => checkInventory(client.replace('export interface ApiClient {', 'export interface ApiClient {\n  undocumented(): Promise<void>'), documentation, document))
  assert.throws(() => checkInventory(client, documentation.replace('GET /api/session` |', 'GET /api/wrong-session` |'), document))
  assert.throws(() => checkInventory(client, documentation.replace('| `getBackupInfo`', '| `missingBackupInfo`'), document))
})

function minimalContract() {
  return {
    openapi: '3.1.0',
    info: { title: 'Fictional validator test', version: '1.0.0' },
    paths: { '/fictional': { get: {
      operationId: 'fictionalRead',
      responses: { 200: {
        description: 'Fictional response',
        content: { 'application/json': {
          schema: { $ref: '#/components/schemas/Example' },
          examples: { ordinary: { $ref: '#/components/examples/Ordinary' } },
        } },
      } },
    } } },
    components: {
      schemas: { Example: {
        type: 'object', additionalProperties: false,
        required: ['label'], properties: { label: { type: 'string' } },
        examples: [{ label: 'Libro ficticio' }],
      } },
      examples: { Ordinary: { value: { label: 'Libro ficticio' } } },
    },
  }
}

test('offline validator accepts a valid 3.1 document and all declared example locations', async () => {
  assert.deepEqual(await validateContract(minimalContract()), { operations: 1, schemas: 1, examples: 2 })
})

test('malformed OpenAPI structure fails even with correct version and local references', async () => {
  const document = minimalContract()
  document.paths['/fictional'].get.responses[200].description = 3
  await assert.rejects(validateContract(document), /schema validation failed/)
})

test('unresolved and remote references fail without fetching or reading external files', async () => {
  for (const ref of ['#/components/schemas/Missing', 'https://example.invalid/private.json', './private.json']) {
    const document = minimalContract()
    document.paths['/fictional'].get.responses[200].content['application/json'].schema.$ref = ref
    await assert.rejects(validateContract(document), /Unresolved reference|Only local references/)
  }
})

test('invalid declared schema and named media examples fail', async () => {
  for (const location of ['schema', 'media']) {
    const document = minimalContract()
    if (location === 'schema') document.components.schemas.Example.examples[0].label = 12
    else document.components.examples.Ordinary.value.privateRating = 5
    await assert.rejects(validateContract(document), /Invalid example/)
  }
})

test('duplicate operation IDs and 204 content fail', async () => {
  const duplicate = minimalContract()
  duplicate.paths['/second'] = structuredClone(duplicate.paths['/fictional'])
  await assert.rejects(validateContract(duplicate), /duplicate operationId/)
  const noContent = minimalContract()
  noContent.paths['/fictional'].get.responses[204] = { description: 'No content', content: {} }
  await assert.rejects(validateContract(noContent), /204 response has content/)
})

test('YAML duplicate keys and malformed syntax fail in disposable files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bookclub-invalid-contract-'))
  try {
    for (const yaml of ['openapi: 3.1.0\nopenapi: 3.1.1\n', 'paths: [unterminated']) {
      const path = join(directory, 'openapi.yaml')
      await writeFile(path, yaml)
      await assert.rejects(readContract(path))
    }
  } finally {
    await rm(directory, { recursive: true })
  }
})

test('validation CLI exits unsuccessfully for disposable malformed, unresolved and invalid-example documents', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bookclub-contract-cli-'))
  const cli = fileURLToPath(new URL('./validate-contract.mjs', import.meta.url))
  try {
    const malformed = minimalContract()
    malformed.paths['/fictional'].get.responses[200].description = 3
    const unresolved = minimalContract()
    unresolved.paths['/fictional'].get.responses[200].content['application/json'].schema.$ref = '#/components/schemas/Missing'
    const invalidExample = minimalContract()
    invalidExample.components.schemas.Example.examples[0].label = null
    for (const [index, document] of [malformed, unresolved, invalidExample].entries()) {
      const path = join(directory, `mutation-${index}.yaml`)
      await writeFile(path, JSON.stringify(document))
      const result = spawnSync(process.execPath, [cli, path], { encoding: 'utf8', timeout: 10000 })
      assert.equal(result.status, 1, result.stderr)
      assert.ok(result.stderr.length)
    }
  } finally {
    await rm(directory, { recursive: true })
  }
})

test('repository contract validates every declared fictional example', async () => {
  const result = await validateContract(await readContract())
  assert.ok(result.operations >= 30)
  assert.ok(result.examples >= 20)
})

test('all privacy and outcome union branches have valid declared examples with required values', async () => {
  const document = await readContract()
  const validators = schemaValidators(document)
  for (const name of ['Session', 'MeetingRecord', 'ClubRatings', 'RatingStatistics', 'TasteComparison', 'VoteOutcome']) {
    const validate = validators.named(name)
    for (const branch of document.components.schemas[name].oneOf) {
      const branchName = branch.$ref.split('/').at(-1)
      const schema = document.components.schemas[branchName]
      assert.ok(schema.examples?.length, `${branchName} needs a fictional example`)
      for (const example of schema.examples) {
        assert.ok(validate(example), `${branchName}: ${JSON.stringify(validate.errors)}`)
        for (const required of schema.required) {
          const missing = structuredClone(example)
          delete missing[required]
          assert.equal(validate(missing), false, `${branchName} requires ${required}`)
        }
      }
    }
  }
})

test('ordinary and empty member result projections retain required fields and refuse unknown properties', async () => {
  const document = await readContract()
  const validators = schemaValidators(document)
  for (const name of ['HomeData', 'BookDetail', 'MeetingList', 'MeetingDetail', 'VotesOverview', 'BookRatings', 'Statistics', 'TasteCompatibility', 'MemberDirectory', 'MemberProfile', 'MyProfile']) {
    const schema = document.components.schemas[name]
    assert.ok(schema.examples?.length, `${name} needs an example`)
    const validate = validators.named(name)
    for (const example of schema.examples) {
      assert.ok(validate(example), `${name}: ${JSON.stringify(validate.errors)}`)
      assert.equal(validate({ ...example, discordId: 'private-identity' }), false, `${name} refuses private identity`)
      for (const required of schema.required ?? []) {
        const missing = structuredClone(example)
        delete missing[required]
        assert.equal(validate(missing), false, `${name} requires ${required}`)
      }
    }
  }
})

test('private data cannot be smuggled into locked and insufficient union branches', async () => {
  const validators = schemaValidators(await readContract())
  const branches = [
    ['ClubRatings', { status: 'locked' }],
    ['MeetingRecord', { status: 'lockedNoWeek' }],
    ['MeetingRecord', { status: 'lockedWeekNotRead', weekNumber: 2 }],
    ['RatingStatistics', { status: 'empty' }],
    ['TasteComparison', { status: 'insufficient' }],
  ]
  const leakedFields = {
    count: 7, mean: 4.5, reviews: [], summary: 'Resumen privado', highlights: [],
    memberRatings: [], book: { id: 'secret-book', title: 'Libro privado' },
  }
  for (const [name, branch] of branches) {
    const validate = validators.named(name)
    assert.ok(validate(branch), `${name} fixture must be valid: ${JSON.stringify(validate.errors)}`)
    for (const [field, value] of Object.entries(leakedFields)) {
      assert.equal(validate({ ...branch, [field]: value }), false, `${name} rejects ${field}`)
    }
  }
})

test('session anonymous and denied responses refuse identity and club payloads', async () => {
  const document = await readContract()
  const validate = schemaValidators(document).named('Session')
  for (const status of ['anonymous', 'denied']) {
    const branch = { status, demoSignInAvailable: false }
    assert.ok(validate(branch))
    for (const field of ['user', 'discordId', 'accessToken', 'refreshToken', 'password', 'books']) {
      assert.equal(validate({ ...branch, [field]: 'private' }), false, `${status} rejects ${field}`)
    }
    assert.equal(validate({ status }), false, `${status} requires demo availability`)
  }
  const signedIn = document.components.schemas.SessionSignedIn.examples[0]
  for (const field of ['discordId', 'accessToken', 'refreshToken', 'password']) {
    assert.equal(validate({ ...signedIn, user: { ...signedIn.user, [field]: 'private' } }), false)
  }
})

test('own review rejects missing criteria, invalid half stars and supplied ownership', async () => {
  const validate = schemaValidators(await readContract()).named('ReviewInput')
  const scores = { disfrute: 5, estilo: 4.5, personajes: 3, trama: 4, huella: 2.5 }
  const valid = { scores, text: null }
  assert.ok(validate(valid), JSON.stringify(validate.errors))
  for (const score of [0.5, 5.5, 3.1, '4', null]) {
    assert.equal(validate({ ...valid, scores: { ...scores, disfrute: score } }), false)
  }
  const missing = { ...scores }
  delete missing.huella
  assert.equal(validate({ ...valid, scores: missing }), false)
  for (const key of ['ownerId', 'memberId', 'userId']) assert.equal(validate({ ...valid, [key]: 'another-member' }), false)
})

test('profile metadata rejects malformed fields, duplicate favourites and ownership', async () => {
  const validate = schemaValidators(await readContract()).named('ProfileMetadata')
  const valid = { displayName: 'Lector ficticio', bio: null, favouriteQuote: null, favouriteBookIds: [], avatarAction: 'keep' }
  assert.ok(validate(valid), JSON.stringify(validate.errors))
  for (const patch of [
    { displayName: null }, { favouriteBookIds: ['book-1', 'book-1'] },
    { favouriteBookIds: ['1', '2', '3', '4', '5', '6'] }, { avatarAction: 'unknown' },
    { memberId: 'another-member' }, { avatar: { name: 'local-file.png' } },
  ]) assert.equal(validate({ ...valid, ...patch }), false, JSON.stringify(patch))
})

test('multipart avatar representation requires a file only when replacement is requested', async () => {
  const validate = schemaValidators(await readContract()).named('ProfileMultipart')
  const metadata = { displayName: 'Lector ficticio', bio: null, favouriteQuote: null, favouriteBookIds: [], avatarAction: 'replace' }
  assert.ok(validate({ metadata, avatar: 'fictional image bytes' }))
  assert.equal(validate({ metadata }), false)
  assert.equal(validate({ metadata, avatar: { name: 'file.png', size: 10 } }), false)
  for (const avatarAction of ['keep', 'remove']) {
    assert.ok(validate({ metadata: { ...metadata, avatarAction } }))
    assert.equal(validate({ metadata: { ...metadata, avatarAction }, avatar: 'unrequested bytes' }), false)
  }
})

test('error envelope rejects private payloads and invalid machine codes', async () => {
  const validate = schemaValidators(await readContract()).named('Error')
  const error = { code: 'unauthenticated', message: 'Inicia sesión para continuar.' }
  assert.ok(validate(error))
  assert.equal(validate({ ...error, code: 'unknown' }), false)
  assert.equal(validate({ ...error, request: { memberId: 'private' } }), false)
  assert.equal(validate({ message: error.message }), false)
})

test('aggregated means and taste differences use continuous ranges rather than score half steps', async () => {
  const validators = schemaValidators(await readContract())
  const means = validators.named('CriterionMeans')
  const differences = validators.named('CriterionDifferences')
  const criteria = ['disfrute', 'estilo', 'personajes', 'trama', 'huella']
  assert.ok(means(Object.fromEntries(criteria.map((key) => [key, 3.8]))))
  assert.ok(differences(Object.fromEntries(criteria.map((key) => [key, 0]))))
  assert.ok(differences(Object.fromEntries(criteria.map((key) => [key, 1.2]))))
  assert.equal(means(Object.fromEntries(criteria.map((key) => [key, 5.1]))), false)
  assert.equal(differences(Object.fromEntries(criteria.map((key) => [key, -0.1]))), false)
})
