import type {
  HubStudioAiRetryHint,
  HubStudioMessagePayload,
  HubStudioRetryIntent,
  HubStudioSession,
} from '@/lib/hub-chat/hub-studio-types'
import type { WebLocale } from '@/lib/i18n/config'
import {
  getFlowSteps,
  getPrimaryLogoStepKey,
  getStepFormFactor,
  getStepGenerator,
  hasPrimaryLogoReference,
  isLogoDesignStep,
  isStepAfterPrimaryLogo,
  presetStepLabel,
} from '@/lib/hub-chat/hub-studio-presets'
import {
  getPackagingFaceSizeForStep,
  isPackagingFaceStepCommitted,
  isPackagingFaceStepKey,
  resolvedPackagingFacesReady,
} from '@/lib/packaging/hub-face-steps'

const CREATE_VERBS =
  /tạo|tao|làm|lam|create|make|generate|design|thực hiện|thuc hien|vẽ|ve|draw|render|生成|作成|만들|创建|chưa thấy|chua thay|chưa có|chua co|lỗi|loi|sai|hỏng|hong|missing|where|đâu|dau/
const REGENERATE_VERBS =
  /tạo lại|tao lai|làm lại|lam lai|regenerate|again|khác|khac|重新|再生成|다시|another|redo|remake/

/** Fallback keywords when AI retry fields are absent. */
const STEP_KEY_ALIASES: Record<string, string[]> = {
  logo: ['logo', 'nhan dien', 'nhận diện', 'brand mark'],
  logo_primary: ['logo chinh', 'logo chính', 'primary logo'],
  logo_icon: ['logo icon', 'icon', 'favicon', 'bieu tuong', 'biểu tượng'],
  home_mobile: ['trang chu', 'trang chủ', 'homepage', 'home page', 'home mobile'],
  home_desktop: ['trang chu desktop', 'trang chủ desktop', 'homepage desktop', 'home desktop'],
  product_list_mobile: ['danh sach sp', 'danh sách sp', 'product list', 'san pham mobile'],
  product_list_desktop: ['danh sach sp desktop', 'product list desktop'],
  product_detail_mobile: ['chi tiet sp', 'chi tiết sp', 'product detail'],
  product_detail_desktop: ['chi tiet sp desktop', 'product detail desktop'],
  cart_mobile: ['gio hang', 'giỏ hàng', 'cart', 'shopping cart'],
  checkout_mobile: ['thanh toan', 'thanh toán', 'checkout', 'payment'],
  profile_mobile: ['tai khoan', 'tài khoản', 'profile', 'account'],
  google_display: ['google display', 'banner google', 'google ngang'],
  google_square: ['google vuong', 'google vuông', 'google square'],
  facebook_feed: ['facebook feed', 'fb feed'],
  facebook_story: ['facebook story', 'fb story'],
  instagram_reels: ['instagram reels', 'reels', 'ig reels'],
  banner_web: ['banner web', 'banner website'],
  banner_social: ['banner social', 'banner mang xa hoi'],
  product_label: ['nhan san pham', 'nhãn sản phẩm', 'product label'],
  sticker: ['sticker', 'tem', 'nhãn dán'],
  biz_card: ['name card', 'business card', 'danh thiep', 'danh thiếp'],
  hero_desktop: ['hero desktop', 'hero banner'],
  hero_mobile: ['hero mobile'],
  features: ['features', 'tinh nang', 'tính năng'],
  pricing: ['pricing', 'bang gia', 'bảng giá'],
  testimonials: ['testimonials', 'danh gia', 'đánh giá', 'review'],
  faq: ['faq', 'cau hoi', 'câu hỏi thường gặp'],
  cta_footer: ['footer', 'cta footer'],
  product_white: ['anh nen trang', 'ảnh nền trắng', 'white background'],
  product_lifestyle: ['lifestyle', 'anh doi song', 'ảnh đời sống'],
  product_detail: ['anh chi tiet san pham', 'ảnh chi tiết sản phẩm'],
  promo_banner_sq: ['banner vuong', 'banner vuông', 'promo square'],
  promo_banner_story: ['banner story', 'story promo'],
  cover: ['cover', 'bia thiep', 'bìa thiệp'],
  inside_spread: ['inside spread', 'noi dung thiep', 'nội dung thiệp'],
  rsvp_card: ['rsvp', 'the moi', 'thẻ mời'],
  envelope: ['envelope', 'phong bi', 'phong bì'],
  story_share: ['story share', 'story thiep'],
  track_main: ['track main', 'nhac chinh', 'nhạc chính', 'main track'],
  track_short: ['track short', 'nhac ngan', 'short track'],
  track_alt: ['track alt', 'nhac phu', 'alternate track'],
  hero_look: ['hero look', 'lookbook hero'],
  grid_look: ['grid look', 'lookbook grid'],
  look_detail_1: ['look 1', 'look detail 1'],
  look_detail_2: ['look 2', 'look detail 2'],
  catalog_cover: ['catalog cover', 'bia catalog', 'bìa catalog'],
  box_flat: ['hop phang', 'hộp phẳng', 'flat box', 'dieline'],
  face_top: ['mat tren', 'mặt trên', 'top face', 'nap', 'nắp'],
  face_front: ['mat truoc', 'mặt trước', 'front face'],
  face_right: ['mat phai', 'mặt phải', 'right side', 'mat hong phai'],
  face_bottom: ['mat duoi', 'mặt dưới', 'bottom face', 'day', 'đáy'],
  face_back: ['mat sau', 'mặt sau', 'back face'],
  face_left: ['mat trai', 'mặt trái', 'left side'],
  face_lxw: ['mat lxw', 'mặt lxw', 'nap day', 'nắp đáy', 'top bottom face'],
  face_lxh: ['mat lxh', 'mặt lxh', 'mat truoc sau', 'mặt trước sau', 'front back face'],
  face_wxh: ['mat wxh', 'mặt wxh', 'mat hong', 'mặt hông', 'side face'],
  box_dieline_pdf: ['dieline pdf', 'ban ve be', 'bản vẽ bế', 'pdf ky thuat', 'pdf kỹ thuật', 'file in', 'tao file in', 'tạo file in'],
  box_mockup_3d: ['mockup 3d', 'mocup 3d', 'hop 3d', 'hộp 3d', '3d box'],
  seal_sticker: ['tem niem phong', 'tem niêm phong', 'seal sticker'],
  barcode_label: ['ma vach', 'mã vạch', 'barcode'],
  living_room: ['phong khach', 'phòng khách', 'living room'],
  kitchen: ['phong bep', 'phòng bếp', 'kitchen'],
  bedroom: ['phong ngu', 'phòng ngủ', 'bedroom'],
  facade: ['mat tien', 'mặt tiền', 'facade', 'exterior'],
  logo_avatar: ['avatar', 'logo avatar'],
  post_square: ['post vuong', 'post vuông', 'square post'],
  story_916: ['story 9:16', 'story'],
  facebook_cover: ['cover facebook', 'fb cover'],
  pinterest_pin: ['pinterest', 'pin pinterest'],
  main_character: ['nhan vat', 'nhân vật', 'main character'],
  page_1: ['trang 1', 'page 1'],
  page_2: ['trang 2', 'page 2'],
  page_3: ['trang 3', 'page 3'],
  page_4: ['trang 4', 'page 4'],
  slide_hook: ['slide 1', 'hook slide'],
  slide_2: ['slide 2'],
  slide_3: ['slide 3'],
  slide_4: ['slide 4'],
  slide_summary: ['slide tong ket', 'slide tổng kết', 'summary slide'],
  outfit_try_1: ['try on 1', 'outfit 1'],
  outfit_try_2: ['try on 2', 'outfit 2'],
  sale_banner: ['banner sale', 'sale banner'],
  id_white: ['anh the trang', 'ảnh thẻ trắng', 'white id'],
  id_blue: ['anh the xanh', 'ảnh thẻ xanh', 'blue id'],
  linkedin_profile: ['linkedin', 'profile linkedin'],
  personal_banner: ['banner ca nhan', 'banner cá nhân', 'personal banner'],
}

export function normalizeRetryIntent(raw: unknown): HubStudioRetryIntent {
  const v = String(raw ?? 'none')
    .trim()
    .toLowerCase()
  if (v === 'create' || v === 'regenerate' || v === 'recover_flow' || v === 'continue_next') return v
  return 'none'
}

export function isValidDesignStepKey(presetId: string, stepKey: string | null | undefined): boolean {
  if (!stepKey) return false
  return getFlowSteps(presetId).some((s) => s.key === stepKey && s.phase === 'design')
}

export function buildDesignStepCatalog(
  locale: WebLocale,
  presetId: string,
  session: HubStudioSession
): { key: string; label: string; status: string }[] {
  return getFlowSteps(presetId)
    .filter((s) => s.phase === 'design')
    .map((s) => ({
      key: s.key,
      label: presetStepLabel(locale, presetId, s.labelKey),
      status: session.processSteps.find((p) => p.key === s.key)?.status ?? 'pending',
    }))
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function wantsStepCreation(message: string): boolean {
  const m = message.toLowerCase()
  return CREATE_VERBS.test(m) || REGENERATE_VERBS.test(m)
}

export function wantsStepRegenerate(message: string, aiHint?: HubStudioAiRetryHint): boolean {
  if (aiHint?.retryIntent === 'regenerate') return true
  return REGENERATE_VERBS.test(message.toLowerCase())
}

/** User wants to proceed to the next step — detected by AI only (retryIntent continue_next). */
export function wantsContinueNextStep(aiHint?: HubStudioAiRetryHint): boolean {
  return aiHint?.retryIntent === 'continue_next'
}

const AUTO_GENERATE_MIN_MESSAGE_LEN = 12

const ACK_ONLY_MESSAGE =
  /^(ok|oke|okay|yes|yep|được|duoc|duoc roi|tiếp|tiep|tiep theo|next|xong|done|ừ|uh|hmm|hm)\.?$/i

function generatorsAutoGenerateOnInput(gen: ReturnType<typeof getStepGenerator>): boolean {
  if (!gen) return false
  return gen !== 'dieline_pdf'
}

export function isDeterministicPackagingGenerator(
  gen: ReturnType<typeof getStepGenerator>
): boolean {
  return gen === 'packaging_mockup' || gen === 'dieline_pdf' || gen === 'barcode'
}

/** Mockup / dieline / barcode — run from user "tạo …" without waiting for AI shouldGenerate. */
export function shouldForceDeterministicStep(
  session: HubStudioSession,
  presetId: string,
  stepKey: string,
  message: string,
  locale: WebLocale,
  aiHint?: HubStudioAiRetryHint
): boolean {
  const gen = getStepGenerator(presetId, stepKey)
  if (!isDeterministicPackagingGenerator(gen)) return false
  if (session.currentStepKey !== stepKey) return false
  if (!wantsStepCreation(message) || wantsContinueNextStep(aiHint)) return false
  const matched = matchDesignStepRetryRequest(message, locale, presetId, session, aiHint)
  if (matched && matched !== stepKey) return false
  return true
}

/** User asks to compose mockup PDF / dieline — keyword only, no AI. */
export function resolvePackagingArtifactStepFromMessage(
  session: HubStudioSession,
  locale: WebLocale,
  message: string
): 'box_mockup_3d' | 'box_dieline_pdf' | null {
  if (session.presetId !== 'packaging_kit' || !session.discoveryComplete) return null

  const currentGen = session.currentStepKey
    ? getStepGenerator(session.presetId, session.currentStepKey)
    : null
  const onMockupStep = session.currentStepKey === 'box_mockup_3d'
  const onDielineStep = session.currentStepKey === 'box_dieline_pdf'

  const n = normalize(message)
  const mockupHint =
    /mockup|mocup/.test(n) && (/3d|hop|hộp|box/.test(n) || onMockupStep)
  const dielineHint = /dieline|file in|ban ve|bản vẽ|pdf ky thuat|pdf kỹ thuật/.test(n)

  if (wantsStepCreation(message) || mockupHint || dielineHint) {
    const matched = matchDesignStepRetryRequest(message, locale, session.presetId, session)
    if (matched === 'box_mockup_3d' || matched === 'box_dieline_pdf') return matched
    if (mockupHint || (onMockupStep && wantsStepCreation(message))) return 'box_mockup_3d'
    if (dielineHint || (onDielineStep && wantsStepCreation(message))) return 'box_dieline_pdf'
  }

  if (
    onMockupStep &&
    currentGen === 'packaging_mockup' &&
    (wantsStepCreation(message) || mockupHint || /^tạo|^tao|^ok|^làm|^lam/.test(n))
  ) {
    return 'box_mockup_3d'
  }

  return null
}

function isSubstantiveDesignInput(message: string): boolean {
  const trimmed = message.trim()
  if (trimmed.length < AUTO_GENERATE_MIN_MESSAGE_LEN) return false
  if (ACK_ONLY_MESSAGE.test(trimmed)) return false
  return true
}

export function sanitizeAiRetryHint(
  session: HubStudioSession,
  aiHint: HubStudioAiRetryHint
): HubStudioAiRetryHint {
  const presetId = session.presetId
  if (!presetId) return aiHint

  if (aiHint.retryIntent === 'continue_next') {
    return { retryIntent: 'continue_next' }
  }

  if (
    aiHint.retryStepKey &&
    isDesignStepApprovedComplete(session, presetId, aiHint.retryStepKey) &&
    aiHint.retryIntent !== 'regenerate'
  ) {
    return { retryIntent: 'none' }
  }

  if (
    aiHint.retryStepKey &&
    !isValidDesignStepKey(presetId, aiHint.retryStepKey)
  ) {
    return { ...aiHint, retryStepKey: undefined }
  }

  return aiHint
}

export function isDesignStepApprovedComplete(
  session: HubStudioSession,
  presetId: string,
  stepKey: string
): boolean {
  const proc = session.processSteps.find((s) => s.key === stepKey)
  const gen = getStepGenerator(presetId, stepKey)
  if (gen === 'lyria_music') return proc?.status === 'done'
  const hasRef = session.referenceImages.some((r) => r.screenKey === stepKey)
  if (presetId === 'packaging_kit' && isPackagingFaceStepKey(stepKey)) {
    return proc?.status === 'done' && (hasRef || isPackagingFaceStepCommitted(session.packaging, stepKey))
  }
  return proc?.status === 'done' && hasRef
}

function canRetryCompletedStep(
  session: HubStudioSession,
  presetId: string,
  stepKey: string,
  _message: string,
  aiHint?: HubStudioAiRetryHint
): boolean {
  if (!isDesignStepApprovedComplete(session, presetId, stepKey)) return true
  return aiHint?.retryIntent === 'regenerate'
}

export function isExplicitRetryIntent(_message: string, aiHint?: HubStudioAiRetryHint): boolean {
  if (aiHint?.retryIntent === 'continue_next') return false
  if (aiHint?.retryIntent && aiHint.retryIntent !== 'none') return true
  return false
}

export type DesignStepIncompleteReason = 'none' | 'missing_output' | 'wrongly_done'

export function getDesignStepIncompleteReason(
  session: HubStudioSession,
  presetId: string,
  stepKey: string
): DesignStepIncompleteReason {
  const flow = getFlowSteps(presetId)
  const stepDef = flow.find((s) => s.key === stepKey)
  if (!stepDef || stepDef.phase !== 'design') return 'none'

  const proc = session.processSteps.find((s) => s.key === stepKey)
  const hasRef = session.referenceImages.some((r) => r.screenKey === stepKey)
  const hasPending = session.pendingPreview?.screenKey === stepKey
  const gen = stepDef.generator

  if (hasRef) return 'none'
  if (hasPending) return 'none'

  if (
    session.presetId === 'packaging_kit' &&
    isPackagingFaceStepKey(stepKey) &&
    isPackagingFaceStepCommitted(session.packaging, stepKey)
  ) {
    return 'none'
  }

  if (gen === 'lyria_music') {
    return proc?.status === 'done' ? 'none' : 'missing_output'
  }

  if (proc?.status === 'done') return 'wrongly_done'
  if (proc?.status === 'in_progress') return 'missing_output'
  return 'none'
}

/** Keyword fallback — used only when AI retry fields are missing. */
export function matchDesignStepRetryRequest(
  message: string,
  locale: WebLocale,
  presetId: string,
  session?: HubStudioSession,
  aiHint?: HubStudioAiRetryHint
): string | null {
  if (wantsContinueNextStep(aiHint) || !wantsStepCreation(message)) return null

  const m = normalize(message)
  const designSteps = getFlowSteps(presetId).filter((s) => s.phase === 'design')

  let best: { key: string; score: number } | null = null

  for (const step of designSteps) {
    if (
      session &&
      isDesignStepApprovedComplete(session, presetId, step.key) &&
      !wantsStepRegenerate(message, aiHint)
    ) {
      continue
    }
    const label = normalize(presetStepLabel(locale, presetId, step.labelKey))
    const aliases = new Set([
      label,
      normalize(step.key.replace(/_/g, ' ')),
      ...(STEP_KEY_ALIASES[step.key] ?? []).map(normalize),
    ])

    for (const alias of aliases) {
      if (alias.length < 3 || !m.includes(alias)) continue
      let score = alias.length
      if (step.key.includes('mobile') && /mobile|dien thoai|phone|手机/.test(m)) score += 12
      if (step.key.includes('desktop') && /desktop|may tinh|pc|电脑/.test(m)) score += 12
      if (wantsStepRegenerate(message)) score += 2
      if (!best || score > best.score) best = { key: step.key, score }
    }
  }

  return best && best.score >= 4 ? best.key : null
}

export function findBlockingIncompleteStep(
  session: HubStudioSession,
  presetId: string
): string | null {
  const flow = getFlowSteps(presetId)
  const currentIdx = session.currentStepKey ? flow.findIndex((s) => s.key === session.currentStepKey) : -1

  for (const step of flow) {
    if (step.phase !== 'design') continue
    const idx = flow.findIndex((s) => s.key === step.key)
    const reason = getDesignStepIncompleteReason(session, presetId, step.key)

    if (reason === 'wrongly_done') return step.key

    if (reason === 'missing_output') {
      const logoKey = getPrimaryLogoStepKey(presetId)
      if (logoKey === step.key && !hasPrimaryLogoReference(session.referenceImages, presetId)) {
        return step.key
      }
      if (idx >= 0 && currentIdx >= 0 && idx < currentIdx) return step.key
    }
  }
  return null
}

function resolveAiRetryStepKey(
  session: HubStudioSession,
  presetId: string,
  aiHint?: HubStudioAiRetryHint,
  message?: string
): string | null {
  if (!aiHint || aiHint.retryIntent === 'none') return null
  if (
    aiHint.retryStepKey &&
    isValidDesignStepKey(presetId, aiHint.retryStepKey) &&
    canRetryCompletedStep(session, presetId, aiHint.retryStepKey, message ?? '', aiHint)
  ) {
    return aiHint.retryStepKey
  }

  if (
    session.currentStepKey &&
    isValidDesignStepKey(presetId, session.currentStepKey) &&
    getDesignStepIncompleteReason(session, presetId, session.currentStepKey) !== 'none'
  ) {
    return session.currentStepKey
  }

  return findBlockingIncompleteStep(session, presetId)
}

/** User asks to create a LATER design step — jump forward when all prior steps are complete. */
export function resolveForwardDesignStepTarget(
  session: HubStudioSession,
  presetId: string,
  locale: WebLocale,
  message: string,
  aiHint?: HubStudioAiRetryHint
): string | null {
  if (!wantsStepCreation(message)) return null

  const matched = matchDesignStepRetryRequest(message, locale, presetId, session, aiHint)
  if (!matched) return null

  const flow = getFlowSteps(presetId)
  const targetIdx = flow.findIndex((s) => s.key === matched)
  const currentIdx = session.currentStepKey ? flow.findIndex((s) => s.key === session.currentStepKey) : -1
  if (targetIdx < 0) return null
  if (currentIdx >= 0 && targetIdx <= currentIdx) return null

  for (const step of flow) {
    const idx = flow.findIndex((s) => s.key === step.key)
    if (idx >= targetIdx) break
    if (step.phase !== 'design') continue
    if (getDesignStepIncompleteReason(session, presetId, step.key) !== 'none') return null
  }

  if (matched === 'box_dieline_pdf' && !resolvedPackagingFacesReady(session.packaging)) {
    return null
  }

  return matched
}

export function resolveRetryTargetStep(
  session: HubStudioSession,
  presetId: string,
  locale: WebLocale,
  message: string,
  aiHint?: HubStudioAiRetryHint
): string | null {
  if (wantsContinueNextStep(aiHint)) {
    return findBlockingIncompleteStep(session, presetId)
  }

  const aiKey = resolveAiRetryStepKey(session, presetId, aiHint, message)
  if (aiHint?.retryIntent && aiHint.retryIntent !== 'none' && aiHint.retryIntent !== 'continue_next') {
    return aiKey
  }

  const blocking = findBlockingIncompleteStep(session, presetId)
  if (blocking) return blocking

  return resolveForwardDesignStepTarget(session, presetId, locale, message, aiHint)
}

export function needsStepRetryRepair(
  session: HubStudioSession,
  presetId: string,
  targetStepKey: string,
  message?: string,
  locale?: WebLocale,
  aiHint?: HubStudioAiRetryHint
): boolean {
  if (aiHint?.retryIntent === 'continue_next') return false
  if (aiHint?.retryIntent === 'regenerate' && aiHint.retryStepKey === targetStepKey) return true
  if (aiHint?.retryIntent === 'create' && aiHint.retryStepKey === targetStepKey) return true
  if (aiHint?.retryIntent === 'recover_flow') {
    return (
      getDesignStepIncompleteReason(session, presetId, targetStepKey) !== 'none' ||
      session.currentStepKey !== targetStepKey
    )
  }

  if (session.currentStepKey === targetStepKey) {
    const reason = getDesignStepIncompleteReason(session, presetId, targetStepKey)
    return reason !== 'none'
  }
  const flow = getFlowSteps(presetId)
  const targetIdx = flow.findIndex((s) => s.key === targetStepKey)
  const currentIdx = session.currentStepKey ? flow.findIndex((s) => s.key === session.currentStepKey) : -1
  if (targetIdx >= 0 && currentIdx >= 0 && targetIdx !== currentIdx) {
    if (
      targetIdx < currentIdx &&
      isDesignStepApprovedComplete(session, presetId, targetStepKey) &&
      !canRetryCompletedStep(session, presetId, targetStepKey, message ?? '', aiHint)
    ) {
      return false
    }
    return true
  }
  return getDesignStepIncompleteReason(session, presetId, targetStepKey) !== 'none'
}

export function applyStepRetryRepair(
  session: HubStudioSession,
  presetId: string,
  targetStepKey: string,
  message?: string,
  locale?: WebLocale,
  aiHint?: HubStudioAiRetryHint
): HubStudioSession {
  const flow = getFlowSteps(presetId)
  const targetIdx = flow.findIndex((s) => s.key === targetStepKey)
  if (targetIdx < 0) return session

  const logoKey = getPrimaryLogoStepKey(presetId)
  const logoIdx = logoKey ? flow.findIndex((s) => s.key === logoKey) : -1
  if (logoKey && logoIdx >= 0 && targetIdx > logoIdx && !hasPrimaryLogoReference(session.referenceImages, presetId)) {
    return applyStepRetryRepair(session, presetId, logoKey, message, locale, aiHint)
  }

  const reason = getDesignStepIncompleteReason(session, presetId, targetStepKey)
  const aiTargetsStep = aiHint?.retryStepKey === targetStepKey && aiHint?.retryIntent !== 'none'
  const softRegenerate =
    reason === 'none' && aiHint?.retryIntent === 'regenerate' && (aiHint.retryStepKey === targetStepKey || !aiHint.retryStepKey)

  if (softRegenerate) {
    return {
      ...session,
      currentStepKey: targetStepKey,
      briefNotes: message ? { ...session.briefNotes, [targetStepKey]: message } : session.briefNotes,
      pendingPreview: session.pendingPreview?.screenKey === targetStepKey ? session.pendingPreview : null,
    }
  }

  const processSteps = session.processSteps.map((s) => {
    const idx = flow.findIndex((f) => f.key === s.key)
    if (s.key === targetStepKey) return { ...s, status: 'in_progress' as const }
    if (idx > targetIdx) return { ...s, status: 'pending' as const }
    return s
  })

  const shouldUpdateBrief =
    Boolean(message) &&
    (aiTargetsStep || aiHint?.retryIntent === 'create' || aiHint?.retryIntent === 'regenerate')
  const briefNotes = shouldUpdateBrief
    ? { ...session.briefNotes, [targetStepKey]: message! }
    : session.briefNotes

  return {
    ...session,
    currentStepKey: targetStepKey,
    processSteps,
    briefNotes,
    pendingPreview: session.pendingPreview?.screenKey === targetStepKey ? session.pendingPreview : null,
  }
}

/** User wants a new output for the step that already has a pending preview (regenerate / recreate). */
function wantsRecreateCurrentStepOutput(
  session: HubStudioSession,
  stepKey: string,
  message: string,
  aiHint?: HubStudioAiRetryHint
): boolean {
  if (session.pendingPreview?.screenKey !== stepKey) return false
  if (aiHint?.retryIntent === 'regenerate') return true
  if (wantsStepRegenerate(message, aiHint)) return true
  if (aiHint?.retryIntent === 'create' && wantsStepCreation(message)) return true
  return false
}

export function shouldShowPendingRetry(
  session: HubStudioSession,
  stepKey: string,
  message: string,
  aiHint?: HubStudioAiRetryHint
): boolean {
  if (session.pendingPreview?.screenKey !== stepKey) return false
  if (wantsRecreateCurrentStepOutput(session, stepKey, message, aiHint)) return false
  if (aiHint?.retryIntent === 'regenerate') return false
  return (
    aiHint?.retryIntent === 'create' ||
    aiHint?.retryIntent === 'recover_flow' ||
    aiHint?.retryIntent === 'continue_next'
  )
}

export function shouldForceGenerateForStep(
  session: HubStudioSession,
  presetId: string,
  stepKey: string,
  _message: string,
  onDiscovery: boolean,
  explicitRetryStep: string | null,
  aiHint?: HubStudioAiRetryHint,
  options?: { skipSameTurnDesignEntry?: boolean; locale?: WebLocale }
): boolean {
  if (onDiscovery || !session.discoveryComplete) return false
  if (options?.skipSameTurnDesignEntry) return false
  const gen = getStepGenerator(presetId, stepKey)
  if (!gen) return false

  if (wantsContinueNextStep(aiHint)) return false

  const locale = options?.locale ?? 'vi'
  if (shouldForceDeterministicStep(session, presetId, stepKey, _message, locale, aiHint)) {
    return true
  }

  if (
    session.pendingPreview?.screenKey === stepKey &&
    aiHint?.retryIntent !== 'regenerate' &&
    !wantsRecreateCurrentStepOutput(session, stepKey, _message, aiHint)
  ) {
    return false
  }

  if (shouldShowPendingRetry(session, stepKey, _message, aiHint)) return false

  if (
    isDesignStepApprovedComplete(session, presetId, stepKey) &&
    aiHint?.retryIntent !== 'regenerate'
  ) {
    return false
  }

  if (isStepAfterPrimaryLogo(presetId, stepKey) && !isLogoDesignStep(presetId, stepKey)) {
    if (!hasPrimaryLogoReference(session.referenceImages, presetId)) return false
  }

  if (aiHint?.retryIntent === 'create' && (!aiHint.retryStepKey || aiHint.retryStepKey === stepKey)) {
    return true
  }
  if (aiHint?.retryIntent === 'regenerate' && aiHint.retryStepKey === stepKey) return true
  if (
    explicitRetryStep === stepKey &&
    (aiHint?.retryIntent === 'create' ||
      aiHint?.retryIntent === 'regenerate' ||
      aiHint?.retryIntent === 'recover_flow')
  ) {
    return true
  }

  if (
    session.currentStepKey === stepKey &&
    generatorsAutoGenerateOnInput(gen) &&
    isSubstantiveDesignInput(_message) &&
    getDesignStepIncompleteReason(session, presetId, stepKey) === 'missing_output'
  ) {
    return true
  }

  return false
}

function previewKindFromGenerator(gen: ReturnType<typeof getStepGenerator>): HubStudioMessagePayload['previewKind'] {
  if (gen === 'lyria_music') return 'audio'
  if (gen === 'banner') return 'banner'
  if (gen === 'logo') return 'logo'
  if (gen === 'product_photo') return 'product_photo'
  if (gen === 'invitation') return 'invitation'
  if (gen === 'packaging' || gen === 'packaging_face' || gen === 'packaging_mockup' || gen === 'interior' || gen === 'story_panel' || gen === 'infographic' || gen === 'portrait') {
    return 'banner'
  }
  if (gen === 'ui_desktop') return 'ui_mockup'
  return 'ui_mockup'
}

function generatorSupportsReference(gen: ReturnType<typeof getStepGenerator>): boolean {
  if (!gen) return false
  return (
    gen === 'ui_mockup' ||
    gen === 'ui_desktop' ||
    gen === 'banner' ||
    gen === 'logo' ||
    gen === 'packaging' ||
    gen === 'packaging_face' ||
    gen === 'packaging_mockup' ||
    gen === 'interior' ||
    gen === 'story_panel' ||
    gen === 'infographic' ||
    gen === 'portrait' ||
    gen === 'product_photo'
  )
}

function aspectHintFromStep(presetId: string, stepKey: string): 'portrait' | 'square' | 'landscape' {
  const form = getStepFormFactor(presetId, stepKey)
  if (form === 'square') return 'square'
  if (form === 'desktop') return 'landscape'
  const gen = getStepGenerator(presetId, stepKey)
  if (gen === 'logo') return 'square'
  if (gen === 'banner' || gen === 'ui_desktop' || gen === 'interior' || gen === 'infographic' || gen === 'story_panel') {
    return 'landscape'
  }
  if (gen === 'packaging' || gen === 'packaging_face' || gen === 'packaging_mockup' || gen === 'portrait') return 'portrait'
  return 'portrait'
}

export function buildPendingStepStudio(
  session: HubStudioSession,
  stepKey: string,
  presetId: string
): HubStudioMessagePayload {
  const pending = session.pendingPreview!
  const gen = getStepGenerator(presetId, stepKey)
  const useReference = generatorSupportsReference(gen)
  const faceTargetRaw = getPackagingFaceSizeForStep(session.packaging?.dimensionsMm, stepKey)
  const faceTargetSizeMm =
    faceTargetRaw != null
      ? { width: faceTargetRaw.widthMm, height: faceTargetRaw.heightMm }
      : undefined

  return {
    ...(gen === 'lyria_music' ? { audioUrl: pending.url } : { imageUrl: pending.url }),
    screenKey: stepKey,
    screenLabel: pending.screenLabel,
    previewKind: previewKindFromGenerator(gen),
    aspectHint: aspectHintFromStep(presetId, stepKey),
    processSteps: session.processSteps,
    showRegenerate: true,
    showApproveReference: useReference,
    showCropImage: gen === 'packaging_face' && Boolean(faceTargetSizeMm),
    faceTargetSizeMm: faceTargetSizeMm ?? undefined,
    faceEditedSizeMm: pending.editedSizeMm ?? undefined,
    faceOriginalUrl: pending.originalUrl ?? undefined,
    showRevertFaceEdit: Boolean(
      pending.originalUrl && pending.originalUrl !== pending.url
    ),
  }
}
