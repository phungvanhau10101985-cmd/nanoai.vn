import {
  BOX_FACE_SLOT_ORDER,
  resolveBoxFaceUrl,
  type BoxCreatedFace,
  type BoxFaceSlot,
} from '@/lib/packaging/box-face-slots'

/** Shared rules so 3D mockup scene background never clones box face artwork. */
export const PACKAGING_MOCKUP_SCENE_RULES = `SCENE / BACKGROUND RULES (critical):
- Place the 3D box on a CONTRASTING studio surface or backdrop (soft neutral gray, white seamless cyclorama, light marble, or natural wood table).
- The scene background, floor, and environment must NOT reuse the box print texture, kraft paper grain, floral pattern, or decorative graphics from the packaging faces.
- Do NOT extend, tile, blur, mirror, or bleed box face artwork onto the background — print artwork exists ONLY on the box faces.
- Use realistic product-photography lighting and a clear contact shadow so the box separates from the background.`

export const PACKAGING_MOCKUP_FACE_RULES = `FACE MAPPING RULES:
- Wrap each attached flat face artwork onto its correct 3D box face without redesigning, stretching, or distorting.
- Preserve exact aspect ratio per face. Do not mirror one face onto another.
- Do NOT use a standalone logo image — logo is already part of the flat face prints when present.`

export type PackagingMockupFaceRef = { slot: BoxFaceSlot; url: string }

export function buildPackagingMockupRefsAndMapping(
  faces: Pick<BoxCreatedFace, 'slot' | 'url' | 'sourceMode'>[],
  box: { length: number; width: number; height: number }
): { refUrls: string[]; mappingBlock: string; resolvedFaces: PackagingMockupFaceRef[] } {
  const resolvedFaces = BOX_FACE_SLOT_ORDER.map((slot) => ({
    slot,
    url: resolveBoxFaceUrl(slot, faces as BoxCreatedFace[]),
  })).filter((f): f is PackagingMockupFaceRef => Boolean(f.url))

  const refUrls = resolvedFaces.map((f) => f.url)

  const faceDims: Record<BoxFaceSlot, string> = {
    top: `${box.length}×${box.width}mm (L×W)`,
    bottom: `${box.length}×${box.width}mm (L×W)`,
    front: `${box.length}×${box.height}mm (L×H)`,
    back: `${box.length}×${box.height}mm (L×H)`,
    right: `${box.width}×${box.height}mm (W×H)`,
    left: `${box.width}×${box.height}mm (W×H)`,
  }

  const emptySlots = BOX_FACE_SLOT_ORDER.filter(
    (slot) => !resolveBoxFaceUrl(slot, faces as BoxCreatedFace[])
  )

  const mappingLines = resolvedFaces.map(
    (f, i) =>
      `- Image ${i + 1} → ${f.slot.toUpperCase()} FACE. Face size: ${faceDims[f.slot]}. Apply without stretching.`,
  )
  if (emptySlots.length) {
    mappingLines.push(
      `- Plain unprinted kraft/cardboard (no design) on: ${emptySlots.map((s) => s.toUpperCase()).join(', ')}`,
    )
  }

  const minDim = Math.min(box.length, box.width, box.height)
  const ratioL = (box.length / minDim).toFixed(1)
  const ratioW = (box.width / minDim).toFixed(1)
  const ratioH = (box.height / minDim).toFixed(1)

  const mappingBlock = `CRITICAL — 3D mockup from ${resolvedFaces.length} flat print face(s), NOT from logo alone.
Box dimensions: ${box.length}mm (L) × ${box.width}mm (W) × ${box.height}mm (H). Proportions L:W:H = ${ratioL}:${ratioW}:${ratioH}.
Face aspect ratios: L×W = ${box.length}×${box.width}mm, L×H = ${box.length}×${box.height}mm, W×H = ${box.width}×${box.height}mm.

Apply EACH attached image ONLY to its mapped box face. Do NOT stretch, squash, mirror, or reuse one face on another.

Mapping (strict):
${mappingLines.join('\n')}

${PACKAGING_MOCKUP_SCENE_RULES}
${PACKAGING_MOCKUP_FACE_RULES}`

  return { refUrls, mappingBlock, resolvedFaces }
}
