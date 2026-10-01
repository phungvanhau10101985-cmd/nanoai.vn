/** Đọc chi phí Google Ads và Facebook Ads của một shop. Không ghi log khóa bí mật. */

import { createHash } from 'node:crypto'

export const AD_SPEND_MAX_RANGE_DAYS = 366
const CACHE_TTL_MS = 180_000

export type AdSpendDay = {
  date: string
  spend: number
  impressions: number
  clicks: number
}

export type AdSpendCampaign = {
  id: string
  name: string
  spend: number
  impressions: number
  clicks: number
}

export type AdSpendPlatformReport = {
  configured: boolean
  ok: boolean
  error: string | null
  currency: string | null
  spend: number
  impressions: number
  clicks: number
  daily: AdSpendDay[]
  campaigns: AdSpendCampaign[]
  partial: boolean
}

export type AdSpendTotalStatus = 'ok' | 'incomplete' | 'mixed_currency'

export type AdSpendReport = {
  dateFrom: string
  dateTo: string
  google: AdSpendPlatformReport
  facebook: AdSpendPlatformReport
  totalSpend: number | null
  totalCurrency: string | null
  totalStatus: AdSpendTotalStatus
}

export type AdSpendCredentials = {
  googleDeveloperToken: string
  googleClientId: string
  googleClientSecret: string
  googleRefreshToken: string
  googleCustomerId: string
  googleLoginCustomerId: string
  metaAccessToken: string
  metaAdAccountId: string
}

export class AdSpendApiError extends Error {}

type CacheEntry = { at: number; rows: Record<string, unknown>[]; partial: boolean }
const reportCache = new Map<string, CacheEntry>()

export function googleAdsApiVersion(): string {
  const raw = (process.env.GOOGLE_ADS_API_VERSION || 'v25').trim() || 'v25'
  return raw.startsWith('v') ? raw : `v${raw}`
}

export function metaGraphApiVersion(): string {
  const raw = (process.env.META_ADS_GRAPH_API_VERSION || 'v25.0').trim() || 'v25.0'
  return raw.startsWith('v') ? raw : `v${raw}`
}

export function normalizeCustomerId(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '')
}

export function normalizeAdAccountId(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim().replace(/^act_/i, '')
  return text.replace(/\D/g, '')
}

export function microsToAmount(micros: unknown): number {
  const n = Number(micros ?? 0)
  if (!Number.isFinite(n)) return 0
  return n / 1_000_000
}

export function parseAdSpendDateRange(dateFrom: string, dateTo: string): { start: string; end: string } {
  const start = String(dateFrom ?? '').trim()
  const end = String(dateTo ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new AdSpendApiError('Ngày phải theo dạng YYYY-MM-DD.')
  }
  if (end < start) throw new AdSpendApiError('Ngày kết thúc phải sau hoặc trùng ngày bắt đầu.')
  const span = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
  if (span > AD_SPEND_MAX_RANGE_DAYS) {
    throw new AdSpendApiError(`Khoảng thời gian tối đa ${AD_SPEND_MAX_RANGE_DAYS} ngày.`)
  }
  return { start, end }
}

export function googleConfigured(creds: AdSpendCredentials): boolean {
  return Boolean(
    creds.googleCustomerId &&
      creds.googleDeveloperToken &&
      creds.googleClientId &&
      creds.googleClientSecret &&
      creds.googleRefreshToken,
  )
}

export function facebookConfigured(creds: AdSpendCredentials): boolean {
  return Boolean(creds.metaAccessToken && creds.metaAdAccountId)
}

function asFloat(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function asInt(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Math.round(n) : 0
}

export function aggregateMetricRows(
  rows: Record<string, unknown>[],
  opts: {
    dateKey: string
    spendKey: string
    impressionsKey: string
    clicksKey: string
    campaignIdKey: string
    campaignNameKey: string
    currencyKey: string
    spendIsMicros: boolean
  },
): Omit<AdSpendPlatformReport, 'configured' | 'ok' | 'error' | 'partial'> {
  const daily = new Map<string, { spend: number; impressions: number; clicks: number }>()
  const campaigns = new Map<string, AdSpendCampaign>()
  let currency: string | null = null
  for (const row of rows) {
    const day = String(row[opts.dateKey] ?? '').trim()
    const spend = opts.spendIsMicros ? microsToAmount(row[opts.spendKey]) : asFloat(row[opts.spendKey])
    const impressions = asInt(row[opts.impressionsKey])
    const clicks = asInt(row[opts.clicksKey])
    const code = String(row[opts.currencyKey] ?? '').trim()
    if (code && !currency) currency = code
    if (day) {
      const bucket = daily.get(day) ?? { spend: 0, impressions: 0, clicks: 0 }
      bucket.spend += spend
      bucket.impressions += impressions
      bucket.clicks += clicks
      daily.set(day, bucket)
    }
    const cid = String(row[opts.campaignIdKey] ?? '').trim() || String(row[opts.campaignNameKey] ?? '').trim()
    if (!cid) continue
    const camp = campaigns.get(cid) ?? {
      id: cid,
      name: String(row[opts.campaignNameKey] ?? cid),
      spend: 0,
      impressions: 0,
      clicks: 0,
    }
    camp.spend += spend
    camp.impressions += impressions
    camp.clicks += clicks
    campaigns.set(cid, camp)
  }
  const dailyRows = [...daily.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, values]) => ({
      date,
      spend: Math.round(values.spend * 100) / 100,
      impressions: values.impressions,
      clicks: values.clicks,
    }))
  const campaignRows = [...campaigns.values()]
    .map((item) => ({
      ...item,
      spend: Math.round(item.spend * 100) / 100,
    }))
    .sort((a, b) => b.spend - a.spend)
  return {
    currency,
    spend: Math.round(dailyRows.reduce((sum, item) => sum + item.spend, 0) * 100) / 100,
    impressions: dailyRows.reduce((sum, item) => sum + item.impressions, 0),
    clicks: dailyRows.reduce((sum, item) => sum + item.clicks, 0),
    daily: dailyRows,
    campaigns: campaignRows,
  }
}

export function emptyPlatform(configured: boolean, error: string | null = null): AdSpendPlatformReport {
  return {
    configured,
    ok: error == null,
    error,
    currency: null,
    spend: 0,
    impressions: 0,
    clicks: 0,
    daily: [],
    campaigns: [],
    partial: false,
  }
}

export function combineAdSpendTotals(input: {
  google: AdSpendPlatformReport
  facebook: AdSpendPlatformReport
  googleConfigured: boolean
  facebookConfigured: boolean
}): Pick<AdSpendReport, 'totalSpend' | 'totalCurrency' | 'totalStatus'> {
  const googleOk = input.google.ok && input.google.configured
  const facebookOk = input.facebook.ok && input.facebook.configured
  if (googleOk && facebookOk) {
    const gCur = input.google.currency
    const fCur = input.facebook.currency
    if (gCur && fCur && gCur !== fCur) return { totalSpend: null, totalCurrency: null, totalStatus: 'mixed_currency' }
    return {
      totalSpend: Math.round((input.google.spend + input.facebook.spend) * 100) / 100,
      totalCurrency: gCur || fCur,
      totalStatus: 'ok',
    }
  }
  if (googleOk && !input.facebookConfigured) {
    return { totalSpend: input.google.spend, totalCurrency: input.google.currency, totalStatus: 'ok' }
  }
  if (facebookOk && !input.googleConfigured) {
    return { totalSpend: input.facebook.spend, totalCurrency: input.facebook.currency, totalStatus: 'ok' }
  }
  return { totalSpend: null, totalCurrency: null, totalStatus: 'incomplete' }
}

export function googleErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Google Ads từ chối yêu cầu.'
  const body = payload as { error?: unknown; error_description?: unknown }
  if (typeof body.error === 'string') {
    const desc = String(body.error_description || body.error).trim()
    return `Không lấy được token Google: ${desc}`
  }
  if (body.error && typeof body.error === 'object') {
    const err = body.error as { message?: unknown; details?: unknown }
    const msg = String(err.message || 'Google Ads từ chối yêu cầu.').trim()
    const extras: string[] = []
    if (Array.isArray(err.details)) {
      for (const detail of err.details) {
        if (!detail || typeof detail !== 'object') continue
        const errors = (detail as { errors?: unknown }).errors
        if (!Array.isArray(errors)) continue
        for (const item of errors) {
          if (!item || typeof item !== 'object') continue
          const text = String((item as { message?: unknown }).message || '').trim()
          if (text) extras.push(text)
        }
      }
    }
    return extras.length ? `${msg} ${extras.slice(0, 2).join(' ')}` : msg
  }
  return 'Google Ads từ chối yêu cầu.'
}

export function metaErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Facebook từ chối yêu cầu.'
  const err = (payload as { error?: unknown }).error
  if (err && typeof err === 'object') {
    const msg = String((err as { message?: unknown }).message || '').trim()
    if (msg) return msg
  }
  return 'Facebook từ chối yêu cầu.'
}

function cacheKey(kind: string, material: string): string {
  return createHash('sha256').update(`${kind}|${material}`).digest('hex')
}

function readCache(key: string): { rows: Record<string, unknown>[]; partial: boolean } | null {
  const hit = reportCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    reportCache.delete(key)
    return null
  }
  return { rows: hit.rows, partial: hit.partial }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

async function refreshGoogleAccessToken(creds: AdSpendCredentials): Promise<string> {
  let response: Response
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.googleClientId,
        client_secret: creds.googleClientSecret,
        refresh_token: creds.googleRefreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    throw new AdSpendApiError('Không kết nối được máy chủ token Google.')
  }
  const payload = await readJson(response)
  const token = payload && typeof payload === 'object' ? (payload as { access_token?: unknown }).access_token : null
  if (!response.ok || typeof token !== 'string' || !token) throw new AdSpendApiError(googleErrorMessage(payload))
  return token
}

async function searchGoogleAds(input: {
  customerId: string
  accessToken: string
  developerToken: string
  loginCustomerId: string
  query: string
}): Promise<{ rows: Record<string, unknown>[]; partial: boolean }> {
  const url = `https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${input.customerId}/googleAds:search`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.accessToken}`,
    'Content-Type': 'application/json',
    'developer-token': input.developerToken,
  }
  if (input.loginCustomerId) headers['login-customer-id'] = input.loginCustomerId
  const rows: Record<string, unknown>[] = []
  let pageToken = ''
  let partial = false
  for (let page = 0; page < 30; page += 1) {
    const body: Record<string, string> = { query: input.query }
    if (pageToken) body.pageToken = pageToken
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      })
    } catch {
      throw new AdSpendApiError('Không kết nối được Google Ads.')
    }
    const payload = await readJson(response)
    if (!response.ok) throw new AdSpendApiError(googleErrorMessage(payload))
    const batch = payload && typeof payload === 'object' ? (payload as { results?: unknown }).results : null
    if (Array.isArray(batch)) {
      for (const item of batch) {
        if (!item || typeof item !== 'object') continue
        const metrics = (item as { metrics?: Record<string, unknown> }).metrics ?? {}
        const campaign = (item as { campaign?: Record<string, unknown> }).campaign ?? {}
        const segments = (item as { segments?: Record<string, unknown> }).segments ?? {}
        const customer = (item as { customer?: Record<string, unknown> }).customer ?? {}
        rows.push({
          date: segments.date,
          spend_micros: metrics.costMicros ?? metrics.cost_micros,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          currency: customer.currencyCode ?? customer.currency_code,
        })
      }
    }
    pageToken = String((payload as { nextPageToken?: unknown } | null)?.nextPageToken ?? '')
    if (!pageToken) break
    if (page === 29) partial = true
  }
  return { rows, partial }
}

async function fetchMetaRows(creds: AdSpendCredentials, start: string, end: string): Promise<{ rows: Record<string, unknown>[]; partial: boolean }> {
  const params = new URLSearchParams({
    fields: 'campaign_id,campaign_name,spend,impressions,clicks,date_start,account_currency',
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since: start, until: end }),
    limit: '500',
    access_token: creds.metaAccessToken,
  })
  let nextUrl: string | null = `https://graph.facebook.com/${metaGraphApiVersion()}/act_${creds.metaAdAccountId}/insights?${params.toString()}`
  const rows: Record<string, unknown>[] = []
  let partial = false
  for (let page = 0; page < 40; page += 1) {
    if (!nextUrl || !nextUrl.startsWith('https://graph.facebook.com/')) break
    let response: Response
    try {
      response = await fetch(nextUrl, { signal: AbortSignal.timeout(45_000) })
    } catch {
      throw new AdSpendApiError('Không kết nối được Facebook Ads.')
    }
    const payload = await readJson(response)
    const failed = !response.ok || Boolean(payload && typeof payload === 'object' && (payload as { error?: unknown }).error)
    if (failed) throw new AdSpendApiError(metaErrorMessage(payload))
    const batch = payload && typeof payload === 'object' ? (payload as { data?: unknown }).data : null
    if (Array.isArray(batch)) {
      for (const item of batch) {
        if (!item || typeof item !== 'object') continue
        const row = item as Record<string, unknown>
        rows.push({
          date: row.date_start,
          spend: row.spend,
          impressions: row.impressions,
          clicks: row.clicks,
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          currency: row.account_currency,
        })
      }
    }
    const paging = payload && typeof payload === 'object' ? (payload as { paging?: { next?: unknown } }).paging : null
    const candidate = typeof paging?.next === 'string' ? paging.next : ''
    nextUrl = candidate.startsWith('https://graph.facebook.com/') ? candidate : null
    if (!nextUrl) break
    if (page === 39) partial = true
  }
  return { rows, partial }
}

async function platformFromRows(
  configured: boolean,
  rows: Record<string, unknown>[],
  partial: boolean,
  spendIsMicros: boolean,
): Promise<AdSpendPlatformReport> {
  const aggregated = aggregateMetricRows(rows, {
    dateKey: 'date',
    spendKey: spendIsMicros ? 'spend_micros' : 'spend',
    impressionsKey: 'impressions',
    clicksKey: 'clicks',
    campaignIdKey: 'campaign_id',
    campaignNameKey: 'campaign_name',
    currencyKey: 'currency',
    spendIsMicros,
  })
  return { configured, ok: true, error: null, partial, ...aggregated }
}

export async function buildPartnerAdSpendReport(creds: AdSpendCredentials, dateFrom: string, dateTo: string): Promise<AdSpendReport> {
  const { start, end } = parseAdSpendDateRange(dateFrom, dateTo)
  const googleOn = googleConfigured(creds)
  const facebookOn = facebookConfigured(creds)
  let google = emptyPlatform(false)
  let facebook = emptyPlatform(false)

  if (googleOn) {
    const key = cacheKey(
      'google',
      [creds.googleCustomerId, creds.googleDeveloperToken, creds.googleRefreshToken, creds.googleLoginCustomerId, start, end, googleAdsApiVersion()].join('|'),
    )
    try {
      const cached = readCache(key)
      const loaded = cached ?? (await (async () => {
        const token = await refreshGoogleAccessToken(creds)
        const query = [
          'SELECT segments.date, campaign.id, campaign.name,',
          'metrics.cost_micros, metrics.impressions, metrics.clicks, customer.currency_code',
          'FROM campaign',
          `WHERE segments.date BETWEEN '${start}' AND '${end}'`,
          'AND metrics.cost_micros > 0',
        ].join(' ')
        const fresh = await searchGoogleAds({
          customerId: creds.googleCustomerId,
          accessToken: token,
          developerToken: creds.googleDeveloperToken,
          loginCustomerId: creds.googleLoginCustomerId,
          query,
        })
        reportCache.set(key, { at: Date.now(), rows: fresh.rows, partial: fresh.partial })
        return fresh
      })())
      google = await platformFromRows(true, loaded.rows, loaded.partial, true)
    } catch (error) {
      const message = error instanceof AdSpendApiError ? error.message : 'Không đọc được chi phí Google Ads.'
      google = emptyPlatform(true, message)
    }
  }

  if (facebookOn) {
    const key = cacheKey('facebook', [creds.metaAdAccountId, creds.metaAccessToken, start, end, metaGraphApiVersion()].join('|'))
    try {
      const cached = readCache(key)
      const loaded = cached ?? (await (async () => {
        const fresh = await fetchMetaRows(creds, start, end)
        reportCache.set(key, { at: Date.now(), rows: fresh.rows, partial: fresh.partial })
        return fresh
      })())
      facebook = await platformFromRows(true, loaded.rows, loaded.partial, false)
    } catch (error) {
      const message = error instanceof AdSpendApiError ? error.message : 'Không đọc được chi phí Facebook Ads.'
      facebook = emptyPlatform(true, message)
    }
  }

  return {
    dateFrom: start,
    dateTo: end,
    google,
    facebook,
    ...combineAdSpendTotals({ google, facebook, googleConfigured: googleOn, facebookConfigured: facebookOn }),
  }
}
