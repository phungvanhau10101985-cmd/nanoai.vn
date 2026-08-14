import type { ComponentType } from 'react'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import {
  FolderTree,
  Globe,
  LayoutTemplate,
  Mail,
  MessageSquareQuote,
  MousePointerClick,
  Rocket,
  Search,
  Settings2,
  Ticket,
  Users,
} from 'lucide-react'

export const PARTNER_WEBSITE_ADMIN_SECTION_IDS = [
  'partner-website-editor',
  'partner-website-capabilities',
  'partner-website-categories',
  'partner-website-reviews-qa',
  'partner-website-customers',
  'partner-website-static-pages',
  'partner-website-promotions',
  'partner-website-landings',
  'partner-website-floating-cta',
  'partner-website-search-aliases',
  'partner-website-leads',
] as const

export type PartnerWebsiteAdminSectionId = (typeof PARTNER_WEBSITE_ADMIN_SECTION_IDS)[number]

export type PartnerWebsiteAdminNavItem = {
  sectionId: PartnerWebsiteAdminSectionId
  label: string
  icon: ComponentType<{ className?: string }>
}

const NAV_ICONS: Record<PartnerWebsiteAdminSectionId, ComponentType<{ className?: string }>> = {
  'partner-website-editor': Globe,
  'partner-website-capabilities': Settings2,
  'partner-website-categories': FolderTree,
  'partner-website-reviews-qa': MessageSquareQuote,
  'partner-website-customers': Users,
  'partner-website-static-pages': LayoutTemplate,
  'partner-website-promotions': Ticket,
  'partner-website-landings': Rocket,
  'partner-website-floating-cta': MousePointerClick,
  'partner-website-search-aliases': Search,
  'partner-website-leads': Mail,
}

export function isPartnerWebsiteAdminSectionId(
  value: string | null | undefined
): value is PartnerWebsiteAdminSectionId {
  return (
    value != null &&
    (PARTNER_WEBSITE_ADMIN_SECTION_IDS as readonly string[]).includes(value)
  )
}

/** Sidebar entries on /dashboard/messaging/settings — in-page website admin sections. */
export function buildPartnerWebsiteAdminNavItems(
  t: PartnerWebsiteCopy,
  mainWebsiteLabel: string
): PartnerWebsiteAdminNavItem[] {
  const labels: Record<PartnerWebsiteAdminSectionId, string> = {
    'partner-website-editor': mainWebsiteLabel,
    'partner-website-capabilities': t.capabilitiesPanelTitle,
    'partner-website-categories': t.categoriesTitle,
    'partner-website-reviews-qa': t.reviewsAdminTitle,
    'partner-website-customers': t.customersTitle,
    'partner-website-static-pages': t.staticPagesTitle,
    'partner-website-promotions': t.promotionsTitle,
    'partner-website-landings': t.lpPanelTitle,
    'partner-website-floating-cta': t.floatingCtaPanelTitle,
    'partner-website-search-aliases': t.searchAliasesPanelTitle,
    'partner-website-leads': t.leadsPanelTitle,
  }
  return PARTNER_WEBSITE_ADMIN_SECTION_IDS.filter(
    (sectionId) =>
      sectionId !== 'partner-website-capabilities' &&
      sectionId !== 'partner-website-search-aliases'
  ).map((sectionId) => ({
    sectionId,
    label: labels[sectionId],
    icon: NAV_ICONS[sectionId],
  }))
}

export function partnerWebsiteAdminSectionHref(baseHref: string, sectionId: string): string {
  const base = baseHref.split('#')[0] ?? baseHref
  return `${base}#${sectionId}`
}

export function scrollToPartnerWebsiteAdminSection(sectionId: string): void {
  const id = sectionId.replace(/^#/, '').trim()
  if (!id) return
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
