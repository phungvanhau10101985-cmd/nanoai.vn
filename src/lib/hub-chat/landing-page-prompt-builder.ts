import type { WebLocale } from '@/lib/i18n/config'

import {
  LANDING_DISCOVERY_BRIEF_KEYS,
  readLandingSectionBrief,
} from '@/lib/hub-chat/hub-studio-preset-flows'
import {
  getStepAskPrompt,
  presetTitle,
} from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

const BRIEF_LABELS: Record<WebLocale, Record<(typeof LANDING_DISCOVERY_BRIEF_KEYS)[number], string>> = {
  vi: {
    product_name: 'Tên sản phẩm / thương hiệu',
    value_prop: 'Pain points, lợi ích, giá / ưu đãi',
    target_audience: 'Khách hàng mục tiêu',
    style_mood: 'Phong cách & giọng văn',
    color_palette: 'Màu sắc',
  },
  en: {
    product_name: 'Product / brand',
    value_prop: 'Pain points, benefits, pricing',
    target_audience: 'Target audience',
    style_mood: 'Style & tone',
    color_palette: 'Colors',
  },
  zh: {
    product_name: '产品 / 品牌',
    value_prop: '痛点、卖点、价格',
    target_audience: '目标客户',
    style_mood: '风格',
    color_palette: '配色',
  },
  ja: {
    product_name: '商品 / ブランド',
    value_prop: 'ペイン、ベネフィット、価格',
    target_audience: 'ターゲット',
    style_mood: 'スタイル',
    color_palette: 'カラー',
  },
  ko: {
    product_name: '제품 / 브랜드',
    value_prop: '페인, 혜택, 가격',
    target_audience: '타깃',
    style_mood: '스타일',
    color_palette: '색상',
  },
}

function outputLanguage(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

export function formatLandingBriefBlock(input: {
  locale: WebLocale
  session: HubStudioSession
  sectionCopy?: string
}): string {
  const labels = BRIEF_LABELS[input.locale]
  const lines: string[] = []
  for (const key of LANDING_DISCOVERY_BRIEF_KEYS) {
    const value = input.session.briefNotes[key]?.trim()
    if (value) lines.push(`${labels[key]}: ${value}`)
  }
  const extra = input.sectionCopy?.trim()
  if (extra) lines.push(`Layout notes: ${extra}`)
  return lines.join('\n')
}

/** Compact structured prompt — reliable for image models (no extra AI hop). */
export function buildLandingStructuredImagePrompt(input: {
  locale: WebLocale
  session: HubStudioSession
  sectionCopy: string
  stepLabel: string
}): string {
  const { locale, session, sectionCopy, stepLabel } = input
  const lang = outputLanguage(locale)
  const brief = formatLandingBriefBlock({ locale, session, sectionCopy })
  const productName = session.briefNotes.product_name?.trim()
  const projectTitle = session.projectTitle?.trim() || productName || presetTitle(locale, 'landing_page')
  const savedCopy = readLandingSectionBrief('landing_full', session.briefNotes)
  const copyHint = sectionCopy.trim() || savedCopy

  return `Design ONE tall vertical full landing-page mockup image (aspect 1:4 portrait, continuous scroll layout). NOT code, NOT multiple files.
Project: ${projectTitle} — ${stepLabel}

CUSTOMER BRIEF:
${brief || copyHint || projectTitle}

ON-PAGE TEXT LANGUAGE: ${lang} (readable marketing copy on the mockup).

STACK these sections top-to-bottom in ONE image with clear visual blocks:
1) Header — composite attached LOGO pixels (top-left or top-center), nav placeholders
2) HERO — bold headline + sub-headline + 3 benefit bullets + primary CTA button + product/lifestyle visual
3) PAIN POINTS — 3 short empathy bullets about customer frustrations (from brief)
4) SOLUTION — introduce product/brand as the answer
5) FEATURES — 4 columns/cards: feature title + one-line benefit + small visual each
6) PRICING / OFFER — 2–3 tiers or combo deal; highlight best value; optional urgency badge
7) SOCIAL PROOF — 2–3 short customer quotes with name + role
8) ORDER FORM — compact fields: name, phone, address, variant/size, note
9) TRUST — 3 badges (e.g. COD, returns, warranty)
10) FAQ — 3 Q&A rows + bottom CTA strip

VISUAL STYLE: modern high-converting ecommerce landing, strong typography hierarchy, brand colors from brief, generous whitespace, mobile-first web UI aesthetic.
${copyHint ? `\nCOPY DIRECTION (use/adapt on mockup):\n${copyHint}` : ''}

Output: single finished landing mockup PNG-style image only.`
}

export function buildLandingSectionGenerationPrompt(input: {
  locale: WebLocale
  session: HubStudioSession
  stepKey: string
  sectionCopy: string
  stepLabel: string
}): string {
  return buildLandingStructuredImagePrompt({
    locale: input.locale,
    session: input.session,
    sectionCopy: input.sectionCopy,
    stepLabel: input.stepLabel,
  })
}

export function buildLandingFullPageGenerationPrompt(input: {
  locale: WebLocale
  session: HubStudioSession
  pageCopy: string
  stepLabel: string
}): string {
  return buildLandingStructuredImagePrompt({
    locale: input.locale,
    session: input.session,
    sectionCopy: input.pageCopy,
    stepLabel: input.stepLabel,
  })
}

export function buildLandingLogoGenerationPrompt(input: {
  locale: WebLocale
  session: HubStudioSession
  logoBrief: string
}): string {
  const { locale, session, logoBrief } = input
  const discoveryBlock = LANDING_DISCOVERY_BRIEF_KEYS.filter((k) => session.briefNotes[k]?.trim())
    .map((k) => `- ${k}: ${session.briefNotes[k]!.trim()}`)
    .join('\n')
  const productName = session.briefNotes.product_name?.trim()
  const projectTitle = session.projectTitle?.trim() || productName || presetTitle(locale, 'landing_page')

  return `Brand LOGO for landing page header: ${logoBrief}

${discoveryBlock ? `Brand brief:\n${discoveryBlock}` : ''}

Project: ${projectTitle}

Output: one clean brand logo on transparent or white background — vector-like, readable at small sizes in a website header. No mockup scene, no extra text besides the brand mark.`
}
