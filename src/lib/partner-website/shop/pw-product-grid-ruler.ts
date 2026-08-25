/**
 * Shared product-card ruler — Sửa nhanh = live, every shop / device.
 * Related + outfit strips: desktop/laptop 5 cols, mobile/tablet 2 cols.
 * Card media stays 1:1 even when the image is missing or broken.
 * Never auto-fit: leftover HTML `repeat(auto-fit, minmax(220px,1fr))` must not win.
 */

const PW_STRIP_GRID_PARTS = [
  '[data-pw-related] [data-pw-grid]',
  '[data-pw-related] .pw-product-grid',
  '[data-pw-grid-kind="related"] [data-pw-grid]',
  '[data-pw-outfit] [data-pw-grid]',
  '[data-pw-outfit] .pw-product-grid',
  '[data-pw-grid-kind="outfit"] [data-pw-grid]',
  '.pw-related-grid',
  '.pw-outfit-grid',
] as const

function pwStripGridSel(prefix = 'html'): string {
  return PW_STRIP_GRID_PARTS.map((sel) => `${prefix} ${sel}`).join(',')
}

const PW_STRIP_GRID_SEL = pwStripGridSel('html')
const PW_STRIP_GRID_MOBILE_SEL = [
  pwStripGridSel('html[data-pw-edit-device="mobile"]'),
  pwStripGridSel('html[data-pw-edit-device="tablet"]'),
  pwStripGridSel('html[data-pw-scene-lock="mobile"]'),
  pwStripGridSel('html[data-pw-scene-lock="tablet"]'),
].join(',')
const PW_STRIP_GRID_UNLOCKED_NARROW_SEL = pwStripGridSel(
  'html:not([data-pw-edit-device="desktop"]):not([data-pw-edit-device="laptop"]):not([data-pw-scene-lock="desktop"]):not([data-pw-scene-lock="laptop"])'
)

const PW_CARD_MEDIA_SEL = [
  'html .pw-product-card .pw-product-card-media',
  'html .pw-product-card [data-pw-el="card-media"]',
  'html .pw-related-card .pw-product-card-media',
  'html .pw-outfit-card .pw-product-card-media',
  'html [data-pw-related] [data-pw-el="card-media"]',
  'html [data-pw-outfit] [data-pw-el="card-media"]',
  'html [data-pw-el="card"] > [data-pw-el="card-media"]',
].join(',')

const PW_CARD_MEDIA_IMG_SEL = `${PW_CARD_MEDIA_SEL} img`

const PW_STRIP_CARD_SEL = [
  'html .pw-related-card',
  'html .pw-outfit-card',
  'html [data-pw-related] [data-pw-el="card"]',
  'html [data-pw-outfit] [data-pw-el="card"]',
].join(',')

const PW_STRIP_NAME_SEL = [
  'html .pw-related-card [data-pw-el="card-name"]',
  'html .pw-outfit-card [data-pw-el="card-name"]',
  'html [data-pw-related] [data-pw-el="card-name"]',
  'html [data-pw-outfit] [data-pw-el="card-name"]',
].join(',')

const PW_STRIP_PRICE_SEL = [
  'html .pw-related-card .pw-price',
  'html .pw-related-card [data-pw-el="card-price"]',
  'html .pw-outfit-card .pw-price',
  'html .pw-outfit-card [data-pw-el="card-price"]',
  'html [data-pw-related] [data-pw-el="card-price"]',
  'html [data-pw-outfit] [data-pw-el="card-price"]',
].join(',')

/** Desktop/laptop 5 · mobile/tablet 2. Attribute selectors beat leftover class/auto-fit CSS. */
export const PW_PRODUCT_STRIP_GRID_CSS = `
${PW_STRIP_GRID_SEL}{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:12px!important;align-items:stretch;width:100%;max-width:100%;box-sizing:border-box;grid-auto-flow:row}
${PW_STRIP_GRID_MOBILE_SEL}{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
@media (max-width:1279px){
${PW_STRIP_GRID_UNLOCKED_NARROW_SEL}{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
}
`.trim()

/** Square media box + clipped img. Do not text-indent the photo — that shifts the bitmap out of the slot. */
export const PW_PRODUCT_CARD_MEDIA_RULER_CSS = `
${PW_STRIP_CARD_SEL}{display:flex!important;flex-direction:column!important;min-width:0!important;max-width:100%!important;width:auto!important;box-sizing:border-box;overflow:hidden}
${PW_CARD_MEDIA_SEL}{position:relative!important;display:block!important;width:100%!important;aspect-ratio:1/1!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;overflow:hidden!important;background:var(--pw-surface,#f3f4f6);flex:0 0 auto}
${PW_CARD_MEDIA_IMG_SEL}{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:cover!important;object-position:center!important;display:block!important;border:0!important;text-indent:0!important;transform:none}
${PW_CARD_MEDIA_IMG_SEL}[src=""],${PW_CARD_MEDIA_SEL} img:not([src]){visibility:hidden!important}
${PW_STRIP_NAME_SEL}{margin:0;font-size:12px;font-weight:500;line-height:1.25;color:var(--pw-text,#111827);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.5em}
${PW_STRIP_NAME_SEL} a{color:inherit;text-decoration:none}
${PW_STRIP_PRICE_SEL}{margin:0;margin-top:auto;font-size:14px;font-weight:700;color:var(--pw-primary)}
`.trim()

export const PW_PRODUCT_GRID_RULER_CSS = `
${PW_PRODUCT_STRIP_GRID_CSS}
${PW_PRODUCT_CARD_MEDIA_RULER_CSS}
`.trim()
