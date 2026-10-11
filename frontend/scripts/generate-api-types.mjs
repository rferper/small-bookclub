import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readContract, validateContract } from './contract.mjs'

// An optional disposable tooling directory preserves the running Vite installation.
const require = createRequire(process.env.BOOKCLUB_TOOLING_DIR
  ? `${process.env.BOOKCLUB_TOOLING_DIR}/package.json` : import.meta.url)
const { default: openapiTS } = await import(pathToFileURL(require.resolve('openapi-typescript')))
const outputPath = new URL('../src/api/generated.ts', import.meta.url)

export async function generate(document) {
  await validateContract(document) // Reject external references before invoking the generator.
  const input = structuredClone(document)
  function visit(node) {
    if (!node || typeof node !== 'object') return
    // OAS discriminator is a lookup hint. The schema's const/oneOf remains authoritative.
    // v6 otherwise injects a parent name into nullable references to a discriminated union.
    delete node.discriminator
    for (const value of Object.values(node)) visit(value)
  }
  visit(input)
  return openapiTS(input, {
    commentHeader: '/** Generated from root openapi.yaml. DO NOT EDIT. Run npm run generate:api. */\n',
    transform(schema) { if (schema.format === 'binary') return 'Blob' },
  })
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const output = await generate(await readContract())
  if (process.argv.includes('--check')) {
    if (await readFile(outputPath, 'utf8') !== output) throw new Error('Generated API types are stale; run npm run generate:api.')
    console.log('Generated API types are fresh.')
  } else {
    await writeFile(outputPath, output)
    console.log('Generated src/api/generated.ts.')
  }
}
