import { NextResponse } from 'next/server'
import {
  baseCorsHeaders,
  guardPartnerInventorySearchApi,
  jsonWithCors,
} from '@/lib/messaging/partner-inventory-search-api-guard'
import { geminiProductSearchFromImageBufferViaVectorDb } from '@/lib/messaging/partner-gemini-image-search'
import {
  getPartnerPublicInventorySearchDefaultLimit,
  PARTNER_PUBLIC_INVENTORY_SEARCH_MAX,
} from '@/lib/messaging/partner-public-search-limits'

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

export async function OPTIONS(req: Request) {
  const h = new Headers(baseCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/**
 * API công khai (Bearer) cho web shop: multipart ảnh → tìm sản phẩm gần giống (Gemini image embedding + vector).
 */
export async function POST(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params

  const gate = await guardPartnerInventorySearchApi(req, partnerId, 'image-search')
  if (gate) return gate

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonWithCors(req, { error: 'Expected multipart/form-data.' }, 400)
  }

  const file = form.get('image') ?? form.get('file')
  if (!file || !(file instanceof Blob)) {
    return jsonWithCors(req, { error: 'Missing image field (multipart: image or file).' }, 400)
  }
  if (file.size === 0) {
    return jsonWithCors(req, { error: 'Empty file.' }, 400)
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return jsonWithCors(req, { error: 'Image too large (max ~5 MB).' }, 400)
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const type = (file.type || '').toLowerCase()
  const typeOk = type.startsWith('image/')
  const sniffOk = !type || type === 'application/octet-stream' ? bufferLooksLikeImage(buf) : false
  if (!typeOk && !sniffOk) {
    return jsonWithCors(req, { error: 'File must be an image (JPEG, PNG, WebP, or GIF).' }, 400)
  }

  const limitRaw = form.get('limit')
  let maxResults = getPartnerPublicInventorySearchDefaultLimit()
  if (typeof limitRaw === 'string' && limitRaw.trim()) {
    const n = parseInt(limitRaw, 10)
    if (Number.isFinite(n)) {
      maxResults = Math.min(PARTNER_PUBLIC_INVENTORY_SEARCH_MAX, Math.max(1, n))
    }
  }

  const geminiResult = await geminiProductSearchFromImageBufferViaVectorDb(buf, partnerId, {
    maxResults,
    userId: null,
  })
  const candidates = geminiResult.candidates
  const publicError = candidates.length > 0 ? null : geminiResult.error ?? null

  return jsonWithCors(
    req,
    {
      ok: true,
      products: candidates.map((c) => ({
        inventory_id: c.inventoryId,
        name: c.name,
        sku: c.sku,
        image_url: c.image_url,
        product_url: c.product_url ?? null,
        score: c.score ?? null,
        price_hint: c.price_hint?.trim() ? c.price_hint.trim() : null,
        color_variants: c.color_variants ?? [],
        color_image_urls: c.color_image_urls ?? [],
      })),
      error: publicError,
    },
    200
  )
}
