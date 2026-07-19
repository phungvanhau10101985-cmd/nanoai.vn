import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { loadImageBufferFromUrl } from '@/lib/hub-agent/sharpen-pipeline'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { UI_MOCKUP_CREDIT } from '@/lib/hub-chat/hub-studio-types'
import type { StudioGeneratorKind } from '@/lib/hub-chat/hub-studio-presets'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { stripPackagingFaceTechnicalMeasurementsFromVisualPrompt } from '@/lib/packaging/face-print-prompt'
import { normalizePanelArtworkToPrintSize } from '@/lib/packaging/panel-artwork-fit'

const toTenths = (value: number) => Math.round(value * 10)

export type StudioImageResult =
  | { ok: true; resultUrl: string; charged: number }
  | { ok: false; error: string }

type PromptSpec = { prompt: string; aspectRatio: string; imageSize: '2K' | '4K' }

async function buildPromptSpec(
  kind: StudioGeneratorKind,
  screenLabel: string,
  brief: string,
  projectTitle?: string,
  hasRefs?: boolean,
  hasProduct?: boolean,
  aspectRatioOverride?: string,
  screenKey?: string
): Promise<PromptSpec> {
  const briefEn = await normalizeToEnglish(brief)
  const labelEn = await normalizeToEnglish(screenLabel)
  const projectEn = projectTitle ? await normalizeToEnglish(projectTitle) : 'creative project'

  const styleNote = hasRefs
    ? 'Match visual style, colors, typography and component language of attached reference image(s).'
    : 'Professional, modern, polished design quality.'

  const isFlatBoxDieline =
    screenKey === 'box_flat' ||
    /\b(dieline|flat box|hop phang|hộp phẳng|box flat|unfolded)\b/i.test(labelEn) ||
    /\b(dieline|flat box|hop phang|hộp phẳng|box flat|unfolded)\b/i.test(briefEn)

  switch (kind) {
    case 'logo':
      return {
        aspectRatio: '1:1',
        imageSize: '2K',
        prompt: `Design a professional LOGO mark for: ${projectEn}.
Brief: ${briefEn}
${styleNote}
Clean vector-like logo on simple background. One logo only, no mockup scene, no extra text borders.`,
      }
    case 'banner':
      return {
        aspectRatio: aspectRatioOverride || (labelEn.toLowerCase().includes('story') || labelEn.includes('9:16') ? '9:16' : '16:9'),
        imageSize: '2K',
        prompt: `Design a marketing BANNER / poster for: ${projectEn} — ${labelEn}.
Brief: ${briefEn}
${styleNote}
Bold typography, clear CTA area, ecommerce/ad quality. Return one finished banner image only.`,
      }
    case 'product_photo':
      return {
        aspectRatio: '1:1',
        imageSize: '2K',
        prompt: `E-commerce PRODUCT photo edit/generation for: ${labelEn}.
Brief: ${briefEn}
${hasProduct ? 'Use the attached product photo as the main subject. ' : ''}${styleNote}
Clean catalog-quality output suitable for Shopee/Lazada/TikTok Shop.`,
      }
    case 'invitation':
      return {
        aspectRatio: '9:16',
        imageSize: '2K',
        prompt: `Design an elegant INVITATION card (vertical) for: ${projectEn} — ${labelEn}.
Brief: ${briefEn}
${styleNote}
Wedding/event invitation aesthetic with decorative typography placeholders.`,
      }
    case 'ui_mockup':
      return {
        aspectRatio: aspectRatioOverride || '9:16',
        imageSize: '2K',
        prompt: `Design a high-fidelity MOBILE APP UI mockup (portrait).
Project: ${projectEn}
Screen: ${labelEn}
Requirements: ${briefEn}
${styleNote}
Realistic mobile UI with status bar, nav, cards, buttons.`,
      }
    case 'ui_desktop':
      return {
        aspectRatio: aspectRatioOverride || '16:9',
        imageSize: '2K',
        prompt: `Design a high-fidelity DESKTOP WEB UI mockup (landscape browser).
Project: ${projectEn}
Screen: ${labelEn}
Requirements: ${briefEn}
${styleNote}
Realistic desktop web layout with header, content area, footer.`,
      }
    case 'packaging':
      return {
        aspectRatio: aspectRatioOverride || '1:1',
        imageSize: '2K',
        prompt: screenKey === 'product_label'
          ? `OUTPUT: ONE FLAT, PRINT-READY PRODUCT LABEL ARTBOARD ONLY — straight-on, edge-to-edge, with no surrounding scene.
Design a peel-and-stick PRODUCT LABEL for: ${projectEn}.
Brief: ${briefEn}
${styleNote}
CRITICAL: This is a product label on jar/bottle/tube — NOT a box dieline, NOT unfolded carton, NOT 3D box mockup.
Black-and-white or minimal 2-color print layout unless user requests color.
Typography must be razor-sharp, high-contrast, crisp vector-like — no blur, no glow, no soft shadows on text.
Composite ONLY the attached LOGO. Readable legal/product text per brief. Keep text safely inset while artwork reaches every edge.
FORBIDDEN: physical product, grey studio background, frame, padding, drop shadow, dimensions, size numbers, mm/cm labels, rulers, measurement arrows, red boxes, cut/fold lines, crop marks, bleed guides, or safe-zone guides.`
          : screenKey === 'seal_sticker'
            ? `OUTPUT: ONE FLAT, PRINT-READY TAMPER-EVIDENT SEAL STICKER ARTBOARD ONLY — straight-on, with no surrounding scene.
Design the seal sticker for: ${projectEn}.
Brief: ${briefEn}
${styleNote}
CRITICAL: Round/square/oval seal sticker to seal packaging — NOT a box dieline, NOT unfolded carton, NOT 3D box.
Typography must be razor-sharp, high-contrast, crisp vector-like — no blur, no glow, no soft shadows on text.
Composite ONLY the attached LOGO plus short slogan/text per brief.
FORBIDDEN: physical package, studio background, frame, padding, drop shadow, dimensions, size numbers, mm/cm labels, rulers, measurement arrows, red boxes, cut/fold lines, crop marks, bleed guides, or safe-zone guides.`
            : isFlatBoxDieline
          ? `Design a print-ready FLAT BOX DIELINE (unfolded carton net) for: ${projectEn}.
Brief: ${briefEn}
${styleNote}
CRITICAL LAYOUT RULES:
- Show the full tuck-top box net with correct panel proportions from the brief (Length × Width × Height).
- Each panel must keep its true aspect ratio: main faces L×H, side wings W×H, top/bottom flaps L×W.
- Red solid lines = cut, magenta/pink dashed lines = fold/crease.
- DO NOT add any dimension labels, measurement text, size numbers, or mm annotations anywhere. Dimension lines are added separately by the system.
- Fill panels with brand artwork only. Keep registration marks and color bars minimal at sheet edge if needed.
One finished flat dieline artwork only.`
          : `Design PACKAGING / print-ready label or box art for: ${projectEn} — ${labelEn}.
Brief: ${briefEn}
${styleNote}
Include brand logo placement, dieline-friendly layout, print quality. One finished packaging design only.`,
      }
    case 'packaging_face': {
      const faceRole =
        screenKey === 'face_top' || screenKey === 'face_lxw'
          ? 'L×W TOP print face'
          : screenKey === 'face_bottom'
            ? 'L×W BOTTOM print face'
            : screenKey === 'face_front' || screenKey === 'face_lxh'
              ? 'L×H FRONT print face'
              : screenKey === 'face_back'
                ? 'L×H BACK print face'
                : screenKey === 'face_right' || screenKey === 'face_wxh'
                  ? 'W×H RIGHT SIDE print face'
                  : screenKey === 'face_left'
                    ? 'W×H LEFT SIDE print face'
                    : 'packaging print face'
      const refNote = hasRefs
        ? 'Use attached reference image(s) as flat print elements — embed logo, brand marks and approved 2D artwork directly ON this single flat panel (not as a 3D object on a scene). '
        : 'Professional packaging print quality. '
      const productNote = hasProduct
        ? 'Flatten attached PRODUCT photo(s) into 2D printed graphics on this panel per FACE PRINT STYLE in brief — NOT a separate 3D product render standing on cardboard. '
        : ''
      return {
        aspectRatio: aspectRatioOverride || '1:1',
        imageSize: '2K',
        prompt: stripPackagingFaceTechnicalMeasurementsFromVisualPrompt(
          `${briefEn}

Design ONE flat full-bleed print artwork for the ${faceRole} of: ${projectEn}.
${refNote}${productNote}
Fill 100% of the API image canvas edge-to-edge — no margins, letterboxing, dimension lines, rulers, or guide overlays.`
        ),
      }
    }
    case 'packaging_mockup':
      return {
        aspectRatio: aspectRatioOverride || '1:1',
        imageSize: '2K',
        prompt: `Create a photorealistic 3D carton box mockup for: ${projectEn}.
${briefEn}
Apply each attached flat face artwork ONLY on its mapped box face (see mapping in brief). Never use a standalone logo attachment — logo is already inside face prints when needed.
Do not redesign, replace, mirror or distort the approved face artwork.
One finished 3D product mockup only.`,
      }
    case 'interior':
      return {
        aspectRatio: aspectRatioOverride || '16:9',
        imageSize: '2K',
        prompt: `Photorealistic INTERIOR / ARCHITECTURAL render for: ${projectEn} — ${labelEn}.
Brief: ${briefEn}
${hasProduct ? 'Use attached floor plan or room photo as spatial reference. ' : ''}${styleNote}
Professional interior design visualization, consistent materials and lighting across the home.`,
      }
    case 'story_panel':
      return {
        aspectRatio: aspectRatioOverride || '16:9',
        imageSize: '2K',
        prompt: `Illustrated STORY / picture-book panel for: ${projectEn} — ${labelEn}.
Brief: ${briefEn}
${styleNote}
Keep character design, line work and palette consistent across pages. One story panel illustration only.`,
      }
    case 'infographic':
      return {
        aspectRatio: aspectRatioOverride || '16:9',
        imageSize: '2K',
        prompt: `Design an INFOGRAPHIC slide for: ${projectEn} — ${labelEn}.
Brief: ${briefEn}
${hasProduct ? 'Use attached source document/pages as content reference. ' : ''}${styleNote}
Clear hierarchy, icons, readable typography placeholders, cohesive slide deck style.`,
      }
    case 'portrait':
      return {
        aspectRatio: aspectRatioOverride || '3:4',
        imageSize: '2K',
        prompt: `Professional PORTRAIT / ID photo for: ${labelEn}.
Brief: ${briefEn}
${hasProduct ? 'Use the attached person photo — preserve facial identity. ' : ''}${styleNote}
Studio-quality headshot suitable for ID, LinkedIn or professional profile.`,
      }
    default:
      return {
        aspectRatio: aspectRatioOverride || '9:16',
        imageSize: '2K',
        prompt: `Design a high-fidelity MOBILE APP UI mockup (portrait).
Project: ${projectEn}
Screen: ${labelEn}
Requirements: ${briefEn}
${styleNote}
Realistic mobile UI with status bar, nav, cards, buttons.`,
      }
  }
}

export async function runStudioImagePipeline(input: {
  userId: string
  kind: StudioGeneratorKind
  screenLabel: string
  screenKey?: string
  brief: string
  projectTitle?: string
  referenceImageUrls?: string[]
  referenceImageMeta?: Array<{ screenKey: string; label?: string }>
  productImageUrls?: string[]
  aspectRatio?: string
  /** Exact trim size — normalizes generated image to print pixels before upload. */
  printSizeMm?: { widthMm: number; heightMm: number }
}): Promise<StudioImageResult> {
  const refUrls = input.referenceImageUrls ?? []
  const productUrls = input.productImageUrls ?? []
  const hasProduct = productUrls.length > 0
  const spec = await buildPromptSpec(
    input.kind,
    input.screenLabel,
    input.brief,
    input.projectTitle,
    refUrls.length > 0 || productUrls.length > 0,
    hasProduct,
    input.aspectRatio,
    input.screenKey
  )

  let balance = 0
  try {
    balance = await getCreditBalanceByUserId(input.userId)
  } catch {
    return { ok: false, error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(balance) < toTenths(UI_MOCKUP_CREDIT)) {
    return { ok: false, error: `Không đủ credits (cần ${UI_MOCKUP_CREDIT}).` }
  }

  const { apiKey } = await requireGoogleApiKeyForUser(input.userId)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: spec.imageSize, aspectRatio: spec.aspectRatio },
    },
  })

  const parts: object[] = [{ text: spec.prompt }]
  const primaryFaceKey = 'face_top'
  for (let i = 0; i < refUrls.length; i++) {
    const url = refUrls[i]!
    const meta = input.referenceImageMeta?.[i]
    const isLogoRef = meta?.screenKey === 'logo'
    const isStyleReference =
      meta?.screenKey === 'packaging_style_reference' &&
      input.kind === 'packaging_face' &&
      input.screenKey === 'face_top'
    const isPrimaryFaceStyleRef =
      meta?.screenKey === primaryFaceKey &&
      input.kind === 'packaging_face' &&
      input.screenKey &&
      input.screenKey !== primaryFaceKey
    const isFlatLabelStep =
      input.kind === 'packaging' &&
      (input.screenKey === 'product_label' || input.screenKey === 'seal_sticker')
    let caption: string
    if (isPrimaryFaceStyleRef) {
      caption = `PRIMARY FACE #1 style anchor (${meta?.label ?? 'face_top'}) — match colors, illustration treatment, typography style, and material feel EXACTLY; do NOT copy layout or print text from this image:`
    } else if (isStyleReference) {
      caption = `STYLE REFERENCE image — combine with all style direction text; match colors, treatment, and mood; do NOT copy logos, trademarks, or 3D product scenes:`
    } else if (isLogoRef && isFlatLabelStep) {
      caption = `Approved LOGO — composite onto this flat label artwork only; do NOT redraw or re-typeset the logo:`
    } else if (isLogoRef && input.kind === 'packaging_face') {
      caption = `Approved LOGO — composite onto this flat print panel only; do NOT redraw the logo:`
    } else if (input.kind === 'packaging_face') {
      caption = `Approved reference image ${i + 1} — embed as flat 2D print on the full-bleed panel edge-to-edge; NEVER as a 3D box on grey studio background:`
    } else {
      caption = `Approved reference image ${i + 1} — composite logo/brand/approved face artwork onto the flat print panel:`
    }
    parts.push({ text: caption })
    const loaded = await loadImageBufferFromUrl(url)
    if (loaded) {
      parts.push({
        inlineData: { data: loaded.buffer.toString('base64'), mimeType: loaded.mimeType || 'image/png' },
      })
    }
  }
  for (let i = 0; i < productUrls.length; i++) {
    const url = productUrls[i]!
    parts.push({
      text: `Product photo ${i + 1} — flatten this product cutout onto the flat print panel (not a 3D scene):`,
    })
    const loaded = await loadImageBufferFromUrl(url)
    if (loaded) {
      parts.push({
        inlineData: { data: loaded.buffer.toString('base64'), mimeType: loaded.mimeType || 'image/png' },
      })
    }
  }

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent(parts as never, { safetySettings } as never)
    trackFromUsageMetadata(
      result.response.usageMetadata,
      GEMINI_3_PRO_IMAGE.model,
      `hub-studio-${input.kind}`,
      input.userId,
      spec.imageSize
    )
    const imagePartRes = result.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      return { ok: false, error: 'AI không trả về ảnh.' }
    }
    const resultBufferRaw = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    // Box faces must match exact print trim px for dieline composite. Product labels / seal stickers
    // keep native 2K AI output (same as /tao-nhan-gioi-thieu-san-pham) — resizing to mm@300dpi shrinks file and blurs text.
    const shouldNormalizeToPrintSize =
      input.kind === 'packaging_face' && Boolean(input.printSizeMm)
    const resultBuffer = shouldNormalizeToPrintSize
      ? await normalizePanelArtworkToPrintSize(
          resultBufferRaw,
          input.printSizeMm!.widthMm,
          input.printSizeMm!.heightMm
        )
      : resultBufferRaw
    const resultPath = `results/${input.userId}/studio_${input.kind}_${Date.now()}.png`
    const { publicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })
    const d = await deductUserCredits(input.userId, UI_MOCKUP_CREDIT)
    if (!d.ok) return { ok: false, error: d.error || 'Không thể trừ credits.' }
    return { ok: true, resultUrl: publicUrl, charged: UI_MOCKUP_CREDIT }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

export async function uploadStudioImages(
  userId: string,
  files: { buffer: Buffer; mimeType: string }[]
): Promise<string[]> {
  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!
    const path = `uploads/${userId}/studio_upload_${Date.now()}_${i}.png`
    const { publicUrl } = await uploadTryOnImagePublic(path, f.buffer, { contentType: f.mimeType || 'image/png' })
    urls.push(publicUrl)
  }
  return urls
}
