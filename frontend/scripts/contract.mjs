import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { parseDocument } from 'yaml'

const schemaId = 'urn:small-bookclub:contract'
const methods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])

export async function readContract(path = fileURLToPath(new URL('../../openapi.yaml', import.meta.url))) {
  const yaml = parseDocument(await readFile(path, 'utf8'), { uniqueKeys: true })
  if (yaml.errors.length) throw new Error(yaml.errors.map((error) => error.message).join('\n'))
  return yaml.toJS()
}

function visit(value, callback, path = '#') {
  if (!value || typeof value !== 'object') return
  callback(value, path)
  for (const [key, child] of Object.entries(value)) visit(child, callback, `${path}/${key}`)
}

function pointer(document, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local references are allowed: ${ref}`)
  let value = document
  for (const token of ref.slice(2).split('/')) {
    const key = decodeURIComponent(token).replaceAll('~1', '/').replaceAll('~0', '~')
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) {
      throw new Error(`Unresolved reference: ${ref}`)
    }
    value = value[key]
  }
  return value
}

export function schemaValidators(document) {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true })
  addFormats(ajv)
  ajv.addFormat('binary', true) // Multipart file bytes are validated by the future backend.
  ajv.addSchema(document, schemaId)
  const validators = new Map()
  for (const name of Object.keys(document.components?.schemas ?? {})) {
    validators.set(name, ajv.compile({ $ref: `${schemaId}#/components/schemas/${name}` }))
  }
  return {
    named(name) {
      const validator = validators.get(name)
      if (!validator) throw new Error(`Unknown schema: ${name}`)
      return validator
    },
    inline(schema) {
      const copy = structuredClone(schema)
      visit(copy, (node) => {
        if (typeof node.$ref === 'string' && node.$ref.startsWith('#/')) node.$ref = schemaId + node.$ref
      })
      return ajv.compile(copy)
    },
  }
}

export async function validateContract(document) {
  if (!document || typeof document !== 'object' || !/^3\.1\.\d+$/.test(document.openapi ?? '')) {
    throw new Error('Expected an OpenAPI 3.1 document')
  }
  visit(document, (node) => {
    if (Object.hasOwn(node, '$ref')) pointer(document, node.$ref)
  })
  // Disable both file and HTTP resolvers: validation never reads outside this document.
  await SwaggerParser.validate(structuredClone(document), { resolve: { file: false, http: false } })
  const operationIds = new Set()
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(item)) {
      if (!methods.has(method)) continue
      if (!operation.operationId || operationIds.has(operation.operationId)) {
        throw new Error(`Missing or duplicate operationId: ${method} ${path}`)
      }
      operationIds.add(operation.operationId)
      if (operation.responses?.['204']?.content) throw new Error(`204 response has content: ${operation.operationId}`)
    }
  }
  const validators = schemaValidators(document)
  let exampleCount = 0
  function check(schema, value, location) {
    const validator = validators.inline(schema)
    if (!validator(value)) throw new Error(`Invalid example ${location}: ${JSON.stringify(validator.errors)}`)
    exampleCount += 1
  }
  // JSON Schema examples (including nested properties and union branches).
  visit(document.components?.schemas, (schema, location) => {
    if (Array.isArray(schema.examples)) {
      schema.examples.forEach((value, index) => check(schema, value, `${location}/examples/${index}`))
    }
    if (Object.hasOwn(schema, 'example')) check(schema, schema.example, `${location}/example`)
  })
  // OpenAPI media-type and parameter examples, including named Example references.
  visit(document, (node, location) => {
    if (!node.schema) return
    if (Object.hasOwn(node, 'example')) check(node.schema, node.example, `${location}/example`)
    for (const [name, example] of Object.entries(node.examples ?? {})) {
      const resolved = example.$ref ? pointer(document, example.$ref) : example
      if (!Object.hasOwn(resolved, 'value')) throw new Error(`Example must declare offline value: ${location}/${name}`)
      check(node.schema, resolved.value, `${location}/examples/${name}`)
    }
  })
  return { operations: operationIds.size, examples: exampleCount, schemas: Object.keys(document.components?.schemas ?? {}).length }
}
