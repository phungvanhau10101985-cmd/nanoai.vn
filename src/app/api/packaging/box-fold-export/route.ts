import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { pgGetHubChatThread } from '@/lib/db/hub-chat-pg'
import { BOX_FACE_SLOT_ORDER, resolveDielineSlotUrls, type BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import { applyBoxNetFaceMap, normalizeBoxNetFaceMap } from '@/lib/packaging/box-net-face-map'
import { createBoxDielinePackage } from '@/lib/packaging/box-dieline-pdf'
import { boxDielineStructureSlug, DIELINE_STRUCTURE_VERSION, resolveBoxDielineStructure } from '@/lib/packaging/dieline-structure'
import { faceSlotsToCreatedFaces } from '@/lib/packaging/hub-face-steps'
import { renderBoxMockupPng } from '@/lib/packaging/render-box-mockup'
import { normalizeTuckBoxProductionParams, type TuckBoxProductionParams } from '@/lib/packaging/tuck-box-production'
import { ensureImageWithinLimits } from '@/lib/ensure-image-limits'

export const runtime = 'nodejs'
export const maxDuration = 120

function attachment(bytes: Buffer, type: string, fileName: string) {
  return new NextResponse(new Blob([new Uint8Array(bytes)]), {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}

async function readSlotImage(url: string): Promise<Buffer> {
  if (!/^https?:\/\//i.test(url)) throw new Error('image')
  const response = await fetch(url)
  if (!response.ok) throw new Error('image')
  return ensureImageWithinLimits(Buffer.from(await response.arrayBuffer()))
}

export async function POST(request: NextRequest) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: 'login' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as {
    threadId?: unknown
    kind?: unknown
    structure?: unknown
    production?: unknown
    faceMap?: unknown
  } | null
  const threadId = typeof body?.threadId === 'string' ? body.threadId : ''
  const kind = body?.kind === 'mockup' || body?.kind === 'dieline' ? body.kind : null
  if (!/^[0-9a-f-]{36}$/i.test(threadId) || !kind) {
    return NextResponse.json({ error: 'download_failed' }, { status: 400 })
  }

  try {
    const thread = await pgGetHubChatThread(auth.user.id, threadId)
    const packaging = thread?.session?.presetId === 'packaging_kit' ? thread.session.packaging : null
    const dimensions = packaging?.dimensionsMm
    if (!dimensions?.length || !dimensions.width || !dimensions.height) {
      return NextResponse.json({ error: 'download_failed' }, { status: 404 })
    }

    const structure = resolveBoxDielineStructure(
      typeof body?.structure === 'string' ? body.structure : packaging?.dielineStructure,
      typeof body?.structure === 'string' ? DIELINE_STRUCTURE_VERSION : packaging?.dielineStructureVersion
    )
    const production = normalizeTuckBoxProductionParams(
      {
        ...packaging?.production,
        ...(body?.production && typeof body.production === 'object'
          ? (body.production as Partial<TuckBoxProductionParams>)
          : {}),
      },
      dimensions.height
    )
    const faceSlots = applyBoxNetFaceMap(
      packaging?.faceSlots ?? {},
      normalizeBoxNetFaceMap(body?.faceMap)
    )
    const size = `${dimensions.length}x${dimensions.width}x${dimensions.height}mm`

    if (kind === 'mockup') {
      const png = await renderBoxMockupPng({
        faces: [],
        faceSlots,
        box: dimensions,
      })
      return attachment(png, 'image/png', `box-mockup-${size}.png`)
    }

    const slotUrls = resolveDielineSlotUrls(faceSlotsToCreatedFaces(faceSlots))
    const slotBuffers: Partial<Record<BoxFaceSlot, Buffer>> = {}
    await Promise.all(
      BOX_FACE_SLOT_ORDER.map(async (slot) => {
        const url = slotUrls[slot]
        if (!url) return
        slotBuffers[slot] = await readSlotImage(url)
      })
    )
    const bodyStripUrl = packaging?.layout === 'hybrid_strip' ? packaging.bodyStrip?.originalUrl : undefined
    const packed = await createBoxDielinePackage({
      slotBuffers,
      bodyStripBuffer: bodyStripUrl ? await readSlotImage(bodyStripUrl) : undefined,
      boxLength: dimensions.length,
      boxWidth: dimensions.width,
      boxHeight: dimensions.height,
      production,
      structure,
    })
    const fileName = `box-dieline-${boxDielineStructureSlug(structure)}-${size}.pdf`
    return attachment(packed.pdfBuffer, 'application/pdf', fileName)
  } catch (error) {
    console.error('box-fold-export failed', error instanceof Error ? error.message : 'error')
    return NextResponse.json({ error: 'download_failed' }, { status: 500 })
  }
}
