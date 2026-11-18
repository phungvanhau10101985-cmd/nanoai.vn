import { FLUX_IMAGE_NAME, NANOAI_GEMINI_ASPECT_MODELS, NANOAI_GPT_ASPECT_MODELS } from '@/lib/ai/nanoai-image-names'
import { boxFaceImageRoute, boxSizeStandardChoices, type BoxSizeSnapDirection } from '@/lib/packaging/box-face-engine'
import type { WebLocale } from '@/lib/i18n/config'
import { closestGeminiImageAspectRatio } from '@/lib/partner-website/visual-editor/gemini-working-aspect'
import {
  type BoxDimensionsMm,
  type PackagingFaceKey,
  getFaceDimensionsMm,
} from '@/lib/packaging/dimensions'
import { buildBoxWireframeSvg } from '@/lib/packaging/box-wireframe-svg'
import type { TuckBoxProductionParams } from '@/lib/packaging/tuck-box-production'
import type { BoxDielineStructure } from '@/lib/packaging/dieline-structure'
import type { HubStudioMessagePayload, HubStudioProcessStep } from '@/lib/hub-chat/hub-studio-types'
export type FaceLayoutOrientation = 'landscape' | 'portrait' | 'square'

/** Tỷ lệ gpt-image-2 thực sự trả về: 1024², 1024×1536, 1536×1024. */
export const GPT_FACE_RETURNABLE_ASPECT_RATIOS = ['1:1', '2:3', '3:2'] as const

export type PackagingFaceAspectInfo = {
  key: PackagingFaceKey
  widthMm: number
  heightMm: number
  geminiAspectRatio: string
  gptAspectRatio: string
  orientation: FaceLayoutOrientation
}

const FACE_ROLE: Record<
  PackagingFaceKey,
  Record<WebLocale, { name: string; stepKey: string }>
> = {
  LxW: {
    vi: { name: 'Mặt đáy/nắp (L×W)', stepKey: 'face_lxw' },
    en: { name: 'Bottom/top face (L×W)', stepKey: 'face_lxw' },
    zh: { name: '底/顶面 (L×W)', stepKey: 'face_lxw' },
    ja: { name: '底/天面 (L×W)', stepKey: 'face_lxw' },
    ko: { name: '바닥/뚜껑 면 (L×W)', stepKey: 'face_lxw' },
  },
  LxH: {
    vi: { name: 'Mặt trước/sau (L×H)', stepKey: 'face_lxh' },
    en: { name: 'Front/back face (L×H)', stepKey: 'face_lxh' },
    zh: { name: '正/背面 (L×H)', stepKey: 'face_lxh' },
    ja: { name: '正面/背面 (L×H)', stepKey: 'face_lxh' },
    ko: { name: '앞/뒷면 (L×H)', stepKey: 'face_lxh' },
  },
  WxH: {
    vi: { name: 'Mặt bên/hông (W×H)', stepKey: 'face_wxh' },
    en: { name: 'Side faces (W×H)', stepKey: 'face_wxh' },
    zh: { name: '侧面 (W×H)', stepKey: 'face_wxh' },
    ja: { name: '側面 (W×H)', stepKey: 'face_wxh' },
    ko: { name: '측면 (W×H)', stepKey: 'face_wxh' },
  },
}

const ORIENTATION_LABEL: Record<FaceLayoutOrientation, Record<WebLocale, string>> = {
  landscape: { vi: 'ngang', en: 'landscape', zh: '横版', ja: '横', ko: '가로' },
  portrait: { vi: 'đứng', en: 'portrait', zh: '竖版', ja: '縦', ko: '세로' },
  square: { vi: 'vuông', en: 'square', zh: '方形', ja: '正方形', ko: '정사각' },
}

export function getFaceLayoutOrientation(widthMm: number, heightMm: number): FaceLayoutOrientation {
  if (Math.abs(widthMm - heightMm) < 0.5) return 'square'
  return widthMm > heightMm ? 'landscape' : 'portrait'
}

function closestReturnableAspect(widthMm: number, heightMm: number, allowed: readonly string[]): string {
  const width = Math.max(1, Number(widthMm) || 1)
  const height = Math.max(1, Number(heightMm) || 1)
  const target = width / height
  let best = allowed[0] ?? '1:1'
  let bestDiff = Infinity
  for (const token of allowed) {
    const [w, h] = token.split(':').map(Number)
    if (!w || !h) continue
    const diff = Math.abs(target - w / h)
    if (diff < bestDiff) {
      bestDiff = diff
      best = token
    }
  }
  return best
}

/**
 * Tỷ lệ gemini-3-pro-image gần mm mặt hộp nhất.
 * Không dùng 9:21 (model không nhận) và không dùng 1:4 / 1:8 (runtime từ chối).
 */
export function getFaceGeminiAspectRatio(widthMm: number, heightMm: number): string {
  return closestGeminiImageAspectRatio(widthMm, heightMm)
}

/** Tỷ lệ gpt-image-2 gần mm mặt hộp nhất trong các size API trả về. */
export function closestGptFaceAspectRatio(widthMm: number, heightMm: number): string {
  return closestReturnableAspect(widthMm, heightMm, GPT_FACE_RETURNABLE_ASPECT_RATIOS)
}

export function buildPackagingFaceAspectPlan(
  dimensionsMm: BoxDimensionsMm
): Record<PackagingFaceKey, PackagingFaceAspectInfo> {
  const keys: PackagingFaceKey[] = ['LxW', 'LxH', 'WxH']
  const out = {} as Record<PackagingFaceKey, PackagingFaceAspectInfo>
  for (const key of keys) {
    const [widthMm, heightMm] = getFaceDimensionsMm(key, dimensionsMm)
    out[key] = {
      key,
      widthMm,
      heightMm,
      geminiAspectRatio: getFaceGeminiAspectRatio(widthMm, heightMm),
      gptAspectRatio: closestGptFaceAspectRatio(widthMm, heightMm),
      orientation: getFaceLayoutOrientation(widthMm, heightMm),
    }
  }
  return out
}

export function faceAspectRatiosFromPlan(
  plan: Record<PackagingFaceKey, PackagingFaceAspectInfo>
): Record<PackagingFaceKey, string> {
  return {
    LxW: plan.LxW.geminiAspectRatio,
    LxH: plan.LxH.geminiAspectRatio,
    WxH: plan.WxH.geminiAspectRatio,
  }
}

function formatMm(mm: number, locale: WebLocale): string {
  if (locale === 'en') return `${(mm / 10).toFixed(1)} cm`
  return `${(mm / 10).toFixed(1).replace('.', locale === 'vi' ? ',' : '.')} cm`
}

function formatBoxDims(box: BoxDimensionsMm, locale: WebLocale): string {
  const l = formatMm(box.length, locale)
  const w = formatMm(box.width, locale)
  const h = formatMm(box.height, locale)
  if (locale === 'vi') return `Dài ${l} × Rộng ${w} × Cao ${h}`
  if (locale === 'zh') return `长 ${l} × 宽 ${w} × 高 ${h}`
  if (locale === 'ja') return `長さ ${l} × 幅 ${w} × 高さ ${h}`
  if (locale === 'ko') return `길이 ${l} × 너비 ${w} × 높이 ${h}`
  return `L ${l} × W ${w} × H ${h}`
}

const FLUX_FACE_LABEL = `${FLUX_IMAGE_NAME['1.5K']} / ${FLUX_IMAGE_NAME['2K']} / ${FLUX_IMAGE_NAME['4K']}`

const FLUX_FACE_NOTE: Record<WebLocale, string> = {
  vi: 'đúng khổ mặt',
  en: 'true face ratio',
  zh: '按真实面比例',
  ja: '面の実比率',
  ko: '면의 실제 비율',
}

function faceLine(locale: WebLocale, info: PackagingFaceAspectInfo): string {
  const role = FACE_ROLE[info.key][locale].name
  const orient = ORIENTATION_LABEL[info.orientation][locale]
  const w = formatMm(info.widthMm, locale)
  const h = formatMm(info.heightMm, locale)
  const route = boxFaceImageRoute(info.widthMm, info.heightMm)
  const models = route.preferred === 'flux'
    ? `${FLUX_FACE_LABEL} ${FLUX_FACE_NOTE[locale]}`
    : [
        route.geminiOk ? `${NANOAI_GEMINI_ASPECT_MODELS} **${route.geminiAspect}**` : '',
        route.gptOk ? `${NANOAI_GPT_ASPECT_MODELS} **${route.gptAspect}**` : '',
      ]
        .filter(Boolean)
        .join(', ')
  return `• **${role}**: ${w} × ${h} — ${orient}, ${models}`
}

const CONFIRM_ACK =
  /^(ok|oke|okay|yes|yep|đúng|duoc|duoc roi|đồng ý|dong y|xác nhận|xac nhan|confirm|confirmed|chuẩn|chuan|ổn|on|fine|好的|确认|はい|確認|네|맞아)\.?$/i

export function isBoxFaceConfirmAck(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (CONFIRM_ACK.test(trimmed)) return true
  return /^(ok|đúng|xác nhận|confirm|好的|确认|はい|네)\b/i.test(trimmed) && trimmed.length <= 24
}

function formatChoiceCm(mm: number, locale: WebLocale): string {
  let text = (Math.round(mm * 100) / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  if (locale === 'vi') text = text.replace('.', ',')
  return `${text} cm`
}

function formatChoiceBox(box: BoxDimensionsMm, locale: WebLocale): string {
  const length = formatChoiceCm(box.length, locale)
  const width = formatChoiceCm(box.width, locale)
  const height = formatChoiceCm(box.height, locale)
  if (locale === 'zh') return `长 ${length} × 宽 ${width} × 高 ${height}`
  if (locale === 'ja') return `長さ ${length} × 幅 ${width} × 高さ ${height}`
  if (locale === 'ko') return `길이 ${length} × 너비 ${width} × 높이 ${height}`
  if (locale === 'en') return `L ${length} × W ${width} × H ${height}`
  return `Dài ${length} × Rộng ${width} × Cao ${height}`
}

const CHOICE_NAME: Record<BoxSizeSnapDirection, Record<WebLocale, string>> = {
  larger: {
    vi: 'Tỷ lệ lớn hơn',
    en: 'Larger ratio',
    zh: '较大比例',
    ja: '大きい比率',
    ko: '큰 비율',
  },
  smaller: {
    vi: 'Tỷ lệ nhỏ hơn',
    en: 'Smaller ratio',
    zh: '较小比例',
    ja: '小さい比率',
    ko: '작은 비율',
  },
}

export function boxSizeChoiceLabels(
  locale: WebLocale,
  dimensionsMm: BoxDimensionsMm
): Array<{ direction: BoxSizeSnapDirection; label: string }> {
  const choices = boxSizeStandardChoices(dimensionsMm)
  return (['larger', 'smaller'] as const).flatMap((direction) => {
    const choice = choices[direction]
    if (!choice) return []
    return [
      {
        direction,
        label: `${CHOICE_NAME[direction][locale]} ${choice.aspects.join(' · ')} — ${formatChoiceBox(choice.dimensions, locale)}`,
      },
    ]
  })
}

export function buildBoxFaceConfirmSummary(locale: WebLocale, dimensionsMm: BoxDimensionsMm): string {
  const plan = buildPackagingFaceAspectPlan(dimensionsMm)
  const lines = (['LxW', 'LxH', 'WxH'] as PackagingFaceKey[]).map((k) => faceLine(locale, plan[k]))
  const choiceLabels = boxSizeChoiceLabels(locale, dimensionsMm)

  const headers: Record<WebLocale, { title: string; footer: string }> = {
    vi: {
      title: `Đã ghi nhận hộp: **${formatBoxDims(dimensionsMm, locale)}**.\n\nXác nhận kích thước từng mặt. Tỷ lệ gần chuẩn thì chốt về tỷ lệ model để phủ kín. Tỷ lệ lệch thì giữ đúng khổ:`,
      footer: choiceLabels.length
        ? '\n\nChọn một tỷ lệ bên dưới. Hoặc nhập lại Dài × Rộng × Cao nếu thứ tự các chiều khác.'
        : '\n\nTrả lời **OK** nếu đúng, hoặc nhập lại kích thước Dài × Rộng × Cao nếu thứ tự các chiều khác.',
    },
    en: {
      title: `Box recorded: **${formatBoxDims(dimensionsMm, locale)}**.\n\nConfirm each face. A close ratio snaps to that model so the art covers the face. A distant ratio keeps the true size:`,
      footer: choiceLabels.length
        ? '\n\nPick one ratio below, or re-enter Length × Width × Height if your dimension order differs.'
        : '\n\nReply **OK** if correct, or re-enter Length × Width × Height if your dimension order differs.',
    },
    zh: {
      title: `已记录盒子：**${formatBoxDims(dimensionsMm, locale)}**。\n\n请确认各面尺寸。比例接近标准时改用模型比例并铺满该面。比例差太远时保持真实尺寸：`,
      footer: choiceLabels.length
        ? '\n\n请选择下方的一个比例。若长宽高的对应关系不同，请重新输入尺寸。'
        : '\n\n若正确请回复 **OK**，若长宽高的对应关系不同请重新输入尺寸。',
    },
    ja: {
      title: `箱サイズを記録しました：**${formatBoxDims(dimensionsMm, locale)}**。\n\n各面を確認。近い比率はそのモデルの比率に合わせて面を埋め、遠い比率は実寸のまま：`,
      footer: choiceLabels.length
        ? '\n\n下のいずれかの比率を選んでください。寸法の対応が違う場合は再入力してください。'
        : '\n\n正しければ **OK**、寸法の対応が違う場合は 長さ×幅×高さ を再入力してください。',
    },
    ko: {
      title: `상자 크기 기록: **${formatBoxDims(dimensionsMm, locale)}**.\n\n각 면을 확인하세요. 비율이 가까우면 그 모델 비율로 맞추어 면을 채우고, 멀면 실제 크기를 유지합니다:`,
      footer: choiceLabels.length
        ? '\n\n아래 비율 중 하나를 고르세요. 치수 순서가 다르면 다시 입력하세요.'
        : '\n\n맞으면 **OK**, 치수 순서가 다르면 길이 × 너비 × 높이를 다시 입력하세요.',
    },
  }

  const h = headers[locale]
  const choiceBlock = choiceLabels.length ? `\n\n${choiceLabels.map((item) => `• ${item.label}`).join('\n')}` : ''
  return `${h.title}\n\n${lines.join('\n')}${choiceBlock}${h.footer}`
}

export function buildBoxFaceConfirmStudioPayload(
  locale: WebLocale,
  dimensionsMm: BoxDimensionsMm,
  processSteps?: HubStudioProcessStep[]
): Pick<HubStudioMessagePayload, 'processSteps' | 'boxWireframeSvg'> {
  return {
    processSteps,
    boxWireframeSvg: buildBoxWireframeSvg(dimensionsMm, locale),
  }
}

export function packagingBoxConfirmStudioExtras(
  _locale: WebLocale,
  session: {
    presetId?: string | null
    currentStepKey?: string | null
    processSteps?: HubStudioProcessStep[]
    packaging?: {
      dimensionsMm?: BoxDimensionsMm | null
      facesConfirmed?: boolean
      layout?: 'six_faces' | 'hybrid_strip'
      dielineStructure?: BoxDielineStructure
      production?: TuckBoxProductionParams
    } | null
  }
): Pick<HubStudioMessagePayload, 'processSteps'> | null {
  if (
    session.presetId !== 'packaging_kit' ||
    session.currentStepKey !== 'box_face_confirm' ||
    !session.packaging?.dimensionsMm ||
    session.packaging.facesConfirmed
  ) {
    return null
  }
  return {
    processSteps: session.processSteps,
  }
}
