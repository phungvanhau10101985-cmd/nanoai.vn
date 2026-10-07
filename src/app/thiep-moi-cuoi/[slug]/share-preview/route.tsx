import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { getPublishedWeddingCardBySlug } from '@/lib/db/wedding-cards-pg'
import { defaultPublicOrigin } from '@/lib/public-app-origin'
import { buildWeddingSharePreviewModel, buildWeddingSharePreviewSvg } from '@/lib/wedding/wedding-share-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FONT_DIR = path.join(process.cwd(), 'src/lib/wedding/fonts')
const FONT_FILES = [
  path.join(FONT_DIR, 'BeVietnamPro-Regular.ttf'),
  path.join(FONT_DIR, 'BeVietnamPro-SemiBold.ttf'),
]

function absoluteArtUrl(raw: string) {
  const url = raw.trim()
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${defaultPublicOrigin()}${url}`
  return ''
}

async function loadArtDataUrl(raw: string) {
  const url = absoluteArtUrl(raw)
  if (!url) return ''
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok) return ''
    const type = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (type && !type.startsWith('image/')) return ''
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length < 32 || bytes.length > 12_000_000) return ''
    const jpeg = await sharp(bytes, { failOn: 'none' })
      .rotate()
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 72 })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return ''
  }
}

function renderSharePng(svg: string) {
  const image = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: 'Be Vietnam Pro',
    },
    textRendering: 1,
  })
  return image.render().asPng()
}

export async function GET(request: Request, context: { params: { slug: string } }) {
  const guest = new URL(request.url).searchParams.get('guest') || ''
  const card = await getPublishedWeddingCardBySlug(context.params.slug).catch(() => null)
  const model = buildWeddingSharePreviewModel(
    card ?? {
      groomName: '',
      brideName: '',
      weddingDate: null,
      weddingTime: '',
      venue: '',
      invitationText: '',
      selectedStyleId: 'luxury',
      masterImageUrl: null,
      sectionConfig: '',
      groomImageUrl: '',
      brideImageUrl: '',
    },
    guest,
  )
  const art = await loadArtDataUrl(model.backgroundUrl)
  const png = renderSharePng(buildWeddingSharePreviewSvg(model, art))
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
