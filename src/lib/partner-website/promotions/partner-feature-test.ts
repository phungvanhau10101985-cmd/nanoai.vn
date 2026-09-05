export const PARTNER_FEATURE_TEST_DURATION_MINUTES = 10
export const PARTNER_FEATURE_TEST_DEFAULT_BIRTHDAY_PERCENT = 10

export type PartnerSiteSaleTestPhase = 'teaser' | 'active'

export type PartnerFeatureTestRow = {
  id: string
  partnerId: string
  actorUserId: string
  testEmail: string | null
  birthdayPromoEnabled: boolean
  birthdayPromoExpiresAt: string | null
  siteSaleTestEnabled: boolean
  siteSaleTestExpiresAt: string | null
  siteSaleTestPhase: PartnerSiteSaleTestPhase
}

export function normalizeFeatureTestEmail(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase().slice(0, 180)
}

export function isPartnerFeatureTestUnexpired(
  expiresAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return false
  const at = new Date(expiresAt)
  return !Number.isNaN(at.getTime()) && at.getTime() > now.getTime()
}

export function matchesFeatureTestTarget(input: {
  configuredTestEmail?: string | null
  visitorEmail?: string | null
}): boolean {
  const target = normalizeFeatureTestEmail(input.configuredTestEmail)
  const visitor = normalizeFeatureTestEmail(input.visitorEmail)
  return Boolean(target && visitor && target === visitor)
}

export function isBirthdayPromoTestActive(
  row: Pick<PartnerFeatureTestRow, 'birthdayPromoEnabled' | 'birthdayPromoExpiresAt'> | null | undefined,
  now: Date = new Date()
): boolean {
  return Boolean(row?.birthdayPromoEnabled) && isPartnerFeatureTestUnexpired(row?.birthdayPromoExpiresAt, now)
}

export function isSiteSaleTestActive(
  row: Pick<PartnerFeatureTestRow, 'siteSaleTestEnabled' | 'siteSaleTestExpiresAt'> | null | undefined,
  now: Date = new Date()
): boolean {
  return Boolean(row?.siteSaleTestEnabled) && isPartnerFeatureTestUnexpired(row?.siteSaleTestExpiresAt, now)
}

export function normalizeSiteSaleTestPhase(value: string | null | undefined): PartnerSiteSaleTestPhase {
  return value === 'teaser' ? 'teaser' : 'active'
}

export function partnerFeatureTestExpiresAt(
  enabled: boolean,
  now: Date = new Date()
): string | null {
  if (!enabled) return null
  return new Date(now.getTime() + PARTNER_FEATURE_TEST_DURATION_MINUTES * 60_000).toISOString()
}

export function birthdayPercentForFeatureTest(configuredPercent: number | null | undefined): number {
  const pct = Math.max(0, Math.min(100, Math.floor(Number(configuredPercent) || 0)))
  return pct > 0 ? pct : PARTNER_FEATURE_TEST_DEFAULT_BIRTHDAY_PERCENT
}

export function findMatchingFeatureTestRow<T extends { testEmail: string | null }>(
  rows: T[],
  visitorEmail: string | null | undefined
): T | null {
  const email = normalizeFeatureTestEmail(visitorEmail)
  if (!email) return null
  return rows.find((row) => matchesFeatureTestTarget({
    configuredTestEmail: row.testEmail,
    visitorEmail: email,
  })) ?? null
}
