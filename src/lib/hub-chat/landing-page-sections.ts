import type { WebLocale } from '@/lib/i18n/config'
import {
  LANDING_DESIGN_STEP_KEYS,
  LANDING_PAGE_FLOW,
  type LandingDesignStepKey,
} from '@/lib/hub-chat/hub-studio-preset-flows'
import { presetStepLabel } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export type LandingPageSection = {
  key: LandingDesignStepKey
  label: string
  url: string
  formFactor?: 'desktop' | 'mobile' | 'square'
}

export function landingPageTitle(session: HubStudioSession): string {
  return (
    session.briefNotes.product_name?.trim() ||
    session.projectTitle?.trim() ||
    'Landing Page'
  )
}

export function collectLandingPageSections(
  session: HubStudioSession,
  locale: WebLocale
): LandingPageSection[] {
  const ref = session.referenceImages.find((r) => r.screenKey === 'landing_full')
  if (!ref?.url?.trim()) return []

  const stepDef = LANDING_PAGE_FLOW.find((s) => s.key === 'landing_full')
  return [
    {
      key: 'landing_full',
      label:
        ref.screenLabel?.trim() ||
        presetStepLabel(locale, 'landing_page', 'landing_full') ||
        'landing_full',
      url: ref.url.trim(),
      formFactor: stepDef?.formFactor,
    },
  ]
}

export function sortLandingSectionsByFlow(sections: LandingPageSection[]): LandingPageSection[] {
  const order = new Map(LANDING_DESIGN_STEP_KEYS.map((key, index) => [key, index]))
  return [...sections].sort((a, b) => {
    const ai = order.get(a.key) ?? 999
    const bi = order.get(b.key) ?? 999
    return ai - bi
  })
}

export function landingPageFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug ? `landing-${slug}` : 'landing-page'
}
