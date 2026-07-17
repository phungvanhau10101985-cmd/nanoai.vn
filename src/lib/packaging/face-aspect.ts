import type { WebLocale } from '@/lib/i18n/config'
import { getAspectRatioFromDimensions } from '@/lib/aspect-ratio-from-dimensions'
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

export type PackagingFaceAspectInfo = {
  key: PackagingFaceKey
  widthMm: number
  heightMm: number
  geminiAspectRatio: string
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

/** Best Gemini aspect ratio for a physical face (mm). */
export function getFaceGeminiAspectRatio(widthMm: number, heightMm: number): string {
  const long = Math.max(widthMm, heightMm)
  const short = Math.min(widthMm, heightMm)
  const orientation = getFaceLayoutOrientation(widthMm, heightMm)
  return getAspectRatioFromDimensions(
    long,
    short,
    orientation === 'portrait' ? 'vertical' : 'horizontal'
  )
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

function faceLine(locale: WebLocale, info: PackagingFaceAspectInfo): string {
  const role = FACE_ROLE[info.key][locale].name
  const orient = ORIENTATION_LABEL[info.orientation][locale]
  const w = formatMm(info.widthMm, locale)
  const h = formatMm(info.heightMm, locale)
  return `• **${role}**: ${w} × ${h} — ${orient}, Gemini **${info.geminiAspectRatio}**`
}

const CONFIRM_ACK =
  /^(ok|oke|okay|yes|yep|đúng|duoc|duoc roi|đồng ý|dong y|xác nhận|xac nhan|confirm|confirmed|chuẩn|chuan|ổn|on|fine|好的|确认|はい|確認|네|맞아)\.?$/i

export function isBoxFaceConfirmAck(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (CONFIRM_ACK.test(trimmed)) return true
  return /^(ok|đúng|xác nhận|confirm|好的|确认|はい|네)\b/i.test(trimmed) && trimmed.length <= 24
}

export function buildBoxFaceConfirmSummary(locale: WebLocale, dimensionsMm: BoxDimensionsMm): string {
  const plan = buildPackagingFaceAspectPlan(dimensionsMm)
  const lines = (['LxW', 'LxH', 'WxH'] as PackagingFaceKey[]).map((k) => faceLine(locale, plan[k]))

  const headers: Record<WebLocale, { title: string; footer: string }> = {
    vi: {
      title: `Đã ghi nhận hộp: **${formatBoxDims(dimensionsMm, locale)}**.\n\nXác nhận kích thước từng mặt — ảnh AI dùng **tỷ lệ Gemini gần nhất** với kích thước thật:`,
      footer:
        '\n\nTrả lời **OK** nếu đúng, hoặc nhập lại kích thước Dài × Rộng × Cao nếu thứ tự các chiều khác.',
    },
    en: {
      title: `Box recorded: **${formatBoxDims(dimensionsMm, locale)}**.\n\nConfirm each face — AI images use the **closest Gemini ratio** to your real size:`,
      footer:
        '\n\nReply **OK** if correct, or re-enter Length × Width × Height if your dimension order differs.',
    },
    zh: {
      title: `已记录盒子：**${formatBoxDims(dimensionsMm, locale)}**。\n\n请确认各面尺寸 — AI 图像将使用**最接近**实际尺寸的 Gemini 比例：`,
      footer: '\n\n若正确请回复 **OK**，若长宽高的对应关系不同请重新输入尺寸。',
    },
    ja: {
      title: `箱サイズを記録しました：**${formatBoxDims(dimensionsMm, locale)}**。\n\n各面を確認 — AI画像は実寸に**最も近い** Gemini 比率を使用：`,
      footer:
        '\n\n正しければ **OK**、寸法の対応が違う場合は 長さ×幅×高さ を再入力してください。',
    },
    ko: {
      title: `상자 크기 기록: **${formatBoxDims(dimensionsMm, locale)}**.\n\n각 면 확인 — AI 이미지는 실제 크기에 **가장 가까운** Gemini 비율 사용:`,
      footer:
        '\n\n맞으면 **OK**, 치수 순서가 다르면 길이 × 너비 × 높이를 다시 입력하세요.',
    },
  }

  const h = headers[locale]
  return `${h.title}\n\n${lines.join('\n')}${h.footer}`
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
