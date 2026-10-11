import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { generate } from './generate-api-types.mjs'
import { readContract } from './contract.mjs'

const frontend = fileURLToPath(new URL('../', import.meta.url))
const temporary = await mkdtemp(join(tmpdir(), 'bookclub-type-boundaries-'))
const baseline = await readContract()
const generated = await readFile(join(frontend, 'src/api/generated.ts'), 'utf8')

function compile() {
  const result = spawnSync(process.execPath, [join(frontend, 'node_modules/typescript/bin/tsc'), '--project', join(temporary, 'tsconfig.app.json'), '--pretty', 'false'], { encoding: 'utf8' })
  if (result.error) throw result.error
  return { status: result.status, output: result.stdout + result.stderr }
}

function removeExamples(value) {
  if (!value || typeof value !== 'object') return
  delete value.examples
  delete value.example
  for (const child of Object.values(value)) removeExamples(child)
}

try {
  assert.equal(await generate(baseline), generated.replaceAll('\r\n', '\n'), 'Committed generated types must match the baseline contract')
  await cp(join(frontend, 'src'), join(temporary, 'src'), { recursive: true })
  await cp(join(frontend, 'scripts'), join(temporary, 'scripts'), { recursive: true })
  await cp(join(frontend, 'tsconfig.app.json'), join(temporary, 'tsconfig.app.json'))
  await cp(join(frontend, 'package.json'), join(temporary, 'package.json'))
  // Read-only dependency reuse: generated files and compiler caches live in the disposable copy.
  await symlink(join(frontend, 'node_modules'), join(temporary, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const parsed = ts.parseConfigFileTextToJson('tsconfig.app.json', await readFile(join(temporary, 'tsconfig.app.json'), 'utf8'))
  assert.equal(parsed.error, undefined, 'Actual TypeScript config must parse')
  const config = parsed.config
  config.compilerOptions.tsBuildInfoFile = join(temporary, 'app.tsbuildinfo')
  await writeFile(join(temporary, 'tsconfig.app.json'), JSON.stringify(config))
  const clean = compile()
  assert.equal(clean.status, 0, `Unmodified actual frontend must compile first:\n${clean.output}`)
  // Fixture examples intentionally describe the original field types; strip them from
  // both comparison inputs so a changed example cannot masquerade as schema coupling.
  const comparison = structuredClone(baseline)
  removeExamples(comparison)
  const comparisonArtifact = await generate(comparison)

  for (const mutation of [
    { schema: 'BookSummary', property: 'title', type: 'number', description: 'response title reaches the real mock projection' },
    { schema: 'ReadingWeekInput', property: 'percentStart', type: 'string', description: 'request percentStart reaches the real mock input boundary' },
  ]) {
    const changed = structuredClone(comparison)
    changed.components.schemas[mutation.schema].properties[mutation.property] = { type: mutation.type }
    const regenerated = await generate(changed)
    assert.notEqual(regenerated, comparisonArtifact, `Unregenerated artifact must be stale after ${mutation.schema}.${mutation.property} changes`)
    await writeFile(join(temporary, 'src/api/generated.ts'), regenerated)
    const result = compile()
    assert.notEqual(result.status, 0, `Mutation did not break compilation: ${mutation.description}`)
    assert.match(result.output, /src[\\/]api[\\/]mock[\\/]mockClient\.ts\(\d+,\d+\): error TS/, `Mutation must fail at a real mock boundary:\n${result.output}`)
    console.log(`Verified regenerated contract coupling: ${mutation.description}.`)
    await writeFile(join(temporary, 'src/api/generated.ts'), generated)
  }
} finally {
  // Remove the dependency link before removing the known temporary directory.
  await rm(join(temporary, 'node_modules'), { force: true, recursive: false })
  await rm(temporary, { force: true, recursive: true })
}
