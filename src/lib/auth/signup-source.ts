import type { NextRequest } from 'next/server'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'

export const SIGNUP_SOURCES = ['nanoai', 'customer_website', 'partner_website'] as const
export type SignupSource = (typeof SIGNUP_SOURCES)[number]

export type SignupSourceContext = {
  source: SignupSource
  partnerId?: string | null
  partnerSlug?: string | null
}

export function isSignupSource(value: unknown): value is SignupSource {
  return typeof value === 'string' && (SIGNUP_SOURCES as readonly string[]).includes(value)
}

export function parseSignupSource(raw: unknown, fallback: SignupSource): SignupSource {
  return isSignupSource(raw) ? raw : fallback
}

/**
 * Nguồn tạo tài khoản từ guest API (shop / widget).
 * Ưu tiên body `accountOrigin`, rồi Referer `/site/` → web khách, còn lại web đối tác.
 */
export function inferGuestSignupSource(
  request: NextRequest,
  bodyOrigin?: unknown,
  fallback: SignupSource = 'partner_website'
): SignupSource {
  if (isSignupSource(bodyOrigin)) return bodyOrigin
  const ref = String(request.headers.get('referer') || '')
  try {
    const path = new URL(ref).pathname || ''
    if (path.startsWith('/site/')) return 'customer_website'
    if (path.startsWith('/messaging/')) return 'partner_website'
  } catch {
    /* ignore */
  }
  if (ref.includes('/site/')) return 'customer_website'
  if (ref.includes('/messaging/')) return 'partner_website'
  return fallback
}

/** Suy nguồn từ `next` sau đăng nhập NanoAI (/auth). */
export function signupSourceFromLoginNext(next: string): SignupSource {
  const path = (String(next || '').split('?')[0] || '').trim()
  if (path.startsWith('/site/')) return 'customer_website'
  if (path.startsWith('/messaging/')) return 'partner_website'
  return 'nanoai'
}

export function extractPathSlugFromLoginNext(
  next: string
): { kind: 'site' | 'messaging'; slug: string } | null {
  const path = (String(next || '').split('?')[0] || '').trim()
  const site = path.match(/^\/site\/([^/]+)/)
  if (site?.[1]) {
    try {
      return { kind: 'site', slug: decodeURIComponent(site[1]).trim().toLowerCase() }
    } catch {
      return { kind: 'site', slug: site[1].trim().toLowerCase() }
    }
  }
  const msg = path.match(/^\/messaging\/p\/([^/]+)/)
  if (msg?.[1]) {
    try {
      return { kind: 'messaging', slug: decodeURIComponent(msg[1]).trim().toLowerCase() }
    } catch {
      return { kind: 'messaging', slug: msg[1].trim().toLowerCase() }
    }
  }
  return null
}

async function resolvePartnerRef(input: {
  partnerId?: string | null
  partnerSlug?: string | null
  loginNext?: string | null
}): Promise<{ partnerId: string | null; partnerSlug: string | null }> {
  let partnerId = String(input.partnerId ?? '').trim() || null
  let partnerSlug = String(input.partnerSlug ?? '').trim().toLowerCase() || null

  if (!partnerId && !partnerSlug && input.loginNext) {
    const extracted = extractPathSlugFromLoginNext(input.loginNext)
    if (extracted?.kind === 'messaging') {
      partnerSlug = extracted.slug
    } else if (extracted?.kind === 'site') {
      const site = await pgQueryOne<{ partner_id: string; partner_slug: string }>(
        `select w.partner_id::text as partner_id, p.slug as partner_slug
         from public.messaging_partner_websites w
         join public.messaging_partners p on p.id = w.partner_id
         where lower(w.site_slug) = $1
         limit 1`,
        [extracted.slug]
      )
      if (site?.partner_id) {
        partnerId = site.partner_id
        partnerSlug = site.partner_slug?.trim().toLowerCase() || extracted.slug
      } else {
        partnerSlug = extracted.slug
      }
    }
  }

  if (partnerId && !partnerSlug) {
    const row = await pgQueryOne<{ slug: string }>(
      `select slug from public.messaging_partners where id = $1::uuid limit 1`,
      [partnerId]
    )
    partnerSlug = row?.slug?.trim().toLowerCase() || null
  } else if (!partnerId && partnerSlug) {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text as id from public.messaging_partners where slug = $1 limit 1`,
      [partnerSlug]
    )
    partnerId = row?.id?.trim() || null
  }

  return { partnerId, partnerSlug }
}

/** Ghi nguồn tạo tài khoản chỉ khi chưa có (first-write-wins). */
export async function setProfileSignupSourceIfEmpty(params: {
  userId: string
  source: SignupSource
  partnerId?: string | null
  partnerSlug?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  const userId = String(params.userId || '').trim()
  if (!userId || !isSignupSource(params.source)) return

  const { partnerId, partnerSlug } = await resolvePartnerRef({
    partnerId: params.partnerId,
    partnerSlug: params.partnerSlug,
  })

  try {
    await pgQuery(
      `update public.profiles
       set signup_source = $2,
           signup_partner_id = coalesce($3::uuid, signup_partner_id),
           signup_partner_slug = coalesce(nullif($4, ''), signup_partner_slug)
       where id = $1::uuid
         and signup_source is null`,
      [userId, params.source, partnerId, partnerSlug]
    )
  } catch (e) {
    console.warn('[setProfileSignupSourceIfEmpty]', e)
  }
}

export async function markNewUserSignupSource(params: {
  userId: string
  isNewUser: boolean
  source: SignupSource
  partnerId?: string | null
  partnerSlug?: string | null
  loginNext?: string | null
}): Promise<void> {
  if (!params.isNewUser) return
  const userId = String(params.userId || '').trim()
  if (!userId) return

  let source = params.source
  if (params.loginNext) {
    const fromNext = signupSourceFromLoginNext(params.loginNext)
    if (source === 'nanoai' && fromNext !== 'nanoai') {
      source = fromNext
    }
  }

  const { partnerId, partnerSlug } = await resolvePartnerRef({
    partnerId: params.partnerId,
    partnerSlug: params.partnerSlug,
    loginNext: params.loginNext,
  })

  await setProfileSignupSourceIfEmpty({
    userId,
    source,
    partnerId,
    partnerSlug,
  })
}
