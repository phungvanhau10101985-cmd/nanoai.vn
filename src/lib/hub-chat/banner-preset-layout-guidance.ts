import type { BannerAdPresetId } from '@/lib/banner-ad-presets'
import { normalizeBannerAdPresetId } from '@/lib/banner-ad-presets'

/** English layout notes for the AI prompt writer — one finished banner per preset. */
const PRESET_LAYOUT_GUIDANCE: Partial<Record<BannerAdPresetId, string>> = {
  horizontal_display_ads: `Google Display / YouTube / web header (16:9, ~1200×628).
Layout: left 38–45% text block (logo, headline, sub-offer, CTA button); right 55–62% hero visual (model wearing product OR product group).
Include category cues if relevant (icons or short labels). Strong horizontal hierarchy; safe margins; CTA high-contrast button.`,
  square_social_ads: `Facebook Feed & Google square (1:1, 1080×1080).
Layout: center-weighted; bold offer badge top; hero visual (model portrait or product cluster) middle; 2–3 selling points as short bullets; CTA button bottom.
Scroll-stopping, minimal text, large product/model focus.`,
  portrait_social_ads: `Facebook/Instagram portrait feed (4:5, 1080×1350).
Layout: vertical stack — logo top, headline, hero visual (model or product), offer strip, CTA button. Product should dominate middle third.`,
  vertical_story_ads: `Story / Reels / TikTok full vertical (9:16).
Layout: full-bleed vertical; hook text top 20%; model or product hero center; swipe-up or pill CTA bottom 15%. Mobile-first, large type, no tiny text.`,
  web_leaderboard: `Web leaderboard / thin horizontal strip (4:1, ~728×90 style).
Layout: ultra-wide strip — logo far left, short headline center-left, optional category icons inline, product thumbnails or model bust right, CTA button far right.
Minimal height — no full-body model; use cropped portrait or product-only if space is tight.`,
  wide_hero_desktop: `Ultra-wide desktop hero (21:9).
Layout: cinematic wide — large slogan left or center, sweeping lifestyle/model scene across frame, subtle logo, secondary CTA.`,
  print_catalog_4_3: `Horizontal catalog / print (4:3).
Layout: clean product-forward grid or hero product + headline; catalog-style clarity; price/offer optional.`,
  print_poster_3_4: `Vertical poster / in-store (3:4).
Layout: top logo, large headline, full or 3/4 body model or product hero, offer + CTA bottom.`,
  catalog_photo_3_2: `Horizontal product catalog photo (3:2).
Layout: product-first flat lay or studio shot; headline + domain; minimal decorative text.`,
  pinterest_poster_2_3: `Pinterest vertical poster (2:3).
Layout: visual hook dominates; minimal on-image text; aspirational lifestyle or product beauty shot.`,
  catalog_near_square_5_4: `Near-square catalog (5:4).
Layout: product + price/offer emphasis; balanced text and product zones.`,
  ooh_vertical_1_4: `OOH ultra-tall portrait screen (1:4).
Layout: vertical stack — huge logo/headline top, model or product middle, offer + CTA bottom; extremely large readable type.`,
  ooh_strip_8_1: `LED / event ultra-wide strip (8:1).
Layout: logo + 3–5 word headline + CTA only; no detailed body copy; bold colors; optional product silhouette.`,
}

/** One cohesive brief when the same prompt is rendered at multiple aspect ratios. */
export const MULTI_RATIO_BANNER_LAYOUT_GUIDANCE = `Unified campaign banner design — the SAME creative direction will be rendered at multiple aspect ratios (wide, square, portrait, strip, etc.).

Design a cohesive system with these fixed elements across all sizes:
- Logo zone (top-left or top-center when logo image is attached)
- Headline + optional subhead + high-contrast CTA button
- Hero visual: model and/or products matching the visual brief (fashion, shoes, bags…)
- Color palette and premium mood from brand_style / color_tone

Adaptation rules (image generator will crop/reframe per target ratio):
- Wide horizontal (16:9, 4:1, 21:9): text block left or center-left, hero visual right; strip formats use logo + short headline + CTA only
- Square / near-square (1:1, 5:4): centered hierarchy, offer badge, hero middle, CTA bottom
- Portrait / tall (4:5, 9:16, 3:4, 1:4): vertical stack — logo top, headline, hero center, CTA bottom
- Keep all on-image text readable at every size; no tiny illegible copy on thin strips`

export function getBannerPresetLayoutGuidance(presetId: string): string {
  const id = normalizeBannerAdPresetId(presetId)
  return (
    PRESET_LAYOUT_GUIDANCE[id] ??
    PRESET_LAYOUT_GUIDANCE.horizontal_display_ads ??
    'Standard performance ad banner — clear headline, product visual, prominent CTA.'
  )
}
