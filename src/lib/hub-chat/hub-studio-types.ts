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
}

export type HubStudioPreviewKind =
  | 'ui_mockup'
  | 'banner'
  | 'logo'
  | 'product_photo'
  | 'invitation'
  | 'audio'

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
}

export type HubStudioMessagePayload = {
  imageUrl?: string
  audioUrl?: string
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
  }
}
