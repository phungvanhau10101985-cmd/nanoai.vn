/** Đọc chi phí Google Ads và Facebook Ads của một shop. Không ghi log khóa bí mật. */

import { createHash, createPrivateKey, sign } from 'node:crypto'

export const AD_SPEND_MAX_RANGE_DAYS = 366
const CACHE_TTL_MS = 180_000
/** Đổi khi đổi cách đếm chuyển đổi, để cache 3 phút không giữ bản cũ. */
const METRICS_VERSION = 'purchase2'

/** Một sự kiện mua có thể nằm ở nhiều action_type. Lấy loại đầu tiên có số, ưu tiên omni_purchase vì Meta đã gộp kênh. */
const META_PURCHASE_TYPES = [
  'omni_purchase',
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'onsite_web_purchase',
  'web_in_store_purchase',
  'onsite_conversion.purchase',
] as const

export type AdSpendDay = {
  date: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  conversionValue: number
}

export type AdSpendCampaign = {
  id: string
  name: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  conversionValue: number
}

export type AdSpendPlatformReport = {
  configured: boolean
  ok: boolean
  error: string | null
  currency: string | null
  spend: number
  impressions: number
  clicks: number
  conversions: number
  conversionValue: number
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
  googleCustomerId: string
  googleLoginCustomerId: string
  googleServiceAccountJson: string
  metaAccessToken: string
  metaAdAccountId: string
}

export type GoogleServiceAccountKey = {
  clientEmail: string
  privateKey: string
  privateKeyId: string
}

export class AdSpendApiError extends Error {}

type CacheEntry = { at: number; rows: Record<string, unknown>[]; partial: boolean }
const reportCache = new Map<string, CacheEntry>()

/** Chi phí, nhấn, hiển thị. Không lấy conversions ở đây vì cột đó gồm mọi mục tiêu, không chỉ lượt mua. */
export function googleSpendQuery(start: string, end: string): string {
  return [
    'SELECT segments.date, campaign.id, campaign.name,',
    'metrics.cost_micros, metrics.impressions, metrics.clicks, customer.currency_code',
    'FROM campaign',
    `WHERE segments.date BETWEEN '${start}' AND '${end}'`,
    'AND metrics.cost_micros > 0',
  ].join(' ')
}

/**
 * Lượt mua và giá trị mua. Cùng truy vấn với cost_micros sẽ bị Google nhân chi phí theo từng loại chuyển đổi.
 * Segment trong WHERE bắt buộc có mặt trong SELECT, nếu không Google trả invalid argument và cả thẻ thành lỗi.
 */
export function googlePurchaseQuery(start: string, end: string): string {
  return [
    'SELECT segments.date, campaign.id, campaign.name, segments.conversion_action_category,',
    'metrics.conversions, metrics.conversions_value, customer.currency_code',
    'FROM campaign',
    `WHERE segments.date BETWEEN '${start}' AND '${end}'`,
    'AND segments.conversion_action_category = PURCHASE',
  ].join(' ')
}

/** Tài khoản bị Google khóa thì nói rõ, không để câu tiếng Anh của API. */
export function explainGoogleAdsFailure(message: string): string {
  const text = message.toLowerCase()
  const accountLocked =
    text.includes('customer_not_enabled') ||
    text.includes('not yet enabled') ||
    text.includes('has been deactivated') ||
    (text.includes('customer') && text.includes('not enabled'))
  if (accountLocked) {
    return 'Google đang khóa tài khoản quảng cáo, thường vì chậm thanh toán. Khóa JSON đã lưu vẫn giữ. Sau khi trả tiền, trang đọc lại được mà không cần đăng nhập lại.'
  }
  return message
}

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

/** Nhận nguyên file JSON tải từ Google Cloud; trả null nếu thiếu email hoặc khóa PEM. */
export function parseGoogleServiceAccountJson(raw: string | null | undefined): GoogleServiceAccountKey | null {
  const text = String(raw ?? '').trim()
  if (!text) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const body = parsed as { client_email?: unknown; private_key?: unknown; private_key_id?: unknown }
  const clientEmail = String(body.client_email ?? '').trim()
  const privateKey = String(body.private_key ?? '').replace(/\\n/g, '\n').trim()
  if (!clientEmail.includes('@') || !privateKey.includes('PRIVATE KEY')) return null
  return { clientEmail, privateKey, privateKeyId: String(body.private_key_id ?? '').trim() }
}

export function googleConfigured(creds: AdSpendCredentials): boolean {
  if (!creds.googleCustomerId) return false
  return Boolean(parseGoogleServiceAccountJson(creds.googleServiceAccountJson))
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

type MetricBucket = {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  conversionValue: number
}

function emptyBucket(): MetricBucket {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 }
}

/** Không cộng các action_type trùng cùng một lượt mua. */
export function metaPurchaseAmount(actions: unknown): number {
  if (!Array.isArray(actions)) return 0
  const found = new Map<string, number>()
  for (const item of actions) {
    if (!item || typeof item !== 'object') continue
    const name = String((item as { action_type?: unknown }).action_type ?? '').trim()
    if (!name) continue
    found.set(name, asFloat((item as { value?: unknown }).value))
  }
  for (const name of META_PURCHASE_TYPES) {
    const amount = found.get(name) || 0
    if (amount) return amount
  }
  return 0
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
    conversionsKey?: string
    conversionValueKey?: string
  },
): Omit<AdSpendPlatformReport, 'configured' | 'ok' | 'error' | 'partial'> {
  const conversionsKey = opts.conversionsKey ?? 'conversions'
  const conversionValueKey = opts.conversionValueKey ?? 'conversion_value'
  const daily = new Map<string, MetricBucket>()
  const campaigns = new Map<string, AdSpendCampaign>()
  let currency: string | null = null
  for (const row of rows) {
    const day = String(row[opts.dateKey] ?? '').trim()
    const spend = opts.spendIsMicros ? microsToAmount(row[opts.spendKey]) : asFloat(row[opts.spendKey])
    const impressions = asInt(row[opts.impressionsKey])
    const clicks = asInt(row[opts.clicksKey])
    const conversions = asFloat(row[conversionsKey])
    const conversionValue = asFloat(row[conversionValueKey])
    const code = String(row[opts.currencyKey] ?? '').trim()
    if (code && !currency) currency = code
    if (day) {
      const bucket = daily.get(day) ?? emptyBucket()
      bucket.spend += spend
      bucket.impressions += impressions
      bucket.clicks += clicks
      bucket.conversions += conversions
      bucket.conversionValue += conversionValue
      daily.set(day, bucket)
    }
    const cid = String(row[opts.campaignIdKey] ?? '').trim() || String(row[opts.campaignNameKey] ?? '').trim()
    if (!cid) continue
    const camp = campaigns.get(cid) ?? {
      id: cid,
      name: String(row[opts.campaignNameKey] ?? cid),
      ...emptyBucket(),
    }
    camp.spend += spend
    camp.impressions += impressions
    camp.clicks += clicks
    camp.conversions += conversions
    camp.conversionValue += conversionValue
    campaigns.set(cid, camp)
  }
  const dailyRows = [...daily.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, values]) => ({
      date,
      spend: roundMoney(values.spend),
      impressions: values.impressions,
      clicks: values.clicks,
      conversions: roundMoney(values.conversions),
      conversionValue: roundMoney(values.conversionValue),
    }))
  const campaignRows = [...campaigns.values()]
    .map((item) => ({
      ...item,
      spend: roundMoney(item.spend),
      conversions: roundMoney(item.conversions),
      conversionValue: roundMoney(item.conversionValue),
    }))
    .sort((a, b) => b.spend - a.spend)
  return {
    currency,
    spend: roundMoney(dailyRows.reduce((sum, item) => sum + item.spend, 0)),
    impressions: dailyRows.reduce((sum, item) => sum + item.impressions, 0),
    clicks: dailyRows.reduce((sum, item) => sum + item.clicks, 0),
    conversions: roundMoney(dailyRows.reduce((sum, item) => sum + item.conversions, 0)),
    conversionValue: roundMoney(dailyRows.reduce((sum, item) => sum + item.conversionValue, 0)),
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
    conversions: 0,
    conversionValue: 0,
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
  let message = 'Google Ads từ chối yêu cầu.'
  if (payload && typeof payload === 'object') {
    const body = payload as { error?: unknown; error_description?: unknown }
    if (typeof body.error === 'string') {
      const desc = String(body.error_description || body.error).trim()
      message = `Không lấy được token Google: ${desc}`
    } else if (body.error && typeof body.error === 'object') {
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
            const code = (item as { errorCode?: unknown }).errorCode
            if (code && typeof code === 'object') {
              const names = Object.values(code as Record<string, unknown>)
                .map((value) => String(value || '').trim())
                .filter(Boolean)
              extras.push(...names)
            }
            if (text) extras.push(text)
          }
        }
      }
      message = extras.length ? `${msg} ${extras.slice(0, 3).join(' ')}` : msg
    }
  }
  return explainGoogleAdsFailure(message)
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

export function buildServiceAccountAssertion(key: GoogleServiceAccountKey, nowSeconds: number): string {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const header: Record<string, unknown> = { alg: 'RS256', typ: 'JWT' }
  if (key.privateKeyId) header.kid = key.privateKeyId
  const unsigned = `${encode(header)}.${encode({
    iss: key.clientEmail,
    scope: 'https://www.googleapis.com/auth/adwords',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  })}`
  let signature: string
  try {
    signature = sign('RSA-SHA256', Buffer.from(unsigned), createPrivateKey(key.privateKey)).toString('base64url')
  } catch {
    throw new AdSpendApiError('Khóa service account Google không hợp lệ.')
  }
  return `${unsigned}.${signature}`
}

async function serviceAccountAccessToken(key: GoogleServiceAccountKey): Promise<string> {
  const assertion = buildServiceAccountAssertion(key, Math.floor(Date.now() / 1000))
  let response: Response
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
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

async function googleAccessToken(creds: AdSpendCredentials): Promise<string> {
  const serviceAccount = parseGoogleServiceAccountJson(creds.googleServiceAccountJson)
  if (!serviceAccount) throw new AdSpendApiError('Cần file JSON service account để đọc Google Ads.')
  return serviceAccountAccessToken(serviceAccount)
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
  }
  if (input.developerToken) headers['developer-token'] = input.developerToken
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
          conversions: metrics.conversions,
          conversion_value: metrics.conversionsValue ?? metrics.conversions_value,
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
    fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,date_start,account_currency',
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
          conversions: metaPurchaseAmount(row.actions),
          conversion_value: metaPurchaseAmount(row.action_values),
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
      [
        creds.googleCustomerId,
        creds.googleDeveloperToken,
        creds.googleServiceAccountJson,
        creds.googleLoginCustomerId,
        start,
        end,
        googleAdsApiVersion(),
        METRICS_VERSION,
      ].join('|'),
    )
    try {
      const cached = readCache(key)
      const loaded = cached ?? (await (async () => {
        const token = await googleAccessToken(creds)
        const search = {
          customerId: creds.googleCustomerId,
          accessToken: token,
          developerToken: creds.googleDeveloperToken,
          loginCustomerId: creds.googleLoginCustomerId,
        }
        const spend = await searchGoogleAds({ ...search, query: googleSpendQuery(start, end) })
        let purchases: { rows: Record<string, unknown>[]; partial: boolean } = { rows: [], partial: false }
        let purchaseError = ''
        try {
          purchases = await searchGoogleAds({ ...search, query: googlePurchaseQuery(start, end) })
        } catch (error) {
          const raw = error instanceof AdSpendApiError ? error.message : 'Không đọc được lượt mua Google Ads.'
          purchaseError = raw.startsWith('Google đang khóa')
            ? raw
            : `Đã đọc chi phí. Lượt mua chưa đọc được: ${raw}`
        }
        const fresh = {
          rows: [...spend.rows, ...purchases.rows],
          partial: spend.partial || purchases.partial,
          purchaseError,
        }
        if (!purchaseError) reportCache.set(key, { at: Date.now(), rows: fresh.rows, partial: fresh.partial })
        return fresh
      })())
      google = await platformFromRows(true, loaded.rows, loaded.partial, true)
      const purchaseError = 'purchaseError' in loaded && typeof loaded.purchaseError === 'string' ? loaded.purchaseError : ''
      if (purchaseError) google = { ...google, error: purchaseError }
    } catch (error) {
      const message = error instanceof AdSpendApiError ? error.message : 'Không đọc được chi phí Google Ads.'
      google = emptyPlatform(true, explainGoogleAdsFailure(message))
    }
  }

  if (facebookOn) {
    const key = cacheKey(
      'facebook',
      [creds.metaAdAccountId, creds.metaAccessToken, start, end, metaGraphApiVersion(), METRICS_VERSION].join('|'),
    )
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
