import { InvalidCoreResponseError } from './publicContentMapping'

type JsonObject = Record<string, unknown>

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidCoreResponseError(`Invalid ${field}`)
  }
  return value as JsonObject
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new InvalidCoreResponseError(`Invalid ${field}`)
  return value
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null
  return string(value, field)
}

export function mapPolicyResponse(value: unknown) {
  const response = object(value, 'response')
  if (response.success !== true) throw new InvalidCoreResponseError('Invalid success response')
  const data = object(response.data, 'data')
  const policy = object(data.policy, 'data.policy')
  const type = string(policy.type, 'policy.type')
  if (type !== 'terms' && type !== 'privacy') {
    throw new InvalidCoreResponseError('Invalid policy.type')
  }
  if (!Array.isArray(data.history)) throw new InvalidCoreResponseError('Invalid data.history')
  const meta = object(response.meta, 'meta')

  return {
    success: true as const,
    data: {
      policy: {
        type,
        version: string(policy.version, 'policy.version'),
        title: string(policy.title, 'policy.title'),
        bodyHtml: string(policy.bodyHtml, 'policy.bodyHtml'),
        effectiveAt: string(policy.effectiveAt, 'policy.effectiveAt'),
        endedAt: nullableString(policy.endedAt, 'policy.endedAt'),
      },
      history: data.history.map((value, index) => {
        const item = object(value, `history[${index}]`)
        return {
          version: string(item.version, `history[${index}].version`),
          effectiveAt: string(item.effectiveAt, `history[${index}].effectiveAt`),
          endedAt: nullableString(item.endedAt, `history[${index}].endedAt`),
        }
      }),
    },
    meta: { requestId: string(meta.requestId, 'meta.requestId') },
  }
}
