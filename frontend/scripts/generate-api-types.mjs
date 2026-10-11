import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readContract, validateContract } from './contract.mjs'

// An optional disposable tooling directory preserves the running Vite installation.
const require = createRequire(process.env.BOOKCLUB_TOOLING_DIR
  ? `${process.env.BOOKCLUB_TOOLING_DIR}/package.json` : import.meta.url)
const { default: openapiTS, astToString } = require('openapi-typescript')
const ts = require('typescript')
const outputPath = new URL('../src/api/generated.ts', import.meta.url)

export async function generate(document) {
  await validateContract(document) // Reject external references before invoking the generator.
  const ast = await openapiTS(structuredClone(document), {
    transform(schema) {
      if (schema.format === 'binary') return ts.factory.createTypeReferenceNode('Blob')
    },
  })
  return '/** Generated from root openapi.yaml. DO NOT EDIT. Run npm run generate:api. */\n' + astToString(ast)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const contractArgument = process.argv.indexOf('--contract')
  const output = await generate(await readContract(contractArgument >= 0 ? process.argv[contractArgument + 1] : undefined))
  if (process.argv.includes('--check')) {
    if (await readFile(outputPath, 'utf8') !== output) throw new Error('Generated API types are stale; run npm run generate:api.')
    console.log('Generated API types are fresh.')
  } else {
    await writeFile(outputPath, output)
    console.log('Generated src/api/generated.ts.')
  }
}
