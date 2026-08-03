import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { geminiProductSearchFromImageBufferViaVectorDb } from '@/lib/messaging/partner-gemini-image-search'
import {
  getPartnerPublicInventorySearchDefaultLimit,
  PARTNER_PUBLIC_INVENTORY_SEARCH_MAX,
} from '@/lib/messaging/partner-public-search-limits'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function bufferLooksLikeImage(buf: Buffer): boolean {
  if (buf.length < 12) return false
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true
  return false
}

/**
 * Same-platform shop image search — no Bearer key.
 * Resolves partner from published site slug, then Gemini image embed + vector match.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = form.get('image') ?? form.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing image field (image or file)' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image too large (max ~5 MB)' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const type = (file.type || '').toLowerCase()
  const typeOk = type.startsWith('image/')
  const sniffOk = !type || type === 'application/octet-stream' ? bufferLooksLikeImage(buf) : false
  if (!typeOk && !sniffOk) {
    return NextResponse.json(
      { error: 'File must be an image (JPEG, PNG, WebP, or GIF)' },
      { status: 400 }
    )
  }

  let maxResults = getPartnerPublicInventorySearchDefaultLimit()
  const limitRaw = form.get('limit')
  if (typeof limitRaw === 'string' && limitRaw.trim()) {
    const n = parseInt(limitRaw, 10)
    if (Number.isFinite(n)) {
      maxResults = Math.min(PARTNER_PUBLIC_INVENTORY_SEARCH_MAX, Math.max(1, n))
    }
  }

  const geminiResult = await geminiProductSearchFromImageBufferViaVectorDb(buf, shop.partnerId, {
    maxResults,
    userId: null,
  })
  const candidates = geminiResult.candidates
  const siteSlug = shop.site.siteSlug

  return NextResponse.json({
    ok: true,
    source: 'image_vector',
    products: candidates.map((c) => ({
      id: c.inventoryId,
      inventory_id: c.inventoryId,
      name: c.name,
      sku: c.sku,
      imageUrl: c.image_url,
      image_url: c.image_url,
      productUrl: c.product_url ?? null,
      product_url: c.product_url ?? null,
      priceHint: c.price_hint?.trim() ? c.price_hint.trim() : null,
      price_hint: c.price_hint?.trim() ? c.price_hint.trim() : null,
      score: c.score ?? null,
      detailPath: partnerSiteProductPath(siteSlug, c.inventoryId, { name: c.name }),
      color_variants: c.color_variants ?? [],
      color_image_urls: c.color_image_urls ?? [],
    })),
    error: candidates.length > 0 ? null : geminiResult.error ?? null,
  })
}
