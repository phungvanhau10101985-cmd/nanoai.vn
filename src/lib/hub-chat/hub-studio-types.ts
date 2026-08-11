import { normalizeBoxDimensionsMm } from '@/lib/packaging/dimensions'
import { normalizeBagDimensionsMm } from '@/lib/packaging/bag-dimensions'
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
    /** Logo thương hiệu — ghép vào banner khi tạo ảnh. */
    logoUrl?: string
    /** Banner đầu tiên trong lô — tham chiếu đồng nhất model/style cho các tỷ lệ sau. */
    batchStyleAnchorUrl?: string
  }
  /** Thiết kế túi đựng có gusset (bag_kit). */
  bagKit?: {
    version: 1
    dimensionsMm: { width: number; height: number; gusset: number } | null
    faceSlots?: Partial<
      Record<
        'back' | 'front',
        { sourceMode: 'generate' | 'copy' | 'empty'; url?: string }
      >
    >
    facesConfirmed?: boolean
    faceAspectRatios?: Partial<Record<string, string>>
    mockupUrl?: string
    /** Ảnh mockup 2D photoreal (AI) — hiển thị cùng viewer 3D xoay. */
    mockupPhotoUrl?: string
    dielineUrl?: string
    packagingStyleBrief?: string
    packagingStyleBriefSource?: 'discovery' | 'reference_image'
    styleReferenceUrl?: string
  }
  /** Thiết kế menu quán ăn / quán nước (food_menu). */
  foodMenu?: {
    formatPresetId?: string
    aspectRatio?: string
    /** Tên quán / thương hiệu hiển thị trên menu (ghi đè brief nếu sửa ở bước thiết kế). */
    venueName?: string
    /** Logo thương hiệu — ghép vào menu khi tạo ảnh. */
    logoUrl?: string
    dishes?: Array<{
      id: string
      order: string
      name: string
      unit: string
      priceVnd: string
    }>
    /** Văn bản menu dán tự do (Word, Zalo, Excel…). */
    dishesBulkText?: string
  }
  /** Thiết kế landing page (landing_page). */
  landingPage?: {
    /** Logo thương hiệu — ghép vào hero & các section banner. */
    logoUrl?: string
    /** Link công khai lần publish gần nhất. */
    publishedShareUrl?: string
    publishedShareToken?: string
    /** HTML semantic đã chỉnh sửa — export / publish. */
    htmlSource?: string
  }
  /** @deprecated Dùng bannerBatchPreviews — giữ để tương thích session cũ. */
  bannerBatchQueue?: HubStudioPendingPreview[]
  /** Tất cả banner trong lô vừa tạo — hiển thị cùng lúc trên UI. */
  bannerBatchPreviews?: HubStudioPendingPreview[]
  /** Banner đang được xem / tạo lại trong lô. */
  bannerBatchSelectedIndex?: number
  /** Tổng số banner trong lô hiện tại. */
  bannerBatchTotal?: number
  /** Dựng lại thiết kế từ mẫu sản phẩm (design_recreate). */
  designRecreate?: {
    recreationBrief?: string
    briefSource?: 'sample_images' | 'discovery'
    analyzedAt?: number
    sampleUrls?: string[]
  }
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
  /** Keep every regeneration visible (do not replace/collapse same screenKey). */
  stackImageVersions?: boolean
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
  /** Banner batch: danh sách ảnh hiển thị cùng lúc. */
  bannerBatchItems?: Array<{ url: string; screenLabel: string; index: number }>
  bannerBatchSelectedIndex?: number
  /** @deprecated */
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
            logoUrl: typeof raw.bannerAd.logoUrl === 'string' ? raw.bannerAd.logoUrl : undefined,
            selectedPresetIds: Array.isArray(raw.bannerAd.selectedPresetIds)
              ? raw.bannerAd.selectedPresetIds.map(String)
              : undefined,
          }
        : undefined,
    bagKit:
      raw.bagKit && typeof raw.bagKit === 'object'
        ? {
            ...raw.bagKit,
            version: 1 as const,
            dimensionsMm: raw.bagKit.dimensionsMm
              ? normalizeBagDimensionsMm(raw.bagKit.dimensionsMm)
              : raw.bagKit.dimensionsMm,
          }
        : undefined,
    foodMenu:
      raw.foodMenu && typeof raw.foodMenu === 'object'
        ? {
            formatPresetId:
              typeof raw.foodMenu.formatPresetId === 'string'
                ? raw.foodMenu.formatPresetId
                : undefined,
            aspectRatio:
              typeof raw.foodMenu.aspectRatio === 'string' ? raw.foodMenu.aspectRatio : undefined,
            venueName:
              typeof raw.foodMenu.venueName === 'string' ? raw.foodMenu.venueName : undefined,
            logoUrl: typeof raw.foodMenu.logoUrl === 'string' ? raw.foodMenu.logoUrl : undefined,
            dishes: Array.isArray(raw.foodMenu.dishes)
              ? raw.foodMenu.dishes.map((row, index) => ({
                  id: String(row?.id ?? `dish-${index}`),
                  order: String(row?.order ?? ''),
                  name: String(row?.name ?? ''),
                  unit: String(row?.unit ?? ''),
                  priceVnd: String(row?.priceVnd ?? ''),
                }))
              : undefined,
            dishesBulkText:
              typeof raw.foodMenu.dishesBulkText === 'string'
                ? raw.foodMenu.dishesBulkText
                : undefined,
          }
        : undefined,
    landingPage:
      raw.landingPage && typeof raw.landingPage === 'object'
        ? {
            logoUrl:
              typeof raw.landingPage.logoUrl === 'string' ? raw.landingPage.logoUrl : undefined,
            publishedShareUrl:
              typeof raw.landingPage.publishedShareUrl === 'string'
                ? raw.landingPage.publishedShareUrl
                : undefined,
            publishedShareToken:
              typeof raw.landingPage.publishedShareToken === 'string'
                ? raw.landingPage.publishedShareToken
                : undefined,
            htmlSource:
              typeof raw.landingPage.htmlSource === 'string'
                ? raw.landingPage.htmlSource
                : undefined,
          }
        : undefined,
    bannerBatchQueue: Array.isArray(raw.bannerBatchQueue) ? raw.bannerBatchQueue : undefined,
    bannerBatchPreviews: (() => {
      if (Array.isArray(raw.bannerBatchPreviews) && raw.bannerBatchPreviews.length) {
        return raw.bannerBatchPreviews
      }
      const queue = Array.isArray(raw.bannerBatchQueue) ? raw.bannerBatchQueue : []
      const pending = raw.pendingPreview
      if (pending && queue.length > 0) return [pending, ...queue]
      return undefined
    })(),
    bannerBatchSelectedIndex:
      typeof raw.bannerBatchSelectedIndex === 'number' && raw.bannerBatchSelectedIndex >= 0
        ? raw.bannerBatchSelectedIndex
        : undefined,
    bannerBatchTotal:
      typeof raw.bannerBatchTotal === 'number' && raw.bannerBatchTotal > 0
        ? raw.bannerBatchTotal
        : undefined,
  }
}
