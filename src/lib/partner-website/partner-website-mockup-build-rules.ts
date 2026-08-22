/** Prompt rules: landing must match approved mockup closely. */
export const PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES = `- PIXEL-FIDELITY: Recreate the attached mockup as closely as possible — same section order, colors (hex), typography, spacing, border-radius, shadows, and visual hierarchy.
- Do NOT substitute a generic template, Bootstrap layout, or different color palette.
- Extract exact copy/text from the mockup and brief — no lorem ipsum.
- Hero, nav, cards, and footer must mirror mockup proportions (not simplified).
- IMAGE DENSITY: If the mockup shows many product cards / banners, the HTML MUST include a similarly dense grid (at least 4–6 product cards with real photos). Never leave large empty white space where the mockup had images.
- EVERY provided section image URL MUST appear in the HTML as <img src="EXACT_URL"> or CSS url("EXACT_URL"). Do not drop, invent, or replace those URLs with placeholders.`

/** Prompt rules: responsive across phone, tablet, laptop (MacBook), desktop. */
export const PARTNER_WEBSITE_RESPONSIVE_RULES = `- RESPONSIVE REQUIRED for mobile (≤480px), tablet (481–1024px), laptop/MacBook (1025–1440px), and desktop (1441px+).
- css/main.css MUST include explicit @media blocks at least for:
  @media (max-width: 480px) { /* phone */ }
  @media (min-width: 481px) and (max-width: 1024px) { /* tablet */ }
  @media (min-width: 1025px) and (max-width: 1440px) { /* laptop / MacBook */ }
  @media (min-width: 1441px) { /* large desktop — match mockup reference */ }
- Mobile: single column, stacked sections, readable 16px+ body, tap targets ≥44px, hamburger or condensed nav if needed.
- Tablet: 2-column grids where mockup implies grid; balanced padding.
- Laptop (1280–1440px): layout should closely match the mockup reference image.
- Desktop: max-width container (e.g. 1200–1280px) centered OR full-bleed hero per mockup — never overflow horizontal scroll.
- Use fluid images: max-width:100%; height:auto. Use clamp() for headline sizes where appropriate.
- Test mentally at 390px, 768px, 1280px, and 1440px widths before returning JSON.`

/** Prompt rules: shared header/footer/bottom-nav on every shop page. */
export const PARTNER_WEBSITE_SHARED_CHROME_PROMPT_RULES = `- SHARED CHROME: Within ONE device (desktop OR tablet OR mobile), every page uses the SAME header, footer, and bottom nav as that device's homepage — except mobile product detail, which uses a different bottom bar (data-pw-pdp-bottom=1: Home, try-on, favorite, add to cart, buy). Only <main> / middle content differs by page.
- Header: <header class="pw-header" data-pw-region="header"> (logo, search, account, Chat mua, cart). Do not invent a second nav bar or a different header per page of the same device.
- Chat mua is a chrome widget in header actions: data-pw-chrome-btn="chat" + data-nanoai-open-chat + shop logo as <img class="pw-chrome-chat-logo"> (or chat SVG if no logo). It opens the platform embed chat API. NEVER create a floating NanoAI bubble (.pw-fab-chat, data-nanoai-chat-bubble, data-pw-chat-launcher).
- Footer: <footer class="pw-footer" data-pw-region="footer"> after main.
- Bottom nav: <nav class="pw-bottom-nav" data-pw-region="nav"> as the last body child. CSS: display none at min-width 1280px; position:fixed; left:0; right:0; bottom:0 at max-width 1279px (mobile AND tablet). Never hide it only below 899px.
- DEVICE LAYOUT IS INDEPENDENT: do NOT copy logo position, header arrangement, or element coordinates from desktop onto mobile/tablet (or vice versa). Each device HTML file keeps its own chrome layout.
- Feature buttons (search, cart, account, Chat mua, added chrome widgets) should exist on all devices; their size and placement stay per-device.
- Non-home pages of a device: keep that device homepage header/footer/bottom-nav markup; insert page content in <main id="pw-main">.`

export const PARTNER_WEBSITE_STUDIO_BUILD_SYSTEM_EXTRA = `${PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES}
${PARTNER_WEBSITE_RESPONSIVE_RULES}
${PARTNER_WEBSITE_SHARED_CHROME_PROMPT_RULES}`

export const PARTNER_WEBSITE_RESPONSIVE_BASELINE_STYLE_ID = 'nanoai-pw-responsive-baseline'

export const PARTNER_WEBSITE_RESPONSIVE_BASELINE_CSS = `
/* NanoAI platform: responsive safety baseline */
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;overflow-x:hidden;min-width:0}
img,video,iframe,svg{max-width:100%;height:auto}
table{max-width:100%;overflow-x:auto;display:block}
@media (max-width:1024px){
  .pw-header-inner,.site-header,.navbar,header nav{flex-wrap:wrap;gap:.5rem 1rem}
}
@media (max-width:480px){
  h1{font-size:clamp(1.5rem,5vw,2.25rem)!important}
  h2{font-size:clamp(1.25rem,4.5vw,1.75rem)!important}
  .pw-btn,button,.btn,a.btn{min-height:44px;padding:.65rem 1rem}
}
`.trim()

export function appendResponsiveBaselineToProjectCss(css: string): string {
  if (css.includes(PARTNER_WEBSITE_RESPONSIVE_BASELINE_STYLE_ID) || css.includes('nanoai-pw-responsive-baseline')) {
    return css
  }
  return `${css.trim()}\n\n/* ${PARTNER_WEBSITE_RESPONSIVE_BASELINE_STYLE_ID} */\n${PARTNER_WEBSITE_RESPONSIVE_BASELINE_CSS}\n`
}

export function injectPartnerWebsiteResponsiveBaselineIntoHtml(html: string): string {
  const trimmed = html.trim()
  if (!trimmed || trimmed.includes(PARTNER_WEBSITE_RESPONSIVE_BASELINE_STYLE_ID)) return html
  const tag = `<style id="${PARTNER_WEBSITE_RESPONSIVE_BASELINE_STYLE_ID}">\n${PARTNER_WEBSITE_RESPONSIVE_BASELINE_CSS}\n</style>`
  if (/<\/head>/i.test(trimmed)) return trimmed.replace(/<\/head>/i, `${tag}\n</head>`)
  return `${tag}\n${trimmed}`
}
