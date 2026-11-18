import type { WebLocale } from '@/lib/i18n/config'
import { WEB_LOCALES } from '@/lib/i18n/config'
import type {
  HubPackagingState,
  HubStudioMessagePayload,
  HubStudioProcessStep,
  HubStudioSession,
} from '@/lib/hub-chat/hub-studio-types'
import {
  boxDielineStructureCopy,
  BOX_DIELINE_STRUCTURE_KEYS,
  parseBoxDielineStructure,
  resolveBoxDielineStructure,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'
import { generateTuckEndBlankSvg, getBoxDielineLayoutData } from '@/lib/packaging/box-net-svg'
import type { PackagingFaceKey } from './dimensions'
import { getFaceDimensionsMm, normalizeBoxDimensionsMm } from './dimensions'
import {
  type BoxFaceSlot,
  type BoxCreatedFace,
  type FaceSourceMode,
  BOX_FACE_COPY_SOURCE,
  BOX_FACE_SLOT_ORDER,
  getSizeKeyForSlot,
  isSecondaryBoxFaceSlot,
  resolveBoxFaceUrl,
  resolveDielineFaceUrls,
  resolveMockupSlotUrl,
} from './box-face-slots'
import { getBodyStripSizeMm } from './body-strip'

/** Hub studio step keys — thứ tự: trên → trước → phải → dưới → sau → trái */
export const HUB_PACKAGING_FACE_STEP_KEYS = [
  'face_top',
  'face_front',
  'face_right',
  'face_bottom',
  'face_back',
  'face_left',
] as const

export type HubPackagingFaceStepKey = (typeof HUB_PACKAGING_FACE_STEP_KEYS)[number]

export function isFirstPackagingFaceStep(stepKey: string | null | undefined): boolean {
  return stepKey === HUB_PACKAGING_FACE_STEP_KEYS[0]
}

export function getPrimaryPackagingStyleFaceStepKey(): HubPackagingFaceStepKey {
  return HUB_PACKAGING_FACE_STEP_KEYS[0]
}

/** Approved face artwork URL — from referenceImages or committed faceSlots. */
export function resolvePackagingFaceReferenceUrl(
  session: HubStudioSession,
  stepKey: string
): string | null {
  const ref = session.referenceImages.find((r) => r.screenKey === stepKey)
  if (ref?.url) return ref.url
  const slot = packagingStepKeyToSlot(stepKey)
  if (!slot) return null
  const face = session.packaging?.faceSlots?.[slot]
  if (face?.url && face.sourceMode !== 'empty') return face.url
  return null
}

export function hasApprovedPrimaryPackagingFace(session: HubStudioSession): boolean {
  return Boolean(resolvePackagingFaceReferenceUrl(session, getPrimaryPackagingStyleFaceStepKey()))
}

export const PACKAGING_STYLE_REFERENCE_SCREEN_KEY = 'packaging_style_reference'

/** User-uploaded mood/style board URL (face #1 only). */
export function resolvePackagingStyleReferenceUrl(session: HubStudioSession): string | null {
  const url =
    session.generationSelection?.styleReferenceUrl?.trim() ||
    session.packaging?.styleReferenceUrl?.trim() ||
    ''
  return url || null
}

const LEGACY_STEP_TO_SLOT: Record<string, BoxFaceSlot> = {
  face_lxw: 'top',
  face_lxh: 'front',
  face_wxh: 'right',
}

const STEP_TO_SLOT: Record<string, BoxFaceSlot> = {
  face_top: 'top',
  face_front: 'front',
  face_right: 'right',
  face_bottom: 'bottom',
  face_back: 'back',
  face_left: 'left',
  ...LEGACY_STEP_TO_SLOT,
}

export type HubPackagingFaceSlotEntry = {
  sourceMode: FaceSourceMode
  url?: string
}

export function isPackagingFaceStepKey(stepKey: string): boolean {
  return stepKey === 'body_strip' || stepKey in STEP_TO_SLOT
}

/** Mặt đã từng chốt (ảnh / bỏ trống / sao chép) — sửa lại không đi tiếp flow mặt mới. */
export function isPackagingFaceReEdit(session: HubStudioSession, stepKey: string): boolean {
  if (session.presetId !== 'packaging_kit') return false
  if (!isPackagingFaceStepKey(stepKey)) return false
  if (session.referenceImages.some((reference) => reference.screenKey === stepKey)) return true
  if (stepKey === 'body_strip') {
    return Boolean(session.packaging?.bodyStrip?.originalUrl)
  }
  const slot = packagingStepKeyToSlot(stepKey)
  if (!slot) return false
  return session.packaging?.faceSlots?.[slot] != null
}

export function packagingStepKeyToSlot(stepKey: string): BoxFaceSlot | null {
  return STEP_TO_SLOT[stepKey] ?? null
}

export function packagingStepKeyToSizeKey(stepKey: string): PackagingFaceKey | null {
  const slot = packagingStepKeyToSlot(stepKey)
  return slot ? getSizeKeyForSlot(slot) : null
}

export function hubFaceStepKeyForSlot(slot: BoxFaceSlot): HubPackagingFaceStepKey {
  return `face_${slot}` as HubPackagingFaceStepKey
}

export function faceSlotsToCreatedFaces(
  faceSlots: Partial<Record<BoxFaceSlot, HubPackagingFaceSlotEntry>>
): BoxCreatedFace[] {
  return BOX_FACE_SLOT_ORDER.filter((slot) => faceSlots[slot]).map((slot) => {
    const entry = faceSlots[slot]!
    return {
      id: slot,
      slot,
      sizeKey: getSizeKeyForSlot(slot),
      sourceMode: entry.sourceMode,
      url: entry.url ?? null,
    }
  })
}

export function syncResolvedPackagingFaces(packaging: HubPackagingState): HubPackagingState {
  const faceSlots = packaging.faceSlots ?? {}
  const created = faceSlotsToCreatedFaces(faceSlots)
  const resolved = resolveDielineFaceUrls(created)
  const faces: Partial<Record<PackagingFaceKey, string>> = {}
  if (resolved.LxW) faces.LxW = resolved.LxW
  if (resolved.LxH) faces.LxH = resolved.LxH
  if (resolved.WxH) faces.WxH = resolved.WxH
  return { ...packaging, faces }
}

export function allHubPackagingFaceStepsFilled(packaging: HubPackagingState | undefined): boolean {
  if (!packaging?.faceSlots) return false
  return BOX_FACE_SLOT_ORDER.every((slot) => packaging.faceSlots![slot])
}

/** Mặt đã chốt (tạo ảnh, sao chép, hoặc bỏ trống) — không cần referenceImages. */
export function isPackagingFaceStepCommitted(
  packaging: HubPackagingState | undefined,
  stepKey: string
): boolean {
  if (stepKey === 'body_strip') {
    return Boolean(
      packaging?.bodyStrip?.originalUrl &&
      packaging.faceSlots?.front &&
      packaging.faceSlots?.right &&
      packaging.faceSlots?.back &&
      packaging.faceSlots?.left
    )
  }
  const slot = packagingStepKeyToSlot(stepKey)
  if (!slot || !packaging?.faceSlots) return false
  return packaging.faceSlots[slot] != null
}

/** Gom ảnh từng mặt hộp (không logo) — mỗi vị trí giữ đúng ảnh đã tạo. */
export function preparePackagingFaceSlotsForArtifact(input: {
  packaging: HubPackagingState | undefined
  referenceImages: { screenKey: string; url: string }[]
  processSteps: { key: string; status: string }[]
}): HubPackagingState {
  const packaging = input.packaging ?? { version: 2 as const, dimensionsMm: null, faces: {} }
  const faceSlots: Partial<Record<BoxFaceSlot, HubPackagingFaceSlotEntry>> = {
    ...(packaging.faceSlots ?? {}),
  }

  for (const stepKey of HUB_PACKAGING_FACE_STEP_KEYS) {
    const slot = packagingStepKeyToSlot(stepKey)
    if (!slot) continue
    const ref = input.referenceImages.find((r) => r.screenKey === stepKey)
    if (ref?.url) {
      faceSlots[slot] = { sourceMode: 'generate', url: ref.url }
    }
  }

  for (const stepKey of HUB_PACKAGING_FACE_STEP_KEYS) {
    const slot = packagingStepKeyToSlot(stepKey)
    if (!slot || faceSlots[slot]) continue
    const proc = input.processSteps.find((s) => s.key === stepKey)
    if (proc?.status === 'done' || proc?.status === 'skipped') {
      faceSlots[slot] = { sourceMode: 'empty' }
    }
  }

  return syncResolvedPackagingFaces({ ...packaging, faceSlots })
}

export function faceSlotsToMockupFaces(
  faceSlots: Partial<Record<BoxFaceSlot, HubPackagingFaceSlotEntry>>
): Pick<BoxCreatedFace, 'slot' | 'url' | 'sourceMode'>[] {
  return BOX_FACE_SLOT_ORDER.map((slot) => {
    const entry = faceSlots[slot]
    const sourceMode = entry?.sourceMode ?? 'empty'
    return {
      slot,
      sourceMode,
      url: sourceMode === 'empty' ? null : (entry?.url ?? null),
    }
  })
}

/** All six face slots committed (generate, copy, or empty). */
export function allPackagingFaceSlotsCommitted(packaging: HubPackagingState | undefined): boolean {
  if (!packaging?.faceSlots) return false
  return BOX_FACE_SLOT_ORDER.every((slot) => packaging.faceSlots![slot] != null)
}

export function resolvedPackagingFacesReady(packaging: HubPackagingState | undefined): boolean {
  if (!packaging) return false
  const created = faceSlotsToCreatedFaces(packaging.faceSlots ?? {})
  const resolved = resolveDielineFaceUrls(created)
  return Boolean(resolved.LxW && resolved.LxH && resolved.WxH)
}

/** Mockup: URL theo từng slot; mặt copy dùng ảnh của mặt nguồn, không dùng logo. */
export function resolveMockupFaceUrls(packaging: HubPackagingState): Partial<Record<BoxFaceSlot, string>> {
  const faceSlots = packaging.faceSlots ?? {}
  const out: Partial<Record<BoxFaceSlot, string>> = {}
  for (const slot of BOX_FACE_SLOT_ORDER) {
    const url = resolveMockupSlotUrl(slot, faceSlots)
    if (url) out[slot] = url
  }
  return out
}

const EMPTY_PATTERNS =
  /\b(bỏ trống|bo trong|để trống|de trong|blank|empty|không in|khong in|no print|leave blank)\b/i
const COPY_PATTERNS =
  /\b(giống|giong|same as|copy|dùng giống|dung giong|như mặt|nhu mat|giống mặt|giong mat)\b/i

export function parseSecondaryFaceIntent(message: string, slot: BoxFaceSlot): FaceSourceMode | null {
  const trimmed = message.trim()
  if (!trimmed) return null
  if (EMPTY_PATTERNS.test(trimmed)) return 'empty'
  if (isSecondaryBoxFaceSlot(slot) && COPY_PATTERNS.test(trimmed)) return 'copy'
  return null
}

export function getPackagingFaceSizeForStep(
  dimensionsMm: { length: number; width: number; height: number } | null | undefined,
  stepKey: string
): { widthMm: number; heightMm: number } | null {
  const box = normalizeBoxDimensionsMm(dimensionsMm)
  if (!box) return null
  if (stepKey === 'body_strip') return getBodyStripSizeMm(box)
  const faceKey = packagingStepKeyToSizeKey(stepKey)
  if (!faceKey) return null
  const [widthMm, heightMm] = getFaceDimensionsMm(faceKey, box)
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    return null
  }
  return { widthMm, heightMm }
}

const BOX_FOLD_HANDOFF_REPLY: Record<WebLocale, (screen: string) => string> = {
  vi: (screen) =>
    `Đã lưu ảnh cho ${screen}. Bấm Mở trang dàn hộp ngay bên dưới để chọn kiểu gấp.`,
  en: (screen) =>
    `Saved the image for ${screen}. Use Open the box layout just below to choose the fold.`,
  zh: (screen) => `已保存 ${screen} 的图片。请点下方「打开盒型展开」选择盒型。`,
  ja: (screen) => `${screen} の画像を保存しました。すぐ下の「展開ページを開く」から折り方を選んでください。`,
  ko: (screen) => `${screen} 이미지를 저장했습니다. 바로 아래 «전개 페이지 열기»에서 접기 방식을 고르세요.`,
}

/** Ảnh thứ 6 (mặt trái) vừa xong và bước kế tiếp là dàn tờ trải. */
export function isBoxFoldHandoff(
  approvedStepKey: string | null | undefined,
  nextStepKey: string | null | undefined
): boolean {
  return approvedStepKey === 'face_left' && nextStepKey === 'box_net_2d'
}

export function boxFoldHandoffReply(locale: WebLocale, screenLabel: string): string {
  return BOX_FOLD_HANDOFF_REPLY[locale](screenLabel)
}

const BOX_FOLD_HANDOFF_MARKERS = [
  'Tiếp theo: Dàn 2D',
  'Next: 2D fold layout',
  '下一步：二维折叠展开',
  '次：2D展開',
  '다음: 2D 접기',
  'Mở trang dàn hộp ngay bên dưới',
  'Open the box layout just below',
  '请点下方「打开盒型展开」',
  'すぐ下の「展開ページを開く」',
  '바로 아래 «전개 페이지 열기»',
]

/** Câu bàn giao sau ảnh thứ 6. Không khớp câu mở đầu chỉ nhắc «dàn 2D». */
export function boxFoldHandoffText(content?: string | null): boolean {
  const text = content ?? ''
  return BOX_FOLD_HANDOFF_MARKERS.some((marker) => text.includes(marker))
}

/** Tin nhắn lưu ảnh mặt trái, lúc đó dàn 2D vừa được mở. */
export function studioMessageOpensBoxFold(
  studio:
    | {
        screenKey?: string
        showApproveReference?: boolean
        processSteps?: Pick<HubStudioProcessStep, 'key' | 'status'>[]
      }
    | null
    | undefined,
  content?: string | null
): boolean {
  if (studio?.showApproveReference) return false
  if (boxFoldHandoffText(content)) return true
  if (!studio || studio.screenKey !== 'face_left') return false
  return Boolean(
    studio.processSteps?.some((step) => step.key === 'box_net_2d' && step.status === 'in_progress')
  )
}

const FOLD_LABELS_LONGEST_FIRST = [...new Set(
  WEB_LOCALES.flatMap((locale) =>
    BOX_DIELINE_STRUCTURE_KEYS.map((key) => boxDielineStructureCopy(key, locale).label)
  )
)].sort((a, b) => b.length - a.length)

const DIELINE_DOWNLOAD: Record<WebLocale, string> = {
  vi: 'Tải Dieline PDF',
  en: 'Download Dieline PDF',
  zh: '下载 Dieline PDF',
  ja: 'Dieline PDFをダウンロード',
  ko: 'Dieline PDF 다운로드',
}

const FOLD_TOKEN = '\u0000fold\u0000'

/** Đổi mọi tên kiểu gấp trong câu thành kiểu đang chốt. */
export function rewriteFoldMentions(content: string, currentLabel: string): string {
  if (!currentLabel) return content
  let next = content.split(currentLabel).join(FOLD_TOKEN)
  for (const label of FOLD_LABELS_LONGEST_FIRST) {
    if (!label || label === currentLabel) continue
    if (next.includes(label)) next = next.split(label).join(FOLD_TOKEN)
  }
  return next.split(FOLD_TOKEN).join(currentLabel)
}

type FoldThreadLine = {
  role: string
  content: string
  studio?: HubStudioMessagePayload | null
}

export type ChosenFoldThreadInput = {
  locale: WebLocale
  structure?: string | null
  structureVersion?: number | null
  dimensionsMm?: { length: number; width: number; height: number } | null
  production?: HubPackagingState['production']
  mockupUrl?: string | null
  dielineUrl?: string | null
  dielineVariants?: HubPackagingState['dielineVariants']
  dielineCutter?: HubPackagingState['dielineCutter']
  dielineWarnings?: string[] | null
}

function currentDielineArtifacts(
  locale: WebLocale,
  structure: BoxDielineStructure,
  input: ChosenFoldThreadInput
): HubStudioMessagePayload['dielineArtifacts'] | null {
  const variant = input.dielineVariants?.[structure]
  const url = variant?.url || input.dielineUrl || ''
  if (!url) return null
  const cutter = input.dielineCutter
  return [
    {
      structure,
      url,
      fileName: variant?.fileName || 'dieline.pdf',
      label: boxDielineStructureCopy(structure, locale).label,
      downloadLabel: DIELINE_DOWNLOAD[locale],
      blankPdfUrl: cutter?.pdfUrl,
      blankSvgUrl: cutter?.svgUrl,
      blankDxfUrl: cutter?.dxfUrl,
      blankPdfFileName: cutter?.pdfFileName,
      blankSvgFileName: cutter?.svgFileName,
      blankDxfFileName: cutter?.dxfFileName,
    },
  ]
}

/**
 * Phần hội thoại sau nút dàn hộp đọc kiểu gấp đang lưu:
 * chữ, file in, kích thước tờ và ảnh mockup.
 */
export function applyChosenFoldToThread<T extends FoldThreadLine>(lines: T[], input: ChosenFoldThreadInput): T[] {
  const structure = parseBoxDielineStructure(input.structure ?? '')
    ? resolveBoxDielineStructure(input.structure, input.structureVersion)
    : null
  if (!structure) return lines
  const handoff = lines.findIndex(
    (line) => line.role === 'assistant' && studioMessageOpensBoxFold(line.studio, line.content)
  )
  if (handoff < 0) return lines
  const label = boxDielineStructureCopy(structure, input.locale).label
  const artifacts = currentDielineArtifacts(input.locale, structure, input)
  let layout: ReturnType<typeof getBoxDielineLayoutData> | null = null
  let wireframe: string | null = null
  if (input.dimensionsMm) {
    try {
      const box = {
        lengthMm: input.dimensionsMm.length,
        widthMm: input.dimensionsMm.width,
        heightMm: input.dimensionsMm.height,
      }
      layout = getBoxDielineLayoutData(structure, box, input.production)
      wireframe = generateTuckEndBlankSvg(box, input.production, input.locale, structure)
    } catch {
      layout = null
      wireframe = null
    }
  }
  return lines.map((line, index) => {
    if (index <= handoff) return line
    const content = rewriteFoldMentions(line.content, label)
    const studio = line.studio
    if (!studio) {
      return content === line.content ? line : { ...line, content }
    }
    const isDieline =
      studio.screenKey === 'box_dieline_pdf' ||
      Boolean(studio.dielineArtifacts?.length) ||
      studio.artifactKind === 'pdf'
    const isMockup = studio.screenKey === 'box_mockup_3d'
    let nextStudio = studio
    if (isMockup && input.mockupUrl && studio.imageUrl !== input.mockupUrl) {
      nextStudio = { ...nextStudio, imageUrl: input.mockupUrl }
    }
    if (isDieline && artifacts) {
      nextStudio = {
        ...nextStudio,
        dielineArtifacts: artifacts,
        dielineWarnings: input.dielineWarnings ?? nextStudio.dielineWarnings,
        artifactUrl: artifacts[0]?.url ?? nextStudio.artifactUrl,
        artifactFileName: artifacts[0]?.fileName ?? nextStudio.artifactFileName,
        artifactKind: nextStudio.artifactKind ?? 'pdf',
      }
    }
    if (isDieline && layout && nextStudio.boxProductionSummary) {
      nextStudio = {
        ...nextStudio,
        boxProductionSummary: {
          ...nextStudio.boxProductionSummary,
          netWidthMm: layout.bounds.widthMm,
          netHeightMm: layout.bounds.heightMm,
        },
      }
    }
    if (isDieline && wireframe && nextStudio.boxWireframeSvg) {
      nextStudio = { ...nextStudio, boxWireframeSvg: wireframe }
    }
    if (content === line.content && nextStudio === studio) return line
    return { ...line, content, studio: nextStudio }
  })
}

export function copySourceUrlForSlot(
  packaging: HubPackagingState,
  slot: BoxFaceSlot
): string | null {
  const copyFrom = BOX_FACE_COPY_SOURCE[slot]
  if (!copyFrom) return null
  const created = faceSlotsToCreatedFaces(packaging.faceSlots ?? {})
  return resolveBoxFaceUrl(copyFrom, created)
}
