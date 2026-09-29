export type FacebookManagedPage = {
  id: string
  name: string
  accessToken: string
  pictureUrl: string | null
}

type GraphPageRow = {
  id?: string
  name?: string
  access_token?: string
  picture?: { data?: { url?: string } }
}

type GraphList = {
  data?: GraphPageRow[]
  paging?: { next?: string }
}

const PAGE_FIELDS = 'id,name,access_token,picture{url}'
const MAX_PAGES = 200

function pushPage(bucket: Map<string, FacebookManagedPage>, row: GraphPageRow, remaining: { n: number }) {
  if (remaining.n <= 0) return
  const id = String(row.id || '').trim()
  const accessToken = String(row.access_token || '').trim()
  if (!id || !accessToken || bucket.has(id)) return
  const pictureUrl = String(row.picture?.data?.url || '').trim() || null
  bucket.set(id, {
    id,
    name: String(row.name || '').trim() || id,
    accessToken,
    pictureUrl,
  })
  remaining.n -= 1
}

async function readGraphPageList(
  startUrl: string,
  bucket: Map<string, FacebookManagedPage>,
  remaining: { n: number }
) {
  let next: string | null = startUrl
  for (let guard = 0; next && remaining.n > 0 && guard < 8; guard += 1) {
    const res = await fetch(next, { method: 'GET', cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as GraphList | null
    if (!res.ok || !Array.isArray(json?.data)) return
    for (const row of json.data) {
      pushPage(bucket, row, remaining)
      if (remaining.n <= 0) return
    }
    next = typeof json.paging?.next === 'string' ? json.paging.next : null
  }
}

async function listBusinessIds(userAccessToken: string): Promise<string[]> {
  const url = new URL('https://graph.facebook.com/v21.0/me/businesses')
  url.searchParams.set('fields', 'id')
  url.searchParams.set('limit', '25')
  url.searchParams.set('access_token', userAccessToken)
  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
  const json = (await res.json().catch(() => null)) as { data?: Array<{ id?: string }> } | null
  if (!res.ok || !Array.isArray(json?.data)) return []
  return json.data.map((row) => String(row.id || '').trim()).filter(Boolean).slice(0, 15)
}

/** Page user quản trị: /me/accounts rồi Page thuộc Business Manager (giống Pancake). */
export async function listFacebookManagedPages(userAccessToken: string): Promise<FacebookManagedPage[]> {
  const bucket = new Map<string, FacebookManagedPage>()
  const remaining = { n: MAX_PAGES }
  const accounts = new URL('https://graph.facebook.com/v21.0/me/accounts')
  accounts.searchParams.set('fields', PAGE_FIELDS)
  accounts.searchParams.set('limit', '100')
  accounts.searchParams.set('access_token', userAccessToken)
  await readGraphPageList(accounts.toString(), bucket, remaining)

  const businessIds = await listBusinessIds(userAccessToken)
  for (const businessId of businessIds) {
    if (remaining.n <= 0) break
    for (const edge of ['owned_pages', 'client_pages'] as const) {
      if (remaining.n <= 0) break
      const edgeUrl = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(businessId)}/${edge}`)
      edgeUrl.searchParams.set('fields', PAGE_FIELDS)
      edgeUrl.searchParams.set('limit', '100')
      edgeUrl.searchParams.set('access_token', userAccessToken)
      await readGraphPageList(edgeUrl.toString(), bucket, remaining)
    }
  }

  return [...bucket.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

export async function exchangeFacebookLongLivedUserToken(params: {
  appId: string
  appSecret: string
  shortLivedToken: string
}): Promise<string> {
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', params.appId)
  url.searchParams.set('client_secret', params.appSecret)
  url.searchParams.set('fb_exchange_token', params.shortLivedToken)
  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
  const json = (await res.json().catch(() => null)) as { access_token?: string } | null
  const longLived = String(json?.access_token || '').trim()
  if (!res.ok || !longLived) return params.shortLivedToken
  return longLived
}
