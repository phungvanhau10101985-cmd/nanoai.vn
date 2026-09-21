import {
  optimizedFulfillmentDecision,
  type OptimizedFulfillmentDecision,
  type OptimizedFulfillmentEnvironment,
} from '@/lib/messaging/fulfillment/optimized-contract-feature'

export type OptimizedFulfillmentOperation = 'checkout' | 'payment' | 'shipping'

type ShadowMismatchLog = {
  event: 'optimized_fulfillment_shadow_mismatch'
  operation: OptimizedFulfillmentOperation
  tenantHash: string
  legacyHash: string
  optimizedHash: string
}

type ShadowErrorLog = {
  event: 'optimized_fulfillment_shadow_error'
  operation: OptimizedFulfillmentOperation
  tenantHash: string
  errorType: string
}

export type OptimizedFulfillmentRuntimeSelection<T> = {
  value: T
  decision: OptimizedFulfillmentDecision
}

/**
 * Browser-safe digest for shadow logs. Dashboard clients import this module
 * through order lifecycle / shipment helpers, so Node `node:crypto`/`node:util`
 * cannot be used here.
 */
function fnv1a32(input: string, seed: number): number {
  let hash = seed >>> 0
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function hexHash(input: string, length: number): string {
  const left = fnv1a32(input, 0x811c9dc5).toString(16).padStart(8, '0')
  const right = fnv1a32(input, 0xcbf29ce4).toString(16).padStart(8, '0')
  return `${left}${right}`.slice(0, length)
}

function safeHash(value: unknown): string {
  let serialized = ''
  try {
    serialized = JSON.stringify(value) ?? String(value)
  } catch {
    serialized = Object.prototype.toString.call(value)
  }
  return hexHash(serialized, 16)
}

function tenantHash(tenantId: string): string {
  return hexHash(tenantId.trim(), 12)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function isDeepEqual(left: unknown, right: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== typeof right) return false
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (seen.get(left) === right) return true
  seen.set(left, right)

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime()
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((item, index) => isDeepEqual(item, right[index], seen))
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && isDeepEqual(left[key], right[key], seen)
  )
}

/**
 * Selects one pure orchestration outcome without ever running two mutation paths.
 * Shadow output is intentionally limited to hashes and non-sensitive metadata.
 */
export function selectOptimizedFulfillmentOutcome<T>(input: {
  tenantId: string
  operation: OptimizedFulfillmentOperation
  legacy: () => T
  optimized: () => T
  env?: OptimizedFulfillmentEnvironment
  log?: (entry: ShadowMismatchLog | ShadowErrorLog) => void
}): OptimizedFulfillmentRuntimeSelection<T> {
  const decision = optimizedFulfillmentDecision(input.tenantId, input.env)
  if (decision.effectiveMode === 'enforce') {
    return { value: input.optimized(), decision }
  }

  const legacy = input.legacy()
  if (decision.effectiveMode !== 'shadow') {
    return { value: legacy, decision }
  }

  try {
    const optimized = input.optimized()
    if (!isDeepEqual(legacy, optimized)) {
      ;(input.log ?? ((entry) => console.warn('[optimized-fulfillment]', entry)))({
        event: 'optimized_fulfillment_shadow_mismatch',
        operation: input.operation,
        tenantHash: tenantHash(input.tenantId),
        legacyHash: safeHash(legacy),
        optimizedHash: safeHash(optimized),
      })
    }
  } catch (error) {
    ;(input.log ?? ((entry) => console.warn('[optimized-fulfillment]', entry)))({
      event: 'optimized_fulfillment_shadow_error',
      operation: input.operation,
      tenantHash: tenantHash(input.tenantId),
      errorType: error instanceof Error ? error.name : 'UnknownError',
    })
  }
  return { value: legacy, decision }
}
