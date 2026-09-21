import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
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

function safeHash(value: unknown): string {
  let serialized = ''
  try {
    serialized = JSON.stringify(value) ?? String(value)
  } catch {
    serialized = Object.prototype.toString.call(value)
  }
  return createHash('sha256').update(serialized).digest('hex').slice(0, 16)
}

function tenantHash(tenantId: string): string {
  return createHash('sha256').update(tenantId.trim()).digest('hex').slice(0, 12)
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
    if (!isDeepStrictEqual(legacy, optimized)) {
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
