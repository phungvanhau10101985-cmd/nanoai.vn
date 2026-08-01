import { createPrintReadyPdf } from '@/lib/print-ready-pdf'
import { getBagNetBounds, generateBagNetSvg, getBagPrintPanelRects } from '@/lib/packaging/bag-net-svg'
import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'
import { getBagStructuralGussetMm } from '@/lib/packaging/bag-dimensions'
import { normalizePanelArtworkToPrintSize } from '@/lib/packaging/panel-artwork-fit'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { ensureImageWithinLimits } from '@/lib/ensure-image-limits'
import sharp from 'sharp'

export { allBagFaceSlotsCommitted, allBagPrintFacesCommitted } from '@/lib/hub-chat/bag-kit-shared'

const PX_PER_MM = 300 / 25.4

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch bag panel image (${response.status}).`)
  const raw = Buffer.from(await response.arrayBuffer())
  return ensureImageWithinLimits(raw)
}

export async function exportBagDielinePdf(input: {
  userId: string
  dimensionsMm: BagDimensionsMm
  faceUrls?: Partial<Record<'back' | 'front', string | null | undefined>>
}): Promise<{ url: string; fileName: string } | { error: string }> {
  const gussetMm = getBagStructuralGussetMm(input.dimensionsMm)
  const dims = {
    widthMm: input.dimensionsMm.width,
    heightMm: input.dimensionsMm.height,
    gussetMm,
  }
  const bounds = getBagNetBounds(dims)
  const svg = generateBagNetSvg(dims)
  const targetW = Math.max(1, Math.ceil(bounds.widthMm * PX_PER_MM))
  const targetH = Math.max(1, Math.ceil(bounds.heightMm * PX_PER_MM))
  const svgSized = svg
    .replace(/width="[^"]+"/, `width="${targetW}"`)
    .replace(/height="[^"]+"/, `height="${targetH}"`)

  try {
    let pngBuffer = await sharp(Buffer.from(svgSized)).png().toBuffer()
    const panelRects = getBagPrintPanelRects(dims)
    const composites: sharp.OverlayOptions[] = []

    for (const slot of ['back', 'front'] as const) {
      const url = input.faceUrls?.[slot]?.trim()
      if (!url) continue
      const rect = panelRects[slot]
      const raw = await fetchImageBuffer(url)
      const fitted = await normalizePanelArtworkToPrintSize(raw, rect.widthMm, rect.heightMm)
      const panelW = Math.max(1, Math.round(rect.widthMm * PX_PER_MM))
      const panelH = Math.max(1, Math.round(rect.heightMm * PX_PER_MM))
      const panelPng = await sharp(fitted).resize(panelW, panelH, { fit: 'fill' }).png().toBuffer()
      composites.push({
        input: panelPng,
        left: Math.round(rect.xMm * PX_PER_MM),
        top: Math.round(rect.yMm * PX_PER_MM),
      })
    }

    if (composites.length) {
      pngBuffer = await sharp(pngBuffer).composite(composites).png().toBuffer()
    }

    const pdfBuffer = await createPrintReadyPdf(pngBuffer, {
      widthMm: Math.ceil(bounds.widthMm),
      heightMm: Math.ceil(bounds.heightMm),
    })
    const fileName = `bag-net-${Math.round(dims.widthMm)}x${Math.round(dims.heightMm)}x${Math.round(gussetMm)}mm.pdf`
    const pdfPath = `results/${input.userId}/${fileName.replace(/[^\w.-]+/g, '_')}_${Date.now()}.pdf`
    const { publicUrl } = await uploadTryOnImagePublic(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
    return { url: publicUrl, fileName }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
