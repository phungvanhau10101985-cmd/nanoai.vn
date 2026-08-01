import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { loadImageBufferFromUrl } from '@/lib/hub-agent/sharpen-pipeline'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  FACE_PRINT_STYLE_STEP_KEY,
  facePrintStylePromptBlock,
  resolveFacePrintStyle,
} from '@/lib/packaging/face-print-style'
import {
  findPackagingStyleMoodChoice,
  findPackagingColorPaletteChoice,
} from '@/lib/packaging/packaging-discovery-choices'
import { buildPackagingPrintLanguagePromptBlock } from '@/lib/packaging/packaging-print-language'

export const PACKAGING_STYLE_DISCOVERY_KEYS = [
  'style_mood',
  'color_palette',
  FACE_PRINT_STYLE_STEP_KEY,
] as const

export type PackagingStyleBriefSource = 'discovery' | 'reference_image'

export type PackagingStyleBriefAnalysis = {
  colorPalette: {
    primary: string[]
    secondary: string[]
    accent: string[]
    background: string
    notes: string
  }
  visualStyle: {
    treatment: string
    lineWeight: string
    texture: string
    illustrationType: string
  }
  layout: {
    composition: string
    density: string
    hierarchy: string
    whitespace: string
  }
  typography: {
    style: string
    weight: string
    case: string
    notes: string
  }
  mood: string
  materialFeel: string
  doNotCopy: string[]
  styleBriefEn: string
}

const STYLE_ANALYSIS_SYS = `You are a packaging design analyst. The user attached a REFERENCE IMAGE (competitor box, product photo, or mood board). Extract ONLY visual design language — do NOT identify brands, products, or text to copy.

Return JSON only with this shape:
{
  "colorPalette": {
    "primary": ["#hex or precise color name"],
    "secondary": ["..."],
    "accent": ["..."],
    "background": "...",
    "notes": "warm/cool, saturated/muted, contrast level"
  },
  "visualStyle": {
    "treatment": "flat illustration | line art | realistic photo | watercolor | minimal typography | pattern-heavy | ...",
    "lineWeight": "thin | medium | bold | none",
    "texture": "smooth | grain | kraft | matte | glossy | ...",
    "illustrationType": "photorealistic product | hand-drawn | geometric | organic shapes | ..."
  },
  "layout": {
    "composition": "centered hero | band layout | full-bleed pattern | asymmetric | grid | ...",
    "density": "minimal | balanced | busy",
    "hierarchy": "logo-dominant | product-dominant | typography-dominant | pattern-dominant",
    "whitespace": "generous | moderate | tight"
  },
  "typography": {
    "style": "serif | sans-serif | script | mixed | no visible text",
    "weight": "light | regular | bold | mixed",
    "case": "uppercase | lowercase | mixed",
    "notes": "modern | classic | playful | elegant | ..."
  },
  "mood": "organic | luxury | minimal | playful | artisanal | clinical | premium | eco | ...",
  "materialFeel": "matte cardboard | glossy | kraft brown | white bleached | metallic foil hint | ...",
  "doNotCopy": [
    "exact product shape",
    "brand logos or trademarks",
    "readable text or slogans from reference",
    "3D box perspective or studio background"
  ],
  "styleBriefEn": "2-4 sentences in English: concise art direction for a FLAT 2D packaging print panel inspired by this reference. Describe colors, style treatment, layout mood, and typography feel ONLY."
}

Rules:
- Describe what you SEE, not what you guess about the brand.
- colorPalette.primary must have at least 2 entries with hex or precise color names.
- styleBriefEn must be usable directly as prompt input for flat print artwork generation.
- If reference is a 3D product photo, extract style/mood/colors only.
- Never transcribe logos, product names, or marketing copy from the image.`

function parseStyleAnalysisJson(text: string): PackagingStyleBriefAnalysis | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced || trimmed
  try {
    const parsed = JSON.parse(candidate) as PackagingStyleBriefAnalysis
    if (!parsed?.styleBriefEn?.trim()) return null
    return parsed
  } catch {
    return null
  }
}

export function formatPackagingStyleBriefBlock(
  brief: string,
  source?: PackagingStyleBriefSource,
  options?: { matchPrimaryFaceArtwork?: boolean }
): string {
  const lead =
    source === 'reference_image'
      ? 'PACKAGING STYLE DIRECTION (from user reference image analysis — inspiration only, do NOT copy subject, logos, or 3D scenes):'
      : 'PACKAGING STYLE DIRECTION (from brand discovery — apply consistently to this flat print panel and all 6 faces):'
  const primaryFaceNote = options?.matchPrimaryFaceArtwork
    ? '\nAlso match colors, illustration treatment, typography style, and material feel EXACTLY from the attached PRIMARY FACE #1 reference image together with this text. Do NOT copy face #1 layout or print text.'
    : ''
  return `${lead}
${brief.trim()}${primaryFaceNote}

Match this visual language for colors, illustration treatment, typography feel, and layout mood.
Generate NEW flat 2D print artwork for THIS face — keep all 6 faces visually unified, never invent a new palette per face.`
}

export function buildPackagingColorPaletteBriefFromDiscovery(
  briefNotes: Record<string, string>
): string {
  const paletteRaw = briefNotes.color_palette?.trim() ?? ''
  if (paletteRaw.includes('#')) {
    return `Color palette: ${paletteRaw}`
  }
  const paletteChoice = findPackagingColorPaletteChoice(paletteRaw)
  const paletteLine = paletteChoice?.brief.en ?? paletteRaw
  return paletteLine ? `Color palette: ${paletteLine}` : ''
}

export function extractColorPaletteFromPackagingStyleBrief(brief: string): string {
  const line = brief
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^Color palette:/i.test(l))
  return line ?? ''
}

/** Color-only text for generation when reference image(s) override discovery print style / mood. */
export function resolvePackagingColorPaletteBrief(session: HubStudioSession): string {
  const fromDiscovery = buildPackagingColorPaletteBriefFromDiscovery(session.briefNotes)
  if (fromDiscovery.trim()) return fromDiscovery

  const stored = session.packaging?.packagingStyleBrief?.trim() ?? ''
  if (!stored) return ''

  const paletteLine = extractColorPaletteFromPackagingStyleBrief(stored)
  if (paletteLine) return paletteLine

  const colorLines = stored
    .split('\n')
    .map((l) => l.trim())
    .filter((l) =>
      /^(Primary colors|Secondary|Accent|Background|Color notes):/i.test(l)
    )
  return colorLines.length ? colorLines.join('\n') : ''
}

export function formatPackagingColorPaletteBlock(
  paletteBrief: string,
  options?: {
    referenceImagePriority?: 'product' | 'primary_face'
    matchPrimaryFaceArtwork?: boolean
  }
): string {
  const priorityNote =
    options?.referenceImagePriority === 'product'
      ? 'Attached PRODUCT photo(s) define visual art style and print treatment — IGNORE pre-selected print style, mood, or illustration type from discovery.'
      : options?.referenceImagePriority === 'primary_face'
        ? 'Attached PRIMARY FACE #1 image defines visual art style — IGNORE pre-selected print style or mood text.'
        : ''
  const faceNote = options?.matchPrimaryFaceArtwork
    ? '\nTune colors to match PRIMARY FACE #1 artwork together with this palette.'
    : ''
  return `COLOR PALETTE (apply these colors; reference image(s) define art style):
${paletteBrief.trim()}${faceNote}
${priorityNote}
Priority order: reference image(s) first, then this color palette — never invent a new palette per face.`.trim()
}

/** Face #1: logo + product images only; style text from brand discovery steps. */
export function appendPackagingFaceOneStylePrompt(
  fullPrompt: string,
  session: HubStudioSession
): string {
  const discoveryStyle = buildPackagingStyleBriefFromDiscovery(session.briefNotes)
  let prompt = fullPrompt
  if (discoveryStyle) {
    prompt += `\n\n${formatPackagingStyleBriefBlock(discoveryStyle, 'discovery')}`
  } else {
    prompt += `\n\n${facePrintStylePromptBlock(resolveFacePrintStyle(session.briefNotes))}`
  }
  prompt += `\n\nFACE #1 — composite attached LOGO and product photo(s) onto this flat print panel. Visual style, colors, and print treatment come ONLY from PACKAGING STYLE DIRECTION above (brand discovery). Do not use a separate style reference image.`
  return prompt
}

export function buildPackagingStyleBriefFromDiscovery(
  briefNotes: Record<string, string>
): string {
  const moodRaw = briefNotes.style_mood?.trim() ?? ''
  const paletteRaw = briefNotes.color_palette?.trim() ?? ''
  const printStyleKey = resolveFacePrintStyle(briefNotes)
  const moodChoice = findPackagingStyleMoodChoice(moodRaw)
  const paletteChoice = findPackagingColorPaletteChoice(paletteRaw)
  const moodLine = moodChoice?.brief.en ?? moodRaw
  const paletteLine = paletteRaw.includes('#')
    ? paletteRaw
    : paletteChoice?.brief.en ?? paletteRaw
  const styleBlock = facePrintStylePromptBlock(printStyleKey)
    .replace(/^VISUAL ART STYLE — /m, '')
    .trim()
  const parts = [
    moodLine ? `Mood: ${moodLine}` : '',
    paletteLine ? `Color palette: ${paletteLine}` : '',
    styleBlock ? `Print treatment: ${styleBlock}` : '',
  ].filter(Boolean)
  return parts.join('\n')
}

export function appendPackagingPrintLanguagePrompt(
  fullPrompt: string,
  briefNotes: Record<string, string>
): string {
  const block = buildPackagingPrintLanguagePromptBlock(briefNotes)
  if (!block.trim()) return fullPrompt
  return `${fullPrompt}\n\n${block}`
}

export async function analyzePackagingStyleReferenceImage(
  userId: string,
  imageUrl: string
): Promise<{ ok: true; analysis: PackagingStyleBriefAnalysis; brief: string } | { ok: false; error: string }> {
  const loaded = await loadImageBufferFromUrl(imageUrl)
  if (!loaded) {
    return { ok: false, error: 'Unable to load style reference image.' }
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
      maxOutputTokens: 1800,
      responseMimeType: 'application/json',
    },
  })

  const result = await model.generateContent([
    { text: STYLE_ANALYSIS_SYS },
    {
      inlineData: {
        data: loaded.buffer.toString('base64'),
        mimeType: loaded.mimeType || 'image/png',
      },
    },
    { text: 'Analyze the attached reference image and return JSON only.' },
  ])

  await trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_25_FLASH_NO_THINKING.model,
    'hub-studio-packaging-style-analysis',
    userId
  )

  const parsed = parseStyleAnalysisJson(result.response.text()?.trim() ?? '')
  if (!parsed) {
    return { ok: false, error: 'Style analysis did not return valid JSON.' }
  }

  const paletteBits = [
    parsed.colorPalette.primary?.length
      ? `Primary colors: ${parsed.colorPalette.primary.join(', ')}`
      : '',
    parsed.colorPalette.secondary?.length
      ? `Secondary: ${parsed.colorPalette.secondary.join(', ')}`
      : '',
    parsed.colorPalette.accent?.length ? `Accent: ${parsed.colorPalette.accent.join(', ')}` : '',
    parsed.colorPalette.background ? `Background: ${parsed.colorPalette.background}` : '',
    parsed.colorPalette.notes ? `Color notes: ${parsed.colorPalette.notes}` : '',
  ].filter(Boolean)

  const brief = [
    parsed.styleBriefEn.trim(),
    paletteBits.length ? `\n${paletteBits.join('\n')}` : '',
    parsed.visualStyle?.treatment ? `\nVisual treatment: ${parsed.visualStyle.treatment}` : '',
    parsed.layout?.composition ? `\nLayout: ${parsed.layout.composition}` : '',
    parsed.typography?.style ? `\nTypography: ${parsed.typography.style}` : '',
    parsed.mood ? `\nMood: ${parsed.mood}` : '',
    parsed.materialFeel ? `\nMaterial feel: ${parsed.materialFeel}` : '',
    parsed.doNotCopy?.length
      ? `\nDo NOT copy from reference: ${parsed.doNotCopy.join('; ')}`
      : '',
  ]
    .join('')
    .trim()

  return { ok: true, analysis: parsed, brief }
}

export function packagingStyleDiscoveryExcludeKeys(
  session: HubStudioSession
): string[] {
  if (!session.packaging?.packagingStyleBrief?.trim()) return []
  return [...PACKAGING_STYLE_DISCOVERY_KEYS]
}

export async function ensurePackagingStyleBrief(
  userId: string,
  session: HubStudioSession
): Promise<{ session: HubStudioSession; error?: string }> {
  if (session.presetId !== 'packaging_kit' && session.presetId !== 'bag_kit') return { session }
  const existing =
    session.presetId === 'bag_kit'
      ? session.bagKit?.packagingStyleBrief?.trim()
      : session.packaging?.packagingStyleBrief?.trim()
  if (existing) return { session }

  const styleRefUrl =
    session.generationSelection?.styleReferenceUrl?.trim() ||
    session.packaging?.styleReferenceUrl?.trim() ||
    session.bagKit?.styleReferenceUrl?.trim() ||
    ''

  if (styleRefUrl) {
    const analyzed = await analyzePackagingStyleReferenceImage(userId, styleRefUrl)
    if (!analyzed.ok) return { session, error: analyzed.error }
    if (session.presetId === 'bag_kit') {
      return {
        session: {
          ...session,
          bagKit: {
            ...(session.bagKit ?? { version: 1 as const, dimensionsMm: null }),
            packagingStyleBrief: analyzed.brief,
            packagingStyleBriefSource: 'reference_image',
            styleReferenceUrl: styleRefUrl,
          },
        },
      }
    }
    return {
      session: {
        ...session,
        packaging: {
          ...(session.packaging ?? {
            version: 2 as const,
            dimensionsMm: null,
            faces: {},
          }),
          packagingStyleBrief: analyzed.brief,
          packagingStyleBriefSource: 'reference_image',
          styleReferenceUrl: styleRefUrl,
        },
      },
    }
  }

  const fromDiscovery = buildPackagingStyleBriefFromDiscovery(session.briefNotes)
  if (!fromDiscovery.trim()) return { session }

  if (session.presetId === 'bag_kit') {
    return {
      session: {
        ...session,
        bagKit: {
          ...(session.bagKit ?? { version: 1 as const, dimensionsMm: null }),
          packagingStyleBrief: fromDiscovery,
          packagingStyleBriefSource: 'discovery',
        },
      },
    }
  }

  return {
    session: {
      ...session,
      packaging: {
        ...(session.packaging ?? {
          version: 2 as const,
          dimensionsMm: null,
          faces: {},
        }),
        packagingStyleBrief: fromDiscovery,
        packagingStyleBriefSource: 'discovery',
      },
    },
  }
}

export function applyPackagingStyleBriefToSession(
  session: HubStudioSession,
  brief: string,
  source: PackagingStyleBriefSource,
  styleReferenceUrl?: string | null
): HubStudioSession {
  return {
    ...session,
    packaging: {
      ...(session.packaging ?? {
        version: 2 as const,
        dimensionsMm: null,
        faces: {},
      }),
      packagingStyleBrief: brief,
      packagingStyleBriefSource: source,
      styleReferenceUrl: styleReferenceUrl ?? session.packaging?.styleReferenceUrl,
    },
  }
}

export function clearPackagingStyleBriefFromReference(session: HubStudioSession): HubStudioSession {
  const nextPackaging = { ...(session.packaging ?? { version: 2 as const, dimensionsMm: null, faces: {} }) }
  delete nextPackaging.packagingStyleBrief
  delete nextPackaging.packagingStyleBriefSource
  delete nextPackaging.styleReferenceUrl
  return {
    ...session,
    packaging: nextPackaging,
    generationSelection: session.generationSelection
      ? { ...session.generationSelection, styleReferenceUrl: null }
      : session.generationSelection,
  }
}
