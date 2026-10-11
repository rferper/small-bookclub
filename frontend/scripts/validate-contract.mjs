import { readContract, validateContract } from './contract.mjs'

try {
  const result = await validateContract(await readContract(process.argv[2]))
  console.log(`Contract valid: ${result.operations} operations, ${result.schemas} schemas, ${result.examples} examples.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
