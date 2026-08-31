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
  'html [data-pw-el="card"]:not(.pw-featured-cat-card) > [data-pw-el="card-media"]',
].join(',')

const PW_CARD_MEDIA_IMG_SEL = suffixEach(PW_CARD_MEDIA_SEL, ' img')
const PW_CARD_MEDIA_EMPTY_IMG_SEL = [
  suffixEach(PW_CARD_MEDIA_IMG_SEL, '[src=""]'),
  suffixEach(PW_CARD_MEDIA_SEL, ' img:not([src])'),
].join(',')

function suffixEach(sel: string, suffix: string): string {
  return sel
    .split(',')
    .map((part) => `${part}${suffix}`)
    .join(',')
}

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

const PW_CATALOG_CARD_SEL = [
  'html .pw-product-card',
  'html .pw-shop-card',
  'html [data-pw-catalog] [data-pw-el="card"]',
  'html [data-pw-personalize] [data-pw-el="card"]',
  'html [data-pw-added-catalog] [data-pw-el="card"]',
  PW_STRIP_CARD_SEL,
].join(',')

const PW_CATALOG_GRID_SEL = [
  'html .pw-product-grid',
  'html .pw-shop-grid',
  'html [data-pw-catalog] [data-pw-grid]',
  'html [data-pw-personalize] [data-pw-grid]',
  'html [data-pw-added-catalog] [data-pw-grid]',
].join(',')

const PW_CATALOG_BODY_SEL = [
  'html .pw-product-card-body',
  'html .pw-shop-card-body',
  'html .pw-related-card-body',
  'html .pw-outfit-card-body',
].join(',')

const PW_CATALOG_NAME_SEL = [
  PW_STRIP_NAME_SEL,
  'html .pw-product-card [data-pw-el="card-name"]',
  'html .pw-shop-card [data-pw-el="card-name"]',
  'html [data-pw-catalog] [data-pw-el="card-name"]',
  'html [data-pw-personalize] [data-pw-el="card-name"]',
  'html [data-pw-added-catalog] [data-pw-el="card-name"]',
  'html .pw-product-card-body h3',
  'html .pw-product-card-body h4',
  'html .pw-shop-card-body h3',
].join(',')

const PW_CATALOG_ACTION_SEL = [
  'html .pw-product-card .pw-shop-action-bar',
  'html .pw-shop-card .pw-shop-action-bar',
  'html [data-pw-catalog] .pw-shop-action-bar',
  'html [data-pw-personalize] .pw-shop-action-bar',
  'html [data-pw-added-catalog] .pw-shop-action-bar',
  'html .pw-product-card-body > [data-pw-el="card-cart"]',
  'html .pw-product-card-body > [data-pw-el="card-buy"]',
  'html .pw-shop-card-body > [data-pw-el="card-cart"]',
  'html .pw-shop-card-body > [data-pw-el="card-buy"]',
  'html .pw-shop-card-body > .pw-shop-btn',
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
${PW_CARD_MEDIA_IMG_SEL}{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:cover!important;object-position:center!important;display:block!important;border:0!important;text-indent:0!important;transform:none;visibility:visible}
${PW_CARD_MEDIA_EMPTY_IMG_SEL}{visibility:hidden!important}
${PW_STRIP_NAME_SEL}{margin:0;font-size:12px;font-weight:500;line-height:1.25;color:var(--pw-text,#111827);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.5em}
${PW_STRIP_NAME_SEL} a{color:inherit;text-decoration:none}
${PW_STRIP_PRICE_SEL}{margin:0;margin-top:auto;font-size:14px;font-weight:700;color:var(--pw-primary)}
`.trim()

/** Catalog / listing / personalize: 2-line name + cart buttons share one baseline. */
export const PW_PRODUCT_CATALOG_CARD_FACE_CSS = `
${PW_CATALOG_GRID_SEL}{align-items:stretch}
${PW_CATALOG_CARD_SEL}{display:flex!important;flex-direction:column!important;height:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box}
${PW_CATALOG_BODY_SEL}{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;gap:6px!important}
${PW_CATALOG_NAME_SEL}{margin:0!important;line-height:1.3!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;word-break:break-word;overflow-wrap:anywhere;min-height:2.6em;max-height:2.6em}
${suffixEach(PW_CATALOG_NAME_SEL, ' a')}{color:inherit;text-decoration:none}
${PW_CATALOG_ACTION_SEL}{margin-top:auto!important;width:100%!important}
`.trim()

const PW_CATALOG_TITLE_PARTS = [
  '[data-pw-catalog] [data-pw-el="section-title"]',
  '[data-pw-region="catalog"] [data-pw-el="section-title"]',
  '[data-pw-personalize] [data-pw-el="section-title"]',
  '[data-pw-related] [data-pw-el="section-title"]',
  '[data-pw-outfit] [data-pw-el="section-title"]',
  '[data-pw-added-catalog] [data-pw-el="section-title"]',
  '.pw-catalog .pw-section-title',
  '.pw-related-title',
  '.pw-outfit-title',
] as const

function pwCatalogTitleSel(prefix = 'html'): string {
  return PW_CATALOG_TITLE_PARTS.map((sel) => `${prefix} ${sel}`).join(',')
}

/** Tiêu đề nhóm lưới — nhỏ hơn hero; máy stamp thắng clamp template. */
export const PW_PRODUCT_GRID_TITLE_CSS = `
${pwCatalogTitleSel('html')}{margin:0!important;font-size:1.125rem!important;line-height:1.25!important;font-weight:700!important;letter-spacing:.04em!important;text-transform:uppercase;color:var(--pw-text,#111827)}
${pwCatalogTitleSel('html[data-pw-edit-device="laptop"]')},${pwCatalogTitleSel('html[data-pw-scene-lock="laptop"]')}{font-size:1.0625rem!important}
${pwCatalogTitleSel('html[data-pw-edit-device="tablet"]')},${pwCatalogTitleSel('html[data-pw-scene-lock="tablet"]')}{font-size:1.05rem!important}
${pwCatalogTitleSel('html[data-pw-edit-device="mobile"]')},${pwCatalogTitleSel('html[data-pw-scene-lock="mobile"]')}{font-size:1rem!important}
@media (max-width:1279px){
${pwCatalogTitleSel('html:not([data-pw-edit-device]):not([data-pw-scene-lock])')}{font-size:1.05rem!important}
}
@media (max-width:767px){
${pwCatalogTitleSel('html:not([data-pw-edit-device]):not([data-pw-scene-lock])')}{font-size:1rem!important}
}
`.trim()

/** Nút Xem thêm + Xem tất cả các nhóm dưới lưới — in-flow, không hoist. */
export const PW_PRODUCT_GRID_MORE_CSS = `
html [data-pw-catalog] [data-pw-grid-actions],html [data-pw-personalize] [data-pw-grid-actions],html [data-pw-related] [data-pw-grid-actions],html [data-pw-outfit] [data-pw-grid-actions],html .pw-grid-actions,html .pw-related-actions,html .pw-outfit-actions{margin-top:12px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px}
html .pw-grid-more,html [data-pw-grid-more],html .pw-related-more,html .pw-outfit-more{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--pw-surface,#f3f4f6);color:var(--pw-text,#111827);border:1px solid var(--pw-border,#e5e7eb);border-radius:8px;padding:8px 16px;cursor:pointer;font:600 13px/1.2 var(--pw-font-ui),system-ui,sans-serif}
html .pw-grid-more[hidden],html [data-pw-grid-more][hidden],html .pw-related-more[hidden],html .pw-outfit-more[hidden]{display:none!important}
html .pw-grid-more-icon,html .pw-related-more-icon,html .pw-outfit-more-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid var(--pw-border,#d1d5db);border-radius:999px;font-size:12px}
html [data-pw-catalog] [data-pw-el="section-more"],html [data-pw-personalize] [data-pw-el="section-more"],html [data-pw-related] [data-pw-el="section-more"],html [data-pw-outfit] [data-pw-el="section-more"],html [data-pw-added-catalog] [data-pw-el="section-more"],html .pw-related-all,html .pw-outfit-all,html .pw-grid-all{display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border-radius:8px;background:var(--pw-buy);color:#fff!important;font:600 13px/1.2 var(--pw-font-ui),system-ui,sans-serif;text-decoration:none}
html [data-pw-el="section-more"][hidden],html .pw-related-all[hidden],html .pw-outfit-all[hidden],html .pw-grid-all[hidden]{display:none!important}
`.trim()

/** Thêm lưới: ôm nội dung, không padding section 48px / không khóa chiều cao khối. */
export const PW_ADDED_PRODUCT_GRID_COMPACT_CSS = `
html [data-pw-added-catalog],html .pw-product-grid-section,html [data-pw-grid-kind][data-pw-added-catalog]{
margin:0!important;padding:0!important;min-height:0!important;height:auto!important;flex:0 0 auto!important;align-self:stretch!important;box-sizing:border-box
}
html [data-pw-added-catalog] > .pw-container,html .pw-product-grid-section > .pw-container{
padding:12px var(--pw-page-gutter,16px) 16px!important;box-sizing:border-box
}
html[data-pw-edit-device="mobile"] [data-pw-added-catalog] > .pw-container,html[data-pw-scene-lock="mobile"] [data-pw-added-catalog] > .pw-container,html[data-pw-edit-device="mobile"] .pw-product-grid-section > .pw-container,html[data-pw-scene-lock="mobile"] .pw-product-grid-section > .pw-container{
padding:8px 0 12px!important
}
@media (max-width:767px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) [data-pw-added-catalog] > .pw-container,html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-product-grid-section > .pw-container{padding:8px 0 12px!important}
}
html [data-pw-added-catalog].pw-related,html [data-pw-added-catalog].pw-outfit{
margin-top:12px!important;padding-top:8px!important
}
html [data-pw-added-catalog][data-pw-block-h],html [data-pw-region="catalog"][data-pw-added-catalog][data-pw-block-h]{
min-height:0!important;height:auto!important
}
`.trim()

export const PW_PRODUCT_GRID_RULER_CSS = `
${PW_PRODUCT_STRIP_GRID_CSS}
${PW_PRODUCT_CARD_MEDIA_RULER_CSS}
${PW_PRODUCT_CATALOG_CARD_FACE_CSS}
${PW_ADDED_PRODUCT_GRID_COMPACT_CSS}
${PW_PRODUCT_GRID_TITLE_CSS}
${PW_PRODUCT_GRID_MORE_CSS}
`.trim()
