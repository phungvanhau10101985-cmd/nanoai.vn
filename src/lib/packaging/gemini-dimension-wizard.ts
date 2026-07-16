import type { WebLocale } from '@/lib/i18n/config'
import { GEMINI_ASPECT_RATIOS } from '@/lib/label-size-presets'
import {
  BOX_MAX_MM,
  BOX_MIN_MM,
  type BoxDimensionsMm,
  cmToMm,
} from '@/lib/packaging/dimensions'

const RATIO_EPS = 0.002

const GEMINI_RATIO_VALUES = GEMINI_ASPECT_RATIOS.map((ar) => {
  const [w, h] = ar.split(':').map(Number)
  return { str: ar, value: w / h }
})

export type ParseSingleDimensionResult =
  | { ok: true; valueMm: number }
  | { ok: false; error: 'format' | 'range' }

export type BoxWidthOption = {
  index: number
  widthMm: number
  geminiLxw: string
}

export type BoxHeightOption = {
  index: number
  heightMm: number
  geminiLxw: string
  geminiLxh: string
  geminiWxh: string
}

function roundMm(mm: number): number {
  return Math.round(mm * 100) / 100
}

function faceAspectValue(a: number, b: number): number {
  return Math.max(a, b) / Math.min(a, b)
}

/** Returns Gemini ratio string when face dimensions match exactly (within tolerance). */
export function exactGeminiFaceRatio(widthMm: number, heightMm: number): string | null {
  const ratio = faceAspectValue(widthMm, heightMm)
  for (const g of GEMINI_RATIO_VALUES) {
    if (Math.abs(ratio - g.value) / g.value <= RATIO_EPS) return g.str
  }
  return null
}

function dimensionSideFromRatio(fixedMm: number, ratioValue: number, fixedIsLong: boolean): number {
  return roundMm(fixedIsLong ? fixedMm / ratioValue : fixedMm * ratioValue)
}

/** Width options where L×W matches a Gemini ratio exactly (height unconstrained). */
export function getWidthOptionsForLengthLxwOnly(lengthMm: number): BoxWidthOption[] {
  const seen = new Set<number>()
  const raw: BoxWidthOption[] = []

  for (const g of GEMINI_RATIO_VALUES) {
    for (const fixedIsLong of [true, false]) {
      const widthMm = dimensionSideFromRatio(lengthMm, g.value, fixedIsLong)
      if (widthMm < BOX_MIN_MM || widthMm > BOX_MAX_MM) continue
      if (exactGeminiFaceRatio(lengthMm, widthMm) !== g.str) continue
      if (seen.has(widthMm)) continue
      seen.add(widthMm)
      raw.push({ index: 0, widthMm, geminiLxw: g.str })
    }
  }

  raw.sort((a, b) => a.widthMm - b.widthMm)
  return raw.map((row, i) => ({ ...row, index: i + 1 }))
}

/** Width options for L×W that also allow at least one valid height (strict 3-face wizard). */
export function getWidthOptionsForLength(lengthMm: number): BoxWidthOption[] {
  return getWidthOptionsForLengthLxwOnly(lengthMm)
    .filter((o) => getHeightOptionsForLengthWidth(lengthMm, o.widthMm).length > 0)
    .map((row, i) => ({ ...row, index: i + 1 }))
}

/** Height options where L×W, L×H and W×H all match Gemini ratios exactly. */
export function getHeightOptionsForLengthWidth(lengthMm: number, widthMm: number): BoxHeightOption[] {
  const lxw = exactGeminiFaceRatio(lengthMm, widthMm)
  if (!lxw) return []

  const seen = new Set<number>()
  const raw: Omit<BoxHeightOption, 'index'>[] = []

  for (const g of GEMINI_RATIO_VALUES) {
    for (const fixedIsLong of [true, false]) {
      const heightMm = dimensionSideFromRatio(lengthMm, g.value, fixedIsLong)
      if (heightMm < BOX_MIN_MM || heightMm > BOX_MAX_MM) continue
      const lxh = exactGeminiFaceRatio(lengthMm, heightMm)
      const wxh = exactGeminiFaceRatio(widthMm, heightMm)
      if (!lxh || !wxh) continue
      if (seen.has(heightMm)) continue
      seen.add(heightMm)
      raw.push({ heightMm, geminiLxw: lxw, geminiLxh: lxh, geminiWxh: wxh })
    }
  }

  raw.sort((a, b) => a.heightMm - b.heightMm)
  return raw.map((row, i) => ({ ...row, index: i + 1 }))
}

export function parseSingleBoxDimension(input: string): ParseSingleDimensionResult {
  const normalized = input.trim().replace(/,/g, '.')
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(mm|cm)?$/i)
  if (!match) return { ok: false, error: 'format' }

  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: 'format' }

  const unit = (match[2] ?? 'cm').toLowerCase()
  const valueMm = unit === 'mm' ? roundMm(value) : cmToMm(value)
  if (valueMm < BOX_MIN_MM || valueMm > BOX_MAX_MM) return { ok: false, error: 'range' }
  return { ok: true, valueMm }
}

function parseChoiceIndex(input: string): number | null {
  const m = input.trim().match(/^#?(\d+)$/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatMmAsCm(mm: number, locale: WebLocale): string {
  const cm = (mm / 10).toFixed(1)
  if (locale === 'vi') return cm.replace('.', ',')
  return cm
}

export function pickWidthOption(message: string, lengthMm: number): BoxWidthOption | null {
  const options = getWidthOptionsForLength(lengthMm)
  if (!options.length) return null

  const idx = parseChoiceIndex(message)
  if (idx !== null) return options.find((o) => o.index === idx) ?? null

  const parsed = parseSingleBoxDimension(message)
  if (!parsed.ok) return null

  return (
    options.find((o) => Math.abs(o.widthMm - parsed.valueMm) <= 0.5) ??
    options.find((o) => Math.abs(o.widthMm - parsed.valueMm) <= 2) ??
    null
  )
}

export function pickHeightOption(
  message: string,
  lengthMm: number,
  widthMm: number
): BoxHeightOption | null {
  const options = getHeightOptionsForLengthWidth(lengthMm, widthMm)
  if (!options.length) return null

  const idx = parseChoiceIndex(message)
  if (idx !== null) return options.find((o) => o.index === idx) ?? null

  const parsed = parseSingleBoxDimension(message)
  if (!parsed.ok) return null

  return (
    options.find((o) => Math.abs(o.heightMm - parsed.valueMm) <= 0.5) ??
    options.find((o) => Math.abs(o.heightMm - parsed.valueMm) <= 2) ??
    null
  )
}

export function buildDimensionsFromDraft(
  lengthMm: number,
  widthMm: number,
  heightMm: number
): BoxDimensionsMm {
  return { length: lengthMm, width: widthMm, height: heightMm }
}

/** True when L×W×H came from the dimension picker (all faces match a Gemini ratio). */
export function allFacesGeminiExact(box: BoxDimensionsMm): boolean {
  const widths = getWidthOptionsForLength(box.length)
  if (!widths.some((w) => Math.abs(w.widthMm - box.width) <= 0.5)) return false
  return getHeightOptionsForLengthWidth(box.length, box.width).some(
    (o) => Math.abs(o.heightMm - box.height) <= 0.5
  )
}

function formatCmLine(locale: WebLocale, mm: number): string {
  return `${formatMmAsCm(mm, locale)} cm`
}

export function buildLengthAckMessage(locale: WebLocale, lengthMm: number): string {
  const len = formatCmLine(locale, lengthMm)
  const rows = {
    vi: `Đã ghi nhận chiều dài: **${len}**.\n\nChọn **chiều rộng (W)** — mỗi lựa chọn khớp 100% tỷ lệ Gemini cho mặt đáy/nắp (L×W):`,
    en: `Length recorded: **${len}**.\n\nChoose **width (W)** — each option matches a Gemini aspect ratio exactly for the bottom/top face (L×W):`,
    zh: `已记录长度：**${len}**。\n\n请选择**宽度 (W)** — 每项均与底/顶面 (L×W) 的 Gemini 比例完全匹配：`,
    ja: `長さを記録しました：**${len}**。\n\n**幅 (W)** を選んでください — 各候補は底/天面 (L×W) の Gemini 比率に完全一致します：`,
    ko: `길이 기록: **${len}**.\n\n**너비 (W)** 를 선택하세요 — 각 옵션은 바닥/뚜껑 면 (L×W) Gemini 비율과 100% 일치합니다:`,
  } satisfies Record<WebLocale, string>
  return rows[locale]
}

export function buildWidthOptionsMessage(locale: WebLocale, lengthMm: number): string {
  const options = getWidthOptionsForLength(lengthMm)
  if (!options.length) {
    const rows = {
      vi: 'Không tìm được chiều rộng phù hợp tỷ lệ Gemini với chiều dài này. Hãy nhập lại chiều dài khác (2–50 cm).',
      en: 'No Gemini-compatible width for this length. Enter a different length (2–50 cm).',
      zh: '此长度下没有匹配的 Gemini 宽度。请重新输入长度（2–50 cm）。',
      ja: 'この長さに合う Gemini 幅がありません。別の長さ（2–50 cm）を入力してください。',
      ko: '이 길이에 맞는 Gemini 너비가 없습니다. 다른 길이(2–50 cm)를 입력하세요.',
    } satisfies Record<WebLocale, string>
    return rows[locale]
  }

  const lines = options.map((o) => {
    const w = formatCmLine(locale, o.widthMm)
    return `${o.index}. **${w}** — L×W Gemini **${o.geminiLxw}**`
  })

  const footers = {
    vi: '\n\nTrả lời **số thứ tự** (vd. `2`) hoặc nhập trực tiếp cm (vd. `33,3`).',
    en: '\n\nReply with the **option number** (e.g. `2`) or enter cm directly (e.g. `33.3`).',
    zh: '\n\n回复**序号**（如 `2`）或直接输入 cm（如 `33.3`）。',
    ja: '\n\n**番号**（例 `2`）または cm を直接入力（例 `33.3`）。',
    ko: '\n\n**번호**(`2`) 또는 cm 직접 입력(`33.3`).',
  } satisfies Record<WebLocale, string>

  return `${buildLengthAckMessage(locale, lengthMm)}\n\n${lines.join('\n')}${footers[locale]}`
}

export function buildWidthAckMessage(locale: WebLocale, lengthMm: number, widthMm: number): string {
  const w = formatCmLine(locale, widthMm)
  const rows = {
    vi: `Đã chọn rộng: **${w}**.\n\nChọn **chiều cao (H)** — mỗi lựa chọn khớp 100% Gemini cho cả 3 mặt (L×W, L×H, W×H):`,
    en: `Width selected: **${w}**.\n\nChoose **height (H)** — each option matches Gemini exactly on all 3 faces (L×W, L×H, W×H):`,
    zh: `已选宽度：**${w}**。\n\n请选择**高度 (H)** — 每项与三个面 (L×W, L×H, W×H) 的 Gemini 比例完全匹配：`,
    ja: `幅を選択：**${w}**。\n\n**高さ (H)** を選んでください — 3面 (L×W, L×H, W×H) すべて Gemini 比率に完全一致：`,
    ko: `너비 선택: **${w}**.\n\n**높이 (H)** 를 선택하세요 — 3면 (L×W, L×H, W×H) 모두 Gemini 비율 100% 일치:`,
  } satisfies Record<WebLocale, string>
  return rows[locale]
}

export function buildHeightOptionsMessage(
  locale: WebLocale,
  lengthMm: number,
  widthMm: number
): string {
  const options = getHeightOptionsForLengthWidth(lengthMm, widthMm)
  if (!options.length) {
    const rows = {
      vi: 'Không có chiều cao phù hợp với bộ Dài×Rộng này. Hãy chọn lại chiều rộng.',
      en: 'No compatible height for this length × width. Pick a different width.',
      zh: '此长×宽组合无匹配高度。请重新选择宽度。',
      ja: 'この長さ×幅に合う高さがありません。幅を選び直してください。',
      ko: '이 길이×너비에 맞는 높이가 없습니다. 너비를 다시 선택하세요.',
    } satisfies Record<WebLocale, string>
    return rows[locale]
  }

  const lines = options.map((o) => {
    const h = formatCmLine(locale, o.heightMm)
    return `${o.index}. **${h}** — L×W **${o.geminiLxw}**, L×H **${o.geminiLxh}**, W×H **${o.geminiWxh}**`
  })

  const footers = {
    vi: '\n\nTrả lời **số thứ tự** hoặc nhập cm trực tiếp.',
    en: '\n\nReply with the **option number** or enter cm directly.',
    zh: '\n\n回复**序号**或直接输入 cm。',
    ja: '\n\n**番号**または cm を直接入力。',
    ko: '\n\n**번호** 또는 cm 직접 입력.',
  } satisfies Record<WebLocale, string>

  return `${buildWidthAckMessage(locale, lengthMm, widthMm)}\n\n${lines.join('\n')}${footers[locale]}`
}

export function singleDimensionError(locale: WebLocale, kind: 'format' | 'range'): string {
  const rows = {
    vi:
      kind === 'format'
        ? 'Chưa đúng định dạng. Nhập một số cm, ví dụ: `50` hoặc `50 cm`.'
        : 'Chiều phải từ 2 đến 50 cm.',
    en:
      kind === 'format'
        ? 'Invalid format. Enter one value in cm, e.g. `50` or `50 cm`.'
        : 'Value must be between 2 and 50 cm.',
    zh: kind === 'format' ? '格式不正确。请输入 cm，例如 `50` 或 `50 cm`。' : '尺寸须在 2–50 cm 之间。',
    ja:
      kind === 'format'
        ? '形式が正しくありません。cm で入力（例：`50` または `50 cm`）。'
        : '2〜50 cm の範囲で入力してください。',
    ko:
      kind === 'format'
        ? '형식이 올바르지 않습니다. cm 입력(예: `50` 또는 `50 cm`).'
        : '2~50 cm 범위여야 합니다.',
  } satisfies Record<WebLocale, string>
  return rows[locale]
}

export function dimensionChoiceError(locale: WebLocale, kind: 'width' | 'height'): string {
  const rows = {
    vi:
      kind === 'width'
        ? 'Chưa khớp lựa chọn rộng. Trả lời số thứ tự trong danh sách hoặc nhập đúng cm.'
        : 'Chưa khớp lựa chọn cao. Trả lời số thứ tự trong danh sách hoặc nhập đúng cm.',
    en:
      kind === 'width'
        ? 'Width choice not recognized. Reply with a list number or matching cm value.'
        : 'Height choice not recognized. Reply with a list number or matching cm value.',
    zh:
      kind === 'width'
        ? '未识别宽度选项。请回复列表序号或匹配的 cm 值。'
        : '未识别高度选项。请回复列表序号或匹配的 cm 值。',
    ja:
      kind === 'width'
        ? '幅の選択を認識できません。番号または一致する cm を入力してください。'
        : '高さの選択を認識できません。番号または一致する cm を入力してください。',
    ko:
      kind === 'width'
        ? '너비 선택을 인식하지 못했습니다. 목록 번호 또는 cm 값을 입력하세요.'
        : '높이 선택을 인식하지 못했습니다. 목록 번호 또는 cm 값을 입력하세요.',
  } satisfies Record<WebLocale, string>
  return rows[locale]
}
