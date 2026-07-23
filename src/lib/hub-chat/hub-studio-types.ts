import { normalizeBoxDimensionsMm } from '@/lib/packaging/dimensions'
import type { TuckBoxProductionParams } from '@/lib/packaging/tuck-box-production'
import type { BoxDielineStructure } from '@/lib/packaging/dieline-structure'

export type HubStudioStepStatus = 'pending' | 'in_progress' | 'done'

export type HubStudioProcessStep = {
  key: string
  label: string
  status: HubStudioStepStatus
}

export type HubStudioReferenceImage = {
  screenKey: string
  screenLabel: string
  url: string
  approvedAt: number
}

export type HubStudioPendingPreview = {
  screenKey: string
  screenLabel: string
  url: string
  generationPrompt: string
  /** AI-generated image before any crop/edit — kept for re-edit and revert. */
  originalUrl?: string
  /** Physical print size (mm) after crop/edit. */
  editedSizeMm?: { width: number; height: number }
}

export type HubPackagingFaceKey = 'LxW' | 'LxH' | 'WxH'

export type HubPackagingState = {
  version: 2
  /** Missing on saved sessions means the legacy six-face workflow. */
  layout?: 'six_faces' | 'hybrid_strip'
  /** Physical net construction; missing on saved sessions defaults to straight tuck. */
  dielineStructure?: BoxDielineStructure
  dimensionsMm: { length: number; width: number; height: number } | null
  production?: TuckBoxProductionParams
  /** In-progress L → W → H wizard before dimensionsMm is set. */
  dimensionDraft?: {
    lengthMm?: number
    widthMm?: number
  }
  faces: Partial<Record<HubPackagingFaceKey, string>>
  /** 6 mặt: trên/trước/phải/dưới/sau/trái */
  faceSlots?: Partial<
    Record<
      'top' | 'front' | 'right' | 'bottom' | 'back' | 'left',
      { sourceMode: 'generate' | 'copy' | 'empty'; url?: string }
    >
  >
  /** Approved continuous source and derived side textures. */
  bodyStrip?: {
    originalUrl: string
    foldOffsetsMm: [number, number, number]
  }
  faceAspectRatios?: Partial<Record<HubPackagingFaceKey, string>>
  facesConfirmed?: boolean
  dielineUrl?: string
  /** Both net layouts (straight tuck + cross fold) after dieline export. */
  dielineVariants?: Partial<
    Record<BoxDielineStructure, { url: string; fileName: string }>
  >
  mockupUrl?: string
  barcodeUrl?: string
  barcodeFormEntries?: Array<{ label?: string; content: string }>
  barcodeQrPayload?: string
  barcodeArtifacts?: Array<{
    id: string
    type: 'qrcode' | 'ean13' | 'upca' | 'code128'
    content: string
    label: string
    url: string
    fileName: string
  }>
  /** Product label canvas aspect ratio (Gemini) — set at product_label step. */
  productLabelAspectRatio?: string
  /** Product label die-cut shape — set at product_label step. */
  productLabelShape?: string
  /** @deprecated Use productLabelAspectRatio — legacy sessions may still have mm size. */
  productLabelSizeMm?: { widthMm: number; heightMm: number }
  /** Seal sticker canvas aspect ratio (Gemini) — set at seal_sticker step. */
  sealStickerAspectRatio?: string
  /** Seal sticker die-cut shape — set at seal_sticker step. */
  sealStickerShape?: string
  /** @deprecated Use sealStickerAspectRatio — legacy sessions may still have mm size. */
  sealStickerSizeMm?: { widthMm: number; heightMm: number }
  /** Locked visual style text for all 6 faces (discovery or reference-image analysis). */
  packagingStyleBrief?: string
  packagingStyleBriefSource?: 'discovery' | 'reference_image'
  /** Style reference image URL analyzed into packagingStyleBrief (not sent to image model). */
  styleReferenceUrl?: string
}

export type HubStudioPreviewKind =
  | 'ui_mockup'
  | 'banner'
  | 'logo'
  | 'product_photo'
  | 'invitation'
  | 'audio'

export type HubStudioGenerationSelection = {
  referenceScreenKeys: string[]
  productUrls: string[]
  /** Style inspiration image on face_top — analyzed to text, not attached to image model. */
  styleReferenceUrl?: string | null
}

export type HubStudioSession = {
  projectTitle: string
  presetId: string | null
  uploadImages: string[]
  briefNotes: Record<string, string>
  discoveryComplete: boolean
  processSteps: HubStudioProcessStep[]
  currentStepKey: string | null
  referenceImages: HubStudioReferenceImage[]
  pendingPreview: HubStudioPendingPreview | null
  lastGenerationPrompt: string | null
  packaging?: HubPackagingState
  /** Per-generation reference + product picks (max STUDIO_REFERENCE_ATTACH_LIMIT total). */
  generationSelection?: HubStudioGenerationSelection
  /** Banner quảng cáo — tỷ lệ, kênh & chữ overlay (sale_banner). */
  bannerAd?: {
    presetId?: string
    aspectRatio?: string
    platform?: string
    /** 1–4 preset ids chọn cùng lúc. */
    selectedPresetIds?: string[]
    overlayText?: string
  }
  /** Banner còn lại trong lô tạo nhiều tỷ lệ — duyệt lần lượt. */
  bannerBatchQueue?: HubStudioPendingPreview[]
  /** Tổng số banner trong lô hiện tại (duyệt lần lượt). */
  bannerBatchTotal?: number
}

export type HubStudioMessagePayload = {
  imageUrl?: string
  audioUrl?: string
  artifactUrl?: string
  artifactKind?: 'pdf' | 'barcode'
  artifactFileName?: string
  artifactLabel?: string
  artifactNote?: string
  artifactDownloadLabel?: string
  dielineArtifacts?: Array<{
    structure: BoxDielineStructure
    url: string
    fileName: string
    label: string
    downloadLabel: string
  }>
  barcodeArtifacts?: Array<{
    id: string
    type: 'qrcode' | 'ean13' | 'upca' | 'code128'
    content: string
    label: string
    url: string
    fileName: string
    downloadLabel: string
  }>
  screenKey?: string
  screenLabel?: string
  previewKind?: HubStudioPreviewKind
  aspectHint?: 'portrait' | 'square' | 'landscape'
  processSteps?: HubStudioProcessStep[]
  showRegenerate?: boolean
  showApproveReference?: boolean
  imageCharged?: number
  needsUpload?: boolean
  awaitingRequirements?: boolean
  referencePreviews?: { url: string; label: string; screenKey: string }[]
  referenceCount?: number
  referenceMax?: number
  referenceAttachLimit?: number
  showReferenceRemove?: boolean
  showGenerationRefPicker?: boolean
  generationRefOptions?: { url: string; label: string; screenKey: string }[]
  selectedGenerationRefKeys?: string[]
  generationProductPreviews?: { url: string; label: string }[]
  generationStyleReferencePreview?: { url: string; label: string } | null
  showStyleReferencePicker?: boolean
  generationAttachUsed?: number
  /** Step this user message answered (for edit/replay). */
  stepKey?: string
  /** Banner batch: vị trí hiện tại / tổng trong lô đang duyệt. */
  bannerBatchIndex?: number
  bannerBatchTotal?: number
  /** Inline SVG wireframe for packaging box face confirm (no AI). */
  boxWireframeSvg?: string
  /** Production checks displayed with the blank dieline/PDF artifact. */
  boxProductionSummary?: {
    netWidthMm: number
    netHeightMm: number
    bleedMm: number
    glueTabMm: number
    compensationGapMm: number
    paperThicknessMm: number
    resolutionDpi?: number
  }
  /** Show face print style picker on packaging_kit discovery step. */
  showFacePrintStylePicker?: boolean
  /** Show crop/edit for pending packaging face preview. */
  showCropImage?: boolean
  /** Target box face size (mm). */
  faceTargetSizeMm?: { width: number; height: number }
  /** Size (mm) after user crop/edit. */
  faceEditedSizeMm?: { width: number; height: number }
  /** Original AI image URL when pending was edited (for revert). */
  faceOriginalUrl?: string
  /** Relative x positions for continuous body fold guides. */
  faceFoldGuideRatios?: number[]
  /** True when edited url differs from original. */
  showRevertFaceEdit?: boolean
}

export type HubStudioIntent =
  | 'plan_process'
  | 'ask_requirements'
  | 'generate_ui'
  | 'clarify'
  | 'chat'

/** AI-detected retry/recreate intent — set by Studio brain, not regex. */
export type HubStudioRetryIntent = 'none' | 'create' | 'regenerate' | 'recover_flow' | 'continue_next'

export type HubStudioAiRetryHint = {
  retryIntent: HubStudioRetryIntent
  retryStepKey?: string
}

export const UI_MOCKUP_CREDIT = 1.5

export const DEFAULT_MOBILE_SHOP_STEPS: HubStudioProcessStep[] = [
  { key: 'home', label: 'Trang chủ', status: 'pending' },
  { key: 'product_list', label: 'Danh sách sản phẩm', status: 'pending' },
  { key: 'product_detail', label: 'Chi tiết sản phẩm', status: 'pending' },
  { key: 'cart', label: 'Giỏ hàng', status: 'pending' },
  { key: 'checkout', label: 'Thanh toán', status: 'pending' },
  { key: 'profile', label: 'Tài khoản', status: 'pending' },
]

export function emptyStudioSession(): HubStudioSession {
  return {
    projectTitle: '',
    presetId: null,
    uploadImages: [],
    briefNotes: {},
    discoveryComplete: false,
    processSteps: [],
    currentStepKey: null,
    referenceImages: [],
    pendingPreview: null,
    lastGenerationPrompt: null,
    packaging: undefined,
  }
}

export function normalizeStudioSession(raw: HubStudioSession | null | undefined): HubStudioSession | null {
  if (!raw || typeof raw !== 'object') return null
  const packaging = raw.packaging
    ? {
        ...raw.packaging,
        dimensionsMm: raw.packaging.dimensionsMm
          ? normalizeBoxDimensionsMm(raw.packaging.dimensionsMm)
          : raw.packaging.dimensionsMm,
      }
    : raw.packaging
  return {
    ...emptyStudioSession(),
    ...raw,
    packaging,
    processSteps: Array.isArray(raw.processSteps) ? raw.processSteps : [],
    referenceImages: Array.isArray(raw.referenceImages) ? raw.referenceImages : [],
    uploadImages: Array.isArray(raw.uploadImages) ? raw.uploadImages : [],
    briefNotes: raw.briefNotes && typeof raw.briefNotes === 'object' ? raw.briefNotes : {},
    bannerAd:
      raw.bannerAd && typeof raw.bannerAd === 'object'
        ? {
            presetId: String(raw.bannerAd.presetId ?? ''),
            aspectRatio: String(raw.bannerAd.aspectRatio ?? ''),
            platform: raw.bannerAd.platform ? String(raw.bannerAd.platform) : undefined,
            overlayText:
              typeof raw.bannerAd.overlayText === 'string' ? raw.bannerAd.overlayText : undefined,
            selectedPresetIds: Array.isArray(raw.bannerAd.selectedPresetIds)
              ? raw.bannerAd.selectedPresetIds.map(String)
              : undefined,
          }
        : undefined,
    bannerBatchQueue: Array.isArray(raw.bannerBatchQueue) ? raw.bannerBatchQueue : undefined,
    bannerBatchTotal:
      typeof raw.bannerBatchTotal === 'number' && raw.bannerBatchTotal > 0
        ? raw.bannerBatchTotal
        : undefined,
  }
}
