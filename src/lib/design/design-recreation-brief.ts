import type { WebLocale } from '@/lib/i18n/config'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { loadImageBufferFromUrl } from '@/lib/hub-agent/sharpen-pipeline'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { DESIGN_RECREATE_LOGO_KEY } from '@/lib/design/design-recreate-process-steps'
import { buildDesignBoardLanguagePromptBlock } from '@/lib/design/design-discovery-choices'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  DESIGN_RECREATE_MAX_UPLOAD,
  buildDesignStepPromptBlock,
  type DesignSectorKey,
  resolveDesignFormat,
  resolveDesignRenderStyle,
  resolveDesignSector,
} from '@/lib/design/design-sector-templates'

export type DesignRecreationBriefAnalysis = {
  productType: string
  garmentStructure: {
    silhouette: string
    collar: string
    sleeves: string
    length: string
    closure: string
    details: string[]
  }
  materials: string[]
  colorPalette: {
    primary: string[]
    secondary: string[]
    accent: string[]
    notes: string
  }
  stylingCoordination: {
    bottom: string
    bag: string
    shoes: string
    accessories: string
  }
  visualStyle: {
    treatment: string
    lineWeight: string
    layout: string
    mood: string
  }
  technicalViews: string[]
  inspirationMood: string
  occasionUse: string
  doNotCopy: string[]
  recreationPromptEn: string
}

const ANALYSIS_SYS = `You are a fashion and product design analyst. The user attached 1-4 product sample photos from different angles.
Extract design language to RECREATE a similar design — do NOT identify brands, copy logos, or transcribe readable marketing text.

Return JSON only:
{
  "productType": "garment or product category in English",
  "garmentStructure": {
    "silhouette": "...",
    "collar": "...",
    "sleeves": "...",
    "length": "...",
    "closure": "...",
    "details": ["3D embroidery", "bell sleeves", "..."]
  },
  "materials": ["silk brocade", "..."],
  "colorPalette": {
    "primary": ["peach/apricot", "#hex or name"],
    "secondary": ["cream beige", "..."],
    "accent": ["metallic gold", "light green"],
    "notes": "warm pastels, soft contrast"
  },
  "stylingCoordination": {
    "bottom": "wide-leg silk trousers cream",
    "bag": "structured beige leather handbag",
    "shoes": "high-heeled sandals",
    "accessories": "peach headband, red tassels"
  },
  "visualStyle": {
    "treatment": "digital watercolor illustration | realistic photo | line art | concept board layout",
    "lineWeight": "thin | medium | bold",
    "layout": "concept board | single product | flat lay",
    "mood": "modern oriental elegance | minimal | luxury | ..."
  },
  "technicalViews": ["front", "back", "side"],
  "inspirationMood": "2 sentences: design concept and cultural/style inspiration",
  "occasionUse": "Tet holiday, festivals, formal events, daily wear, ...",
  "doNotCopy": ["brand logos", "exact readable text", "trademarks"],
  "recreationPromptEn": "3-5 sentences in English: detailed art direction to recreate this design in a professional concept sheet. Include silhouette, materials, colors, embroidery/details, styling coordination, and mood."
}

Rules:
- Merge information from ALL attached angles into one coherent design brief.
- recreationPromptEn must be directly usable as image generation prompt input.
- Describe what you SEE across all photos, not brand guesses.
- For non-garment products, adapt garmentStructure fields to closest product anatomy (handle, strap, cap, etc.).`

function parseAnalysisJson(text: string): DesignRecreationBriefAnalysis | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced || trimmed
  try {
    const parsed = JSON.parse(candidate) as DesignRecreationBriefAnalysis
    if (!parsed?.recreationPromptEn?.trim()) return null
    return parsed
  } catch {
    return null
  }
}

function formatBriefText(analysis: DesignRecreationBriefAnalysis, sector: DesignSectorKey): string {
  const paletteBits = [
    analysis.colorPalette.primary?.length
      ? `Primary colors: ${analysis.colorPalette.primary.join(', ')}`
      : '',
    analysis.colorPalette.secondary?.length
      ? `Secondary: ${analysis.colorPalette.secondary.join(', ')}`
      : '',
    analysis.colorPalette.accent?.length ? `Accent: ${analysis.colorPalette.accent.join(', ')}` : '',
    analysis.colorPalette.notes ? `Color notes: ${analysis.colorPalette.notes}` : '',
  ].filter(Boolean)

  const structureBits = [
    analysis.garmentStructure.silhouette ? `Silhouette: ${analysis.garmentStructure.silhouette}` : '',
    analysis.garmentStructure.collar ? `Collar/neckline: ${analysis.garmentStructure.collar}` : '',
    analysis.garmentStructure.sleeves ? `Sleeves: ${analysis.garmentStructure.sleeves}` : '',
    analysis.garmentStructure.length ? `Length: ${analysis.garmentStructure.length}` : '',
    analysis.garmentStructure.closure ? `Closure: ${analysis.garmentStructure.closure}` : '',
    analysis.garmentStructure.details?.length
      ? `Details: ${analysis.garmentStructure.details.join('; ')}`
      : '',
  ].filter(Boolean)

  const stylingBits = [
    analysis.stylingCoordination.bottom ? `Bottom: ${analysis.stylingCoordination.bottom}` : '',
    analysis.stylingCoordination.bag ? `Bag: ${analysis.stylingCoordination.bag}` : '',
    analysis.stylingCoordination.shoes ? `Shoes: ${analysis.stylingCoordination.shoes}` : '',
    analysis.stylingCoordination.accessories
      ? `Accessories: ${analysis.stylingCoordination.accessories}`
      : '',
  ].filter(Boolean)

  return [
    analysis.recreationPromptEn.trim(),
    analysis.productType ? `\nProduct type: ${analysis.productType}` : '',
    structureBits.length ? `\nStructure:\n${structureBits.join('\n')}` : '',
    analysis.materials?.length ? `\nMaterials: ${analysis.materials.join(', ')}` : '',
    paletteBits.length ? `\n${paletteBits.join('\n')}` : '',
    stylingBits.length ? `\nStyling coordination:\n${stylingBits.join('\n')}` : '',
    analysis.visualStyle?.treatment ? `\nVisual treatment: ${analysis.visualStyle.treatment}` : '',
    analysis.visualStyle?.mood ? `\nMood: ${analysis.visualStyle.mood}` : '',
    analysis.inspirationMood ? `\nInspiration: ${analysis.inspirationMood}` : '',
    analysis.occasionUse ? `\nOccasion: ${analysis.occasionUse}` : '',
    sector ? `\nDesign sector: ${sector}` : '',
    analysis.doNotCopy?.length
      ? `\nDo NOT copy from reference: ${analysis.doNotCopy.join('; ')}`
      : '',
  ]
    .join('')
    .trim()
}

export function formatDesignRecreationBriefBlock(brief: string): string {
  return `DESIGN RECREATION BRIEF (from product sample analysis — recreate similar design, do NOT copy brands/logos/text):
${brief.trim()}

Use attached product sample photo(s) as structure/color/material reference. Generate NEW original design artwork inspired by this brief.`
}

export async function analyzeDesignRecreationSamples(
  userId: string,
  imageUrls: string[],
  sector: DesignSectorKey
): Promise<
  | { ok: true; analysis: DesignRecreationBriefAnalysis; brief: string }
  | { ok: false; error: string }
> {
  const urls = imageUrls.filter(Boolean).slice(0, DESIGN_RECREATE_MAX_UPLOAD)
  if (!urls.length) {
    return { ok: false, error: 'No product sample images to analyze.' }
  }

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: ANALYSIS_SYS },
    { text: `Design sector context: ${sector}. Analyze all attached sample photos together.` },
  ]

  for (const url of urls) {
    const loaded = await loadImageBufferFromUrl(url)
    if (!loaded) continue
    parts.push({
      inlineData: {
        data: loaded.buffer.toString('base64'),
        mimeType: loaded.mimeType || 'image/png',
      },
    })
  }

  if (parts.length < 3) {
    return { ok: false, error: 'Unable to load product sample images.' }
  }

  const { apiKey } = await (async () => {
    const { requireGoogleApiKeyForUser } = await import('@/lib/ai/google-api-key-resolver')
    return requireGoogleApiKeyForUser(userId)
  })()

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2200,
      responseMimeType: 'application/json',
    },
  })

  parts.push({ text: 'Analyze all attached product sample photos and return JSON only.' })

  const result = await model.generateContent(parts)
  await trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_25_FLASH_NO_THINKING.model,
    'hub-studio-design-recreation-analysis',
    userId
  )

  const parsed = parseAnalysisJson(result.response.text()?.trim() ?? '')
  if (!parsed) {
    return { ok: false, error: 'Design analysis did not return valid JSON.' }
  }

  return { ok: true, analysis: parsed, brief: formatBriefText(parsed, sector) }
}

export async function ensureDesignRecreationBrief(
  userId: string,
  session: HubStudioSession
): Promise<{ session: HubStudioSession; error?: string }> {
  if (session.presetId !== 'design_recreate') return { session }

  const existing = session.designRecreate?.recreationBrief?.trim()
  if (existing) return { session }

  const uploadUrls = session.uploadImages.slice(0, DESIGN_RECREATE_MAX_UPLOAD)
  if (!uploadUrls.length) return { session }

  const sector = resolveDesignSector(session.briefNotes)
  const analyzed = await analyzeDesignRecreationSamples(userId, uploadUrls, sector)
  if (!analyzed.ok) return { session, error: analyzed.error }

  return {
    session: {
      ...session,
      designRecreate: {
        ...(session.designRecreate ?? {}),
        recreationBrief: analyzed.brief,
        briefSource: 'sample_images',
        analyzedAt: Date.now(),
        sampleUrls: uploadUrls,
      },
    },
  }
}

export function designRecreateUploadReply(
  locale: WebLocale,
  kind: 'analyzed' | 'max' | 'need_image' | 'confirmed'
): string {
  const copy: Record<WebLocale, Record<'analyzed' | 'max' | 'need_image' | 'confirmed', string>> = {
    vi: {
      analyzed: ' AI đã phân tích mẫu — có thể tải thêm (tối đa 4) hoặc bấm Tiếp.',
      max: `Tối đa ${DESIGN_RECREATE_MAX_UPLOAD} ảnh mẫu.`,
      need_image: 'Vui lòng tải ít nhất 1 ảnh mẫu trước khi tiếp tục.',
      confirmed: 'Đã nhận ảnh mẫu.',
    },
    en: {
      analyzed: ' AI analyzed the sample — upload more (max 4) or tap Continue.',
      max: `Maximum ${DESIGN_RECREATE_MAX_UPLOAD} sample photos.`,
      need_image: 'Please upload at least 1 sample photo before continuing.',
      confirmed: 'Sample photos received.',
    },
    zh: {
      analyzed: ' AI 已分析样品 — 可继续上传（最多4张）或点「继续」。',
      max: `最多 ${DESIGN_RECREATE_MAX_UPLOAD} 张样品图。`,
      need_image: '请先上传至少 1 张样品图再继续。',
      confirmed: '已收到样品图。',
    },
    ja: {
      analyzed: ' AIがサンプルを分析しました — 追加アップロード（最大4枚）か「続ける」を押してください。',
      max: `サンプル画像は最大 ${DESIGN_RECREATE_MAX_UPLOAD} 枚です。`,
      need_image: '続ける前にサンプル画像を1枚以上アップロードしてください。',
      confirmed: 'サンプル画像を受け取りました。',
    },
    ko: {
      analyzed: ' AI가 샘플을 분석했습니다 — 추가 업로드(최대 4장)하거나 계속을 누르세요.',
      max: `샘플 사진은 최대 ${DESIGN_RECREATE_MAX_UPLOAD}장입니다.`,
      need_image: '계속하려면 샘플 사진을 1장 이상 업로드하세요.',
      confirmed: '샘플 사진을 받았습니다.',
    },
  }
  return copy[locale][kind]
}

export function appendDesignRecreateGeneratePrompt(
  fullPrompt: string,
  session: HubStudioSession,
  stepKey: string
): string {
  if (session.presetId !== 'design_recreate') return fullPrompt

  const sector = resolveDesignSector(session.briefNotes)
  const format = resolveDesignFormat(session.briefNotes, sector)
  const renderStyle = resolveDesignRenderStyle(session.briefNotes, sector)
  let prompt = fullPrompt
  const brief = session.designRecreate?.recreationBrief?.trim()
  if (brief) {
    prompt += `\n\n${formatDesignRecreationBriefBlock(brief)}`
  }
  prompt += `\n\n${buildDesignStepPromptBlock(sector, format, renderStyle, stepKey)}`

  const notes = session.briefNotes.design_notes?.trim()
  if (notes) {
    prompt += `\n\nAdditional client notes: ${notes}`
  }
  const palette = session.briefNotes.color_palette?.trim()
  if (palette) {
    prompt += `\n\nClient color preference (override if specified): ${palette}`
  }

  prompt +=
    '\n\nIMPORTANT — PRODUCT SAMPLE REFERENCE: Attached photo(s) show the source product from multiple angles. Recreate the design language (silhouette, colors, materials, details) in the requested output format. Do NOT copy brand logos, trademarks, or readable text from samples.'

  prompt += `\n\n${buildDesignBoardLanguagePromptBlock(session.briefNotes)}`

  if (stepKey !== DESIGN_RECREATE_LOGO_KEY) {
    prompt +=
      '\n\nALWAYS INCLUDE a design inspiration text block on the artwork (heading + 2–4 sentences). Prefer using mood/concept from the recreation brief Inspiration section when available. Match the board language. Never omit this text.'
    prompt +=
      '\n\nBOARD TITLE RULE: Under the logo, print a real product design name inferred from the sample photos (e.g. "Áo măng tô", "Áo khoác", "Blazer nữ", "Trench coat") — never the placeholder words "Tiêu đề" / "Title".'
  }

  const hasClientLogo = session.referenceImages.some((ref) => ref.screenKey === DESIGN_RECREATE_LOGO_KEY)
  if (hasClientLogo && stepKey !== DESIGN_RECREATE_LOGO_KEY) {
    prompt +=
      '\n\nIMPORTANT — CLIENT LOGO COMPOSITE: An approved CLIENT LOGO image is attached. Embed the exact logo pixels on the design board (typically title/header area or brand mark corner). Do NOT redraw, re-typeset, or invent a different mark. Do NOT use any logo/text from the product sample photos — only the attached client logo.'
  }

  return prompt
}
