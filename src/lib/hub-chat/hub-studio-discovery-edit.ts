import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import type { WebLocale } from '@/lib/i18n/config'
import {
  getFlowSteps,
  isDiscoveryStep,
  isLogoDesignStep,
  presetStepLabel,
} from '@/lib/hub-chat/hub-studio-presets'

export type DiscoveryBriefEditMatch = {
  stepKey: string
  reopenStep: boolean
}

const EDIT_BRIEF_VERBS =
  /sửa lại|sua lai|đổi lại|doi lai|chọn lại|chon lai|thay đổi|thay doi|sửa|sua|đổi|doi|edit|change|redo|correct|修改|重新选择|重新選|変更|再選択|수정|다시/i

const DISCOVERY_STEP_ALIASES: Record<string, string[]> = {
  brand_name: ['ten thuong hieu', 'tên thương hiệu', 'brand name', 'thuong hieu', 'thương hiệu'],
  product_type: ['loai san pham', 'loại sản phẩm', 'product type', 'san pham', 'sản phẩm'],
  box_size: ['kich thuoc hop', 'kích thước hộp', 'box size', 'size hop', 'size hộp', 'kich thuoc', 'kích thước'],
  box_size_length: ['chieu dai', 'chiều dài', 'length', 'box length', 'dai hop'],
  box_size_width: ['chieu rong', 'chiều rộng', 'width', 'box width', 'rong hop'],
  box_size_height: ['chieu cao', 'chiều cao', 'height', 'box height', 'cao hop'],
  box_face_confirm: ['xac nhan mat', 'xác nhận mặt', 'face confirm', 'ty le mat', 'tỷ lệ mặt'],
  style_mood: ['phong cach', 'phong cách', 'style', 'mood', 'kieu thiet ke', 'kiểu thiết kế'],
  color_palette: [
    'mau sac',
    'màu sắc',
    'bang mau',
    'bảng màu',
    'color',
    'palette',
    'tong mau',
    'tông màu',
    'mau chu dao',
    'màu chủ đạo',
    'mau nen',
    'màu nền',
  ],
  face_print_style: [
    'kieu mat in',
    'kiểu mặt in',
    'face print',
    'print style',
    'typography',
    'minh hoa',
    'minh họa',
    'anh san pham',
    'ảnh sản phẩm',
  ],
  color_tone: ['tong mau', 'tông màu', 'color tone'],
  brand_style: ['brand style', 'phong cach thuong hieu', 'phong cách thương hiệu'],
  banner_style: [
    'phong cach banner',
    'phong cách banner',
    'banner style',
    'kieu banner',
    'kiểu banner',
    'layout banner',
  ],
  banner_model: [
    'nguoi mau',
    'người mẫu',
    'model',
    'model banner',
    'nam nu',
    'nam nữ',
    'giong nguoi',
    'giống người',
  ],
  target_audience: ['doi tuong', 'đối tượng', 'audience', 'target audience'],
  industry_product: ['nganh hang', 'ngành hàng', 'industry'],
  domain_name: ['ten mien', 'tên miền', 'domain', 'website', 'trang web', 'thuong hieu', 'thương hiệu', 'brand name'],
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wantsEditBrief(message: string): boolean {
  return EDIT_BRIEF_VERBS.test(message)
}

function looksLikeColorBrief(message: string): boolean {
  if (!/màu|mau|color|tông|tong|palette|carton|bìa|bia|nền|nen|cam|orange|xám|xam|gray|grey|trắng|trang|đen|den|vàng|vang|xanh|hồng|hong|tím|tim/i.test(message)) {
    return false
  }
  if (/logo|biểu tượng|bieu tuong|icon|symbol|wordmark|nhãn hiệu|nhan hieu/i.test(message)) {
    return false
  }
  return message.trim().length >= 4
}

function stripEditIntent(message: string): string {
  let out = message
    .replace(EDIT_BRIEF_VERBS, ' ')
    .replace(/\b(bước|buoc|step|brief|mục|muc)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  out = out.replace(/^[^:：]{2,40}[:：]\s*/, '')
  return out.trim()
}

function hasSubstantiveBriefAnswer(message: string): boolean {
  return stripEditIntent(message).length >= 3
}

function discoveryStepIsDone(session: HubStudioSession, stepKey: string): boolean {
  return session.processSteps.find((s) => s.key === stepKey)?.status === 'done'
}

function firstDesignStepIndex(presetId: string): number {
  const flow = getFlowSteps(presetId)
  return flow.findIndex((s) => s.phase === 'design')
}

export function matchDiscoveryBriefEditStep(
  message: string,
  locale: WebLocale,
  presetId: string,
  session: HubStudioSession
): DiscoveryBriefEditMatch | null {
  const trimmed = message.trim()
  if (!trimmed || !session.processSteps.length) return null

  const flow = getFlowSteps(presetId)
  const discoverySteps = flow.filter((s) => s.phase === 'discovery')
  const currentKey = session.currentStepKey
  const explicitEdit = wantsEditBrief(trimmed)

  if (
    !explicitEdit &&
    currentKey &&
    isLogoDesignStep(presetId, currentKey) &&
    session.briefNotes.color_palette &&
    looksLikeColorBrief(trimmed) &&
    discoveryStepIsDone(session, 'color_palette')
  ) {
    return { stepKey: 'color_palette', reopenStep: false }
  }

  if (!explicitEdit) return null

  const normalizedMessage = normalize(trimmed)
  let best: { key: string; score: number } | null = null

  for (const step of discoverySteps) {
    if (!discoveryStepIsDone(session, step.key)) continue

    const aliases = new Set([
      normalize(presetStepLabel(locale, presetId, step.labelKey)),
      normalize(step.key.replace(/_/g, ' ')),
      ...(DISCOVERY_STEP_ALIASES[step.key] ?? []).map(normalize),
    ])

    for (const alias of aliases) {
      if (alias.length < 3 || !normalizedMessage.includes(alias)) continue
      let score = alias.length + 8
      if (step.key === 'color_palette' && looksLikeColorBrief(trimmed)) score += 6
      if (!best || score > best.score) best = { key: step.key, score }
    }
  }

  if (!best || best.score < 10) return null

  const targetIdx = flow.findIndex((s) => s.key === best!.key)
  const currentIdx = currentKey ? flow.findIndex((s) => s.key === currentKey) : -1
  const designStart = firstDesignStepIndex(presetId)
  const onEarlyDesign =
    currentIdx >= 0 &&
    designStart >= 0 &&
    currentIdx >= designStart &&
    currentIdx <= designStart + 1

  const reopenStep = !currentKey || isDiscoveryStep(presetId, currentKey) || onEarlyDesign

  if (targetIdx >= 0 && currentIdx >= 0 && currentIdx > targetIdx && !onEarlyDesign) {
    return { stepKey: best.key, reopenStep: false }
  }

  return { stepKey: best.key, reopenStep }
}

export function applyDiscoveryBriefEdit(
  session: HubStudioSession,
  presetId: string,
  targetStepKey: string,
  message: string,
  options: { reopenStep: boolean }
): HubStudioSession {
  const answer = stripEditIntent(message).trim() || message.trim()
  const briefNotes = { ...session.briefNotes, [targetStepKey]: answer }

  if (!options.reopenStep) {
    return {
      ...session,
      briefNotes,
      pendingPreview: null,
    }
  }

  const flow = getFlowSteps(presetId)
  const targetIdx = flow.findIndex((s) => s.key === targetStepKey)
  if (targetIdx < 0) {
    return { ...session, briefNotes, pendingPreview: null }
  }

  let processSteps = session.processSteps.map((s) => {
    const idx = flow.findIndex((f) => f.key === s.key)
    if (s.key === targetStepKey) return { ...s, status: 'in_progress' as const }
    if (idx > targetIdx && flow[idx]?.phase === 'discovery') {
      return { ...s, status: 'pending' as const }
    }
    return s
  })

  let currentStepKey = targetStepKey

  if (hasSubstantiveBriefAnswer(message)) {
    processSteps = processSteps.map((s) =>
      s.key === targetStepKey ? { ...s, status: 'done' as const } : s
    )
    const next = processSteps.find((s) => s.status !== 'done')
    currentStepKey = next?.key ?? targetStepKey
    processSteps = processSteps.map((s) => ({
      ...s,
      status:
        s.key === currentStepKey && s.status !== 'done'
          ? ('in_progress' as const)
          : s.status,
    }))
  }

  return {
    ...session,
    briefNotes,
    processSteps,
    currentStepKey,
    pendingPreview: null,
  }
}
