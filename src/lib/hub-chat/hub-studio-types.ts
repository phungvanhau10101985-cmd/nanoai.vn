import { normalizeBoxDimensionsMm } from '@/lib/packaging/dimensions'

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
  dimensionsMm: { length: number; width: number; height: number } | null
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
  faceAspectRatios?: Partial<Record<HubPackagingFaceKey, string>>
  facesConfirmed?: boolean
  dielineUrl?: string
  mockupUrl?: string
  barcodeUrl?: string
  /** Product label sticker size (mm) — set at product_label step. */
  productLabelSizeMm?: { widthMm: number; heightMm: number }
  /** Seal sticker size (mm) — set at seal_sticker step. */
  sealStickerSizeMm?: { widthMm: number; heightMm: number }
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
  generationAttachUsed?: number
  /** Step this user message answered (for edit/replay). */
  stepKey?: string
  /** Inline SVG wireframe for packaging box face confirm (no AI). */
  boxWireframeSvg?: string
  /** Show crop/edit for pending packaging face preview. */
  showCropImage?: boolean
  /** Target box face size (mm). */
  faceTargetSizeMm?: { width: number; height: number }
  /** Size (mm) after user crop/edit. */
  faceEditedSizeMm?: { width: number; height: number }
  /** Original AI image URL when pending was edited (for revert). */
  faceOriginalUrl?: string
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
  }
}
