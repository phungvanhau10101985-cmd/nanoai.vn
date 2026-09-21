export type OptimizedFulfillmentMode = 'off' | 'shadow' | 'enforce'

export type OptimizedFulfillmentDecision = {
  tenantId: string
  requestedMode: OptimizedFulfillmentMode
  effectiveMode: OptimizedFulfillmentMode
  parityGatePassed: boolean
  reason: 'disabled' | 'shadow_enabled' | 'enforce_enabled' | 'enforce_gate_missing'
}

export type OptimizedFulfillmentEnvironment = Readonly<Record<string, string | undefined>>

function modeOf(value: unknown): OptimizedFulfillmentMode | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'off' || normalized === 'shadow' || normalized === 'enforce'
    ? normalized
    : null
}

export function parseOptimizedFulfillmentTenantModes(
  raw: string | undefined,
): Record<string, OptimizedFulfillmentMode> {
  if (!raw?.trim()) return {}
  try {
    const value = JSON.parse(raw) as unknown
    if (!value || Array.isArray(value) || typeof value !== 'object') return {}
    const result: Record<string, OptimizedFulfillmentMode> = {}
    for (const [tenantId, candidate] of Object.entries(value)) {
      const mode = modeOf(candidate)
      if (tenantId.trim() && mode) result[tenantId.trim()] = mode
    }
    return result
  } catch {
    return {}
  }
}

/**
 * The optimized orchestration is tenant-scoped and disabled by default.
 * `enforce` never becomes active until the external parity gate explicitly passed.
 */
export function optimizedFulfillmentDecision(
  tenantId: string,
  env: OptimizedFulfillmentEnvironment = process.env,
): OptimizedFulfillmentDecision {
  const normalizedTenantId = tenantId.trim()
  const overrides = parseOptimizedFulfillmentTenantModes(
    env.ORDER_FULFILLMENT_OPTIMIZED_TENANTS,
  )
  const requestedMode =
    overrides[normalizedTenantId] ??
    modeOf(env.ORDER_FULFILLMENT_OPTIMIZED_MODE) ??
    'off'
  const parityGatePassed = env.ORDER_FULFILLMENT_PARITY_GATE_PASSED === '1'

  if (requestedMode === 'enforce' && !parityGatePassed) {
    return {
      tenantId: normalizedTenantId,
      requestedMode,
      effectiveMode: 'off',
      parityGatePassed,
      reason: 'enforce_gate_missing',
    }
  }
  return {
    tenantId: normalizedTenantId,
    requestedMode,
    effectiveMode: requestedMode,
    parityGatePassed,
    reason:
      requestedMode === 'enforce'
        ? 'enforce_enabled'
        : requestedMode === 'shadow'
          ? 'shadow_enabled'
          : 'disabled',
  }
}
