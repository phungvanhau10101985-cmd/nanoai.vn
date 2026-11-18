import { parseImageEngine, type ImageEngine } from '@/lib/ai/image-engine'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import { LOGO_GEMINI_ASPECT_RATIOS } from '@/lib/partner-website/visual-editor/gemini-working-aspect'

/**
 * Mặt hộp được coi là gần một tỷ lệ model khi cắt phủ kín mặt chỉ mất tối đa 8% một cạnh.
 * Xa hơn thì chỉ NanoAI F1.5K / F2K / F4K, vì GPT và Gemini không trả đúng khổ.
 */
export const BOX_FACE_RATIO_TOLERANCE = 0.08

/** Tỷ lệ Gemini tạo mặt hộp ổn định. Bỏ 4:1 và 8:1 vì một số key từ chối. */
export const BOX_FACE_GEMINI_ASPECT_RATIOS = LOGO_GEMINI_ASPECT_RATIOS

/** Tỷ lệ GPT Image 2 thực sự trả: 1024², 1536×1024, 1024×1536. */
export const BOX_FACE_GPT_ASPECT_RATIOS = ['1:1', '3:2', '2:3'] as const

export type BoxFaceImageRoute = {
  engines: ImageEngine[]
  preferred: ImageEngine
  geminiOk: boolean
  gptOk: boolean
  geminiAspect: string
  gptAspect: string
}

function aspectValue(token: string): number {
  const [width, height] = token.split(':').map(Number)
  if (!width || !height) return 1
  return width / height
}

function closestAspect(widthMm: number, heightMm: number, allowed: readonly string[]): { aspect: string; error: number } {
  const target = Math.max(1, widthMm) / Math.max(1, heightMm)
  let aspect = allowed[0] ?? '1:1'
  let error = Infinity
  for (const token of allowed) {
    const snapped = aspectValue(token)
    const next = Math.max(target, snapped) / Math.min(target, snapped) - 1
    if (next < error) {
      error = next
      aspect = token
    }
  }
  return { aspect, error }
}

/** Model được hiện khi khách tạo mặt hộp. Gần chuẩn thì Gemini rồi GPT. Xa thì chỉ Flux. */
export function boxFaceImageRoute(widthMm: number, heightMm: number): BoxFaceImageRoute {
  const gemini = closestAspect(widthMm, heightMm, BOX_FACE_GEMINI_ASPECT_RATIOS)
  const gpt = closestAspect(widthMm, heightMm, BOX_FACE_GPT_ASPECT_RATIOS)
  const geminiOk = gemini.error <= BOX_FACE_RATIO_TOLERANCE
  const gptOk = gpt.error <= BOX_FACE_RATIO_TOLERANCE
  const engines: ImageEngine[] = []
  if (geminiOk) engines.push('gemini')
  if (gptOk) engines.push('gpt')
  if (!engines.length) engines.push('flux')
  return {
    engines,
    preferred: engines[0] ?? 'flux',
    geminiOk,
    gptOk,
    geminiAspect: gemini.aspect,
    gptAspect: gpt.aspect,
  }
}

/** Engine khách gửi mà mặt này không tạo được thì chuyển về model đang mở. */
export function coerceBoxFaceEngine(engine: unknown, route: BoxFaceImageRoute): ImageEngine {
  const parsed = parseImageEngine(engine)
  if (route.engines.includes(parsed)) return parsed
  return route.preferred
}

const BOX_STANDARD_ASPECTS = [
  ...new Set<string>([...BOX_FACE_GEMINI_ASPECT_RATIOS, ...BOX_FACE_GPT_ASPECT_RATIOS]),
]

export type BoxSizeSnapDirection = 'larger' | 'smaller'

export type BoxSizeStandardChoice = {
  direction: BoxSizeSnapDirection
  dimensions: BoxDimensionsMm
  aspects: string[]
}

export type BoxSizeStandardChoices = {
  larger: BoxSizeStandardChoice | null
  smaller: BoxSizeStandardChoice | null
}

function standardAspectValue(token: string): number {
  return aspectValue(token)
}

function ratioGap(current: number, target: number): number {
  return Math.max(current, target) / Math.min(current, target) - 1
}

/** Tỷ lệ chuẩn ngay phía trên và phía dưới, chỉ khi lệch không quá 8%. */
function neighborAspects(current: number): {
  larger: { token: string; value: number } | null
  smaller: { token: string; value: number } | null
} {
  let larger: { token: string; value: number } | null = null
  let smaller: { token: string; value: number } | null = null
  for (const token of BOX_STANDARD_ASPECTS) {
    const value = standardAspectValue(token)
    if (ratioGap(current, value) > BOX_FACE_RATIO_TOLERANCE) continue
    if (value >= current - 1e-9 && (!larger || value < larger.value)) larger = { token, value }
    if (value <= current + 1e-9 && (!smaller || value > smaller.value)) smaller = { token, value }
  }
  return { larger, smaller }
}

function roundMm(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Giữ chiều dài. Rộng và cao chỉ đổi khi mặt đó gần một tỷ lệ Gemini hoặc GPT.
 * Tỷ lệ lớn hơn và tỷ lệ nhỏ hơn là hai lựa chọn. Mặt lệch quá 8% giữ nguyên.
 */
export function boxSizeStandardChoices(box: BoxDimensionsMm): BoxSizeStandardChoices {
  const build = (direction: BoxSizeSnapDirection): BoxSizeStandardChoice | null => {
    let width = box.width
    let height = box.height
    const aspects: string[] = []
    let widthSnapped = false
    let heightSnapped = false
    const lengthRatio = box.length / box.width
    const lengthNeighbors = neighborAspects(lengthRatio)
    const lengthSide = lengthNeighbors[direction]
    if (lengthSide && ratioGap(lengthRatio, lengthSide.value) > 0.002) {
      const next = roundMm(box.length / lengthSide.value)
      if (Math.abs(next - width) >= 0.05) {
        width = next
        widthSnapped = true
        aspects.push(lengthSide.token)
      }
    }
    const heightRatio = box.length / box.height
    const heightSide = neighborAspects(heightRatio)[direction]
    if (heightSide && ratioGap(heightRatio, heightSide.value) > 0.002) {
      const next = roundMm(box.length / heightSide.value)
      if (Math.abs(next - height) >= 0.05) {
        height = next
        heightSnapped = true
        aspects.push(heightSide.token)
      }
    }
    const footprintIsClose = Boolean(lengthNeighbors.larger || lengthNeighbors.smaller)
    if (!heightSnapped && !widthSnapped && !footprintIsClose) {
      const sideRatio = box.width / box.height
      const side = neighborAspects(sideRatio)[direction]
      if (side && ratioGap(sideRatio, side.value) > 0.002) {
        const next = roundMm(width / side.value)
        if (Math.abs(next - height) >= 0.05) {
          height = next
          aspects.push(side.token)
        }
      }
    }
    if (!aspects.length) return null
    return {
      direction,
      dimensions: { length: box.length, width, height },
      aspects,
    }
  }
  return { larger: build('larger'), smaller: build('smaller') }
}
