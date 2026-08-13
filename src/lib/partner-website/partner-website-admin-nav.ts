import type { ComponentType } from 'react'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import {
  FolderTree,
  Globe,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  MessageSquareQuote,
  MousePointerClick,
  Palette,
  PanelBottom,
  Rocket,
  Search,
  Settings2,
  Ticket,
  Users,
} from 'lucide-react'

export type PartnerWebsiteAdminNavItem = {
  sectionId: string
  label: string
  icon: ComponentType<{ className?: string }>
}

/** Sidebar entries on /dashboard/messaging/settings → website dashboard anchors. */
export function buildPartnerWebsiteAdminNavItems(
  t: PartnerWebsiteCopy,
  mainWebsiteLabel: string
): PartnerWebsiteAdminNavItem[] {
  return [
    { sectionId: 'partner-website-editor', label: mainWebsiteLabel, icon: Globe },
    { sectionId: 'partner-website-capabilities', label: t.capabilitiesPanelTitle, icon: Settings2 },
    { sectionId: 'partner-website-categories', label: t.categoriesTitle, icon: FolderTree },
    { sectionId: 'partner-website-reviews-qa', label: t.reviewsAdminTitle, icon: MessageSquareQuote },
    { sectionId: 'partner-website-customers', label: t.customersTitle, icon: Users },
    { sectionId: 'partner-website-static-pages', label: t.staticPagesTitle, icon: LayoutTemplate },
    { sectionId: 'partner-website-promotions', label: t.promotionsTitle, icon: Ticket },
    { sectionId: 'partner-website-landings', label: t.lpPanelTitle, icon: Rocket },
    { sectionId: 'partner-website-sections', label: t.sectionsPanelTitle, icon: LayoutGrid },
    { sectionId: 'partner-website-theme-colors', label: t.themeColorsPanelTitle, icon: Palette },
    { sectionId: 'partner-website-nav-footer', label: t.navFooterPanelTitle, icon: PanelBottom },
    { sectionId: 'partner-website-floating-cta', label: t.floatingCtaPanelTitle, icon: MousePointerClick },
    { sectionId: 'partner-website-search-aliases', label: t.searchAliasesPanelTitle, icon: Search },
    { sectionId: 'partner-website-leads', label: t.leadsPanelTitle, icon: Mail },
  ]
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
