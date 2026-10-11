import type { ValidateFunction } from 'ajv'

export interface ContractDocument {
  paths: Record<string, Record<string, {
    operationId?: string
    responses?: Record<string, { content?: Record<string, { schema: object }> }>
    requestBody?: { content: Record<string, { schema: object }> }
  }>>
  components: { schemas: Record<string, object> }
}
export function readContract(path?: string): Promise<ContractDocument>
export function schemaValidators(document: ContractDocument): {
  named(name: string): ValidateFunction
  inline(schema: object): ValidateFunction
}
export function validateContract(document: ContractDocument): Promise<{ operations: number; schemas: number; examples: number }>
