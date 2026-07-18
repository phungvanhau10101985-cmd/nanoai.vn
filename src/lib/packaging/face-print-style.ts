import type { WebLocale } from '@/lib/i18n/config'
import type { HubStudioMessagePayload, HubStudioProcessStep, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { buildStepsFromPreset } from '@/lib/hub-chat/hub-studio-presets'
import {
  isPackagingFaceStepKey,
  syncResolvedPackagingFaces,
} from '@/lib/packaging/hub-face-steps'

export const FACE_PRINT_STYLE_STEP_KEY = 'face_print_style'

export type FacePrintStyleKey =
  | 'realistic_photography'
  | 'line_art'
  | 'flat_illustration'
  | 'watercolour_abstract'

export const FACE_PRINT_STYLE_KEYS: FacePrintStyleKey[] = [
  'realistic_photography',
  'line_art',
  'flat_illustration',
  'watercolour_abstract',
]

export const DEFAULT_FACE_PRINT_STYLE: FacePrintStyleKey = 'flat_illustration'

export function isFacePrintStyleKey(value: string): value is FacePrintStyleKey {
  return FACE_PRINT_STYLE_KEYS.includes(value as FacePrintStyleKey)
}

/** Parse stored brief value or button payload. */
export function parseFacePrintStyleKey(raw: string | undefined | null): FacePrintStyleKey | null {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null
  if (isFacePrintStyleKey(trimmed)) return trimmed
  const lower = trimmed.toLowerCase()
  if (isFacePrintStyleKey(lower)) return lower
  if (/realistic|photograph|ảnh chụp|ảnh thật|photoreal|写实|写真|실사/i.test(trimmed)) return 'realistic_photography'
  if (/line.?art|sketch|nét vẽ|đơn sắc|线稿|スケッチ|라인 아트/i.test(trimmed)) return 'line_art'
  if (/flat.?illustrat|minh họa phẳng|đồ họa phẳng|扁平|フラット|플랫/i.test(trimmed)) return 'flat_illustration'
  if (/watercolou?r|abstract|màu nước|trừu tượng|水彩|抽象|수채화|추상/i.test(trimmed)) return 'watercolour_abstract'
  return null
}

export function resolveFacePrintStyle(briefNotes: Record<string, string> | undefined): FacePrintStyleKey {
  return parseFacePrintStyleKey(briefNotes?.[FACE_PRINT_STYLE_STEP_KEY]) ?? DEFAULT_FACE_PRINT_STYLE
}

export function facePrintStyleBriefValue(key: FacePrintStyleKey): string {
  return key
}

const STYLE_LABEL: Record<WebLocale, Record<FacePrintStyleKey, string>> = {
  vi: {
    realistic_photography: 'Ảnh chụp thật — ánh sáng và đổ bóng thực tế',
    line_art: 'Ảnh nét vẽ — đường nét đơn sắc, dễ tách nền',
    flat_illustration: 'Minh họa phẳng — hiện đại, ít đổ bóng, màu tối giản',
    watercolour_abstract: 'Màu nước / trừu tượng — mảng màu nghệ thuật, sang trọng',
  },
  en: {
    realistic_photography: 'Realistic photography — natural lighting and shadows',
    line_art: 'Line art / sketch — monochrome outlines, easy background removal',
    flat_illustration: 'Flat illustration — modern, minimal shadows and colors',
    watercolour_abstract: 'Watercolour / abstract — artistic, premium color washes',
  },
  zh: {
    realistic_photography: '写实摄影 — 自然光影与真实阴影',
    line_art: '线稿 / 草图 — 单色轮廓，便于去背景',
    flat_illustration: '扁平插画 — 现代、少阴影、配色简洁',
    watercolour_abstract: '水彩 / 抽象 — 艺术色块与高级质感',
  },
  ja: {
    realistic_photography: 'リアル写真 — 自然な光と影',
    line_art: '線画 / スケッチ — 単色の輪郭、背景除去が容易',
    flat_illustration: 'フラットイラスト — 現代的、影と色を最小限に',
    watercolour_abstract: '水彩 / 抽象 — 芸術的で上質な色面',
  },
  ko: {
    realistic_photography: '실사 사진 — 자연스러운 조명과 그림자',
    line_art: '라인 아트 / 스케치 — 단색 윤곽선, 배경 제거 용이',
    flat_illustration: '플랫 일러스트 — 현대적, 최소한의 그림자와 색상',
    watercolour_abstract: '수채화 / 추상 — 예술적이고 고급스러운 색면',
  },
}

export function facePrintStyleLabel(key: FacePrintStyleKey, locale: WebLocale): string {
  return STYLE_LABEL[locale][key]
}

export function facePrintStylePromptBlock(key: FacePrintStyleKey): string {
  switch (key) {
    case 'realistic_photography':
      return `VISUAL ART STYLE — realistic photography (flat print only):
- Use realistic photographic textures, lighting and product cutouts as 2D printed graphics embedded ON this flat panel.
- NEVER render a 3D box in a studio scene, grey backdrop, margins around a box, or drop shadows on a physical carton.
- Keep the result as one flat orthographic print panel filling the entire canvas edge-to-edge, never a photo of a 3D box.
- Apply the same photographic treatment consistently across all 6 faces.`
    case 'line_art':
      return `VISUAL ART STYLE — line art / sketch:
- Use clean monochrome outlines with little or no filled background, shading or gradients.
- Keep contours crisp and easy to separate from the background.
- Apply the same line weight and drawing treatment consistently across all 6 faces.`
    case 'flat_illustration':
      return `VISUAL ART STYLE — flat illustration:
- Use modern flat graphics, simplified shapes, minimal shadows and a restrained color palette.
- Avoid photorealistic lighting and 3D scenes.
- Apply the same illustration language consistently across all 6 faces.`
    case 'watercolour_abstract':
      return `VISUAL ART STYLE — watercolour / abstract:
- Use artistic watercolor washes or abstract color fields with an elegant premium finish.
- Preserve enough clear space for packaging typography and required content.
- Apply the same brush, texture and color treatment consistently across all 6 faces.`
  }
}

export function packagingFacePrintStyleStudioExtras(
  locale: WebLocale,
  session: {
    presetId?: string | null
    currentStepKey?: string | null
    discoveryComplete?: boolean
  }
): Pick<HubStudioMessagePayload, 'showFacePrintStylePicker'> | null {
  if (
    session.presetId !== 'packaging_kit' ||
    session.discoveryComplete ||
    session.currentStepKey !== FACE_PRINT_STYLE_STEP_KEY
  ) {
    return null
  }
  return { showFacePrintStylePicker: true }
}

/** Insert new discovery steps for in-progress packaging sessions saved before flow update. */
export function reconcilePackagingProcessSteps(
  session: HubStudioSession,
  locale: WebLocale
): HubStudioSession {
  if (session.presetId !== 'packaging_kit' || !session.processSteps.length) return session
  const packagingFaceReferences = session.referenceImages.filter((reference) =>
    isPackagingFaceStepKey(reference.screenKey)
  )
  if (packagingFaceReferences.length > 1) {
    const primaryReference =
      packagingFaceReferences.find((reference) => reference.screenKey === 'face_top') ??
      [...packagingFaceReferences].sort((a, b) => a.approvedAt - b.approvedAt)[0]!
    session = {
      ...session,
      referenceImages: [
        ...session.referenceImages.filter(
          (reference) => !isPackagingFaceStepKey(reference.screenKey)
        ),
        primaryReference,
      ],
    }
  }
  // Hybrid-strip sessions are migrated to the canonical six-face flow.
  // Top/bottom remain valid, while the four derived strip slices are cleared
  // so each side must be designed and approved independently.
  const canonical = buildStepsFromPreset(locale, 'packaging_kit')
  if (session.packaging?.layout !== 'hybrid_strip') {
    if (session.processSteps.some((step) => step.key === FACE_PRINT_STYLE_STEP_KEY)) {
      return session
    }
    const byKey = new Map(session.processSteps.map((step) => [step.key, step]))
    const logoIndex = session.processSteps.findIndex((step) => step.key === 'logo')
    const canonicalStyleStep = canonical.find(
      (step) => step.key === FACE_PRINT_STYLE_STEP_KEY
    )
    if (logoIndex < 0 || !canonicalStyleStep) return session
    const styleAlreadyPassed = Boolean(
      session.discoveryComplete ||
      byKey.get('logo')?.status === 'done' ||
      session.referenceImages.some((reference) => reference.screenKey === 'logo')
    )
    const colorDone = byKey.get('color_palette')?.status === 'done'
    const styleStep: HubStudioProcessStep = {
      ...canonicalStyleStep,
      status: styleAlreadyPassed
        ? 'done'
        : colorDone
          ? 'in_progress'
          : 'pending',
    }
    const merged = [...session.processSteps]
    if (colorDone && !styleAlreadyPassed) {
      merged[logoIndex] = { ...merged[logoIndex]!, status: 'pending' }
    }
    merged.splice(logoIndex, 0, styleStep)
    return {
      ...session,
      processSteps: merged,
      currentStepKey:
        colorDone && !styleAlreadyPassed
          ? FACE_PRINT_STYLE_STEP_KEY
          : session.currentStepKey,
      briefNotes: styleAlreadyPassed
        ? {
            ...session.briefNotes,
            [FACE_PRINT_STYLE_STEP_KEY]:
              session.briefNotes[FACE_PRINT_STYLE_STEP_KEY] ?? DEFAULT_FACE_PRINT_STYLE,
          }
        : session.briefNotes,
    }
  }

  const byKey = new Map(session.processSteps.map((s) => [s.key, s]))
  const sideStepKeys = new Set(['face_front', 'face_right', 'face_back', 'face_left'])
  const hadBodyStrip = Boolean(
    session.packaging.bodyStrip?.originalUrl ||
      byKey.get('body_strip')?.status === 'done'
  )

  const merged: HubStudioProcessStep[] = canonical.map((c) => {
    const prev = byKey.get(c.key)
    if (prev) return prev
    return { key: c.key, label: c.label, status: 'pending' as const }
  })
  const faceSlots = { ...(session.packaging.faceSlots ?? {}) }
  if (hadBodyStrip) {
    delete faceSlots.front
    delete faceSlots.right
    delete faceSlots.back
    delete faceSlots.left
  }
  const migratedPackaging = syncResolvedPackagingFaces({
    ...session.packaging,
    layout: 'six_faces' as const,
    faceSlots,
    bodyStrip: undefined,
    mockupUrl: hadBodyStrip ? undefined : session.packaging.mockupUrl,
    dielineUrl: hadBodyStrip ? undefined : session.packaging.dielineUrl,
    dielineVariants: hadBodyStrip ? undefined : session.packaging.dielineVariants,
  })
  const shouldRestartSides =
    session.currentStepKey === 'body_strip' ||
    (hadBodyStrip &&
      (session.discoveryComplete ||
      session.currentStepKey === 'face_bottom' ||
      session.currentStepKey === 'box_mockup_3d' ||
      session.currentStepKey === 'box_dieline_pdf'))
  let migratedSteps = shouldRestartSides
    ? merged.map((step) =>
        sideStepKeys.has(step.key)
          ? {
              ...step,
              status: step.key === 'face_front'
                ? ('in_progress' as const)
                : ('pending' as const),
            }
          : step.key === 'box_mockup_3d' || step.key === 'box_dieline_pdf'
            ? { ...step, status: 'pending' as const }
            : step
      )
    : merged
  let migratedSession: HubStudioSession = {
    ...session,
    packaging: migratedPackaging,
    processSteps: migratedSteps,
    currentStepKey: shouldRestartSides
      ? 'face_front'
      : session.currentStepKey === 'body_strip'
        ? 'face_front'
        : session.currentStepKey,
    pendingPreview:
      session.pendingPreview?.screenKey === 'body_strip'
        ? null
        : session.pendingPreview,
    referenceImages: session.referenceImages.filter((ref) => ref.screenKey !== 'body_strip'),
  }

  if (session.discoveryComplete) {
    const styleStep = migratedSteps.find((s) => s.key === FACE_PRINT_STYLE_STEP_KEY)
    if (styleStep && styleStep.status !== 'done') {
      migratedSteps = migratedSteps.map((s) =>
        s.key === FACE_PRINT_STYLE_STEP_KEY ? { ...s, status: 'done' as const } : s
      )
      const briefNotes = session.briefNotes[FACE_PRINT_STYLE_STEP_KEY]
        ? session.briefNotes
        : {
            ...session.briefNotes,
            [FACE_PRINT_STYLE_STEP_KEY]: DEFAULT_FACE_PRINT_STYLE,
          }
      migratedSession = { ...migratedSession, processSteps: migratedSteps, briefNotes }
    }
    return migratedSession
  }

  const colorDone = migratedSteps.find((s) => s.key === 'color_palette')?.status === 'done'
  const stylePending = migratedSteps.find((s) => s.key === FACE_PRINT_STYLE_STEP_KEY)?.status === 'pending'
  const hasStyleAnswer = Boolean(parseFacePrintStyleKey(session.briefNotes[FACE_PRINT_STYLE_STEP_KEY]))
  let processSteps = migratedSteps
  let currentStepKey = migratedSession.currentStepKey

  if (colorDone && stylePending && !hasStyleAnswer) {
    processSteps = migratedSteps.map((s) => ({
      ...s,
      status:
        s.key === FACE_PRINT_STYLE_STEP_KEY
          ? ('in_progress' as const)
          : s.status === 'done'
            ? ('done' as const)
            : ('pending' as const),
    }))
    currentStepKey = FACE_PRINT_STYLE_STEP_KEY
    return {
      ...migratedSession,
      processSteps,
      currentStepKey,
      discoveryComplete: false,
    }
  }

  return { ...migratedSession, processSteps, currentStepKey }
}

export function isValidFacePrintStyleBrief(value: string | undefined): boolean {
  return parseFacePrintStyleKey(value) != null
}
