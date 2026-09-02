/**
 * Featured category tiles — 188 hero grid on every shop.
 * Theme `--pw-*` only. Device stamp wins `@media`.
 */

const WIDE = [
  'html[data-pw-edit-device="desktop"]',
  'html[data-pw-edit-device="laptop"]',
  'html[data-pw-scene-lock="desktop"]',
  'html[data-pw-scene-lock="laptop"]',
]
  .map((p) => `${p} .pw-featured-cat[data-pw-featured-categories] [data-pw-grid]`)
  .join(',')

const NARROW = [
  'html[data-pw-edit-device="mobile"]',
  'html[data-pw-edit-device="tablet"]',
  'html[data-pw-scene-lock="mobile"]',
  'html[data-pw-scene-lock="tablet"]',
]
  .map((p) => `${p} .pw-featured-cat[data-pw-featured-categories] [data-pw-grid]`)
  .join(',')

export const PW_FEATURED_CATEGORIES_CSS = `
html .pw-featured-cat[data-pw-featured-categories]{
  margin:0 0 16px;padding:0;border-radius:16px;overflow:hidden;background:var(--pw-primary);color:#fff;
  box-shadow:0 8px 24px rgba(0,0,0,.12);box-sizing:border-box
}
html .pw-featured-cat[data-pw-featured-categories] > .pw-featured-cat-inner{
  padding:0;margin:0;box-sizing:border-box
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-grid]{
  display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:0!important;
  margin:0!important;width:100%;background:transparent
}
${WIDE}{grid-template-columns:repeat(5,minmax(0,1fr))!important}
${NARROW}{grid-template-columns:repeat(2,minmax(0,1fr))!important}
@media (max-width:1279px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-grid]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
html:not([data-pw-edit-device]) [data-pw-featured-categories]:not([data-pw-featured-live]) [data-pw-el="card"]{visibility:hidden}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"],
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card{
  position:relative;display:block;min-width:0;min-height:88px;height:88px;
  overflow:hidden;text-decoration:none;color:#fff;border-right:1px solid rgba(255,255,255,.12);
  box-sizing:border-box;background:transparent
}
html[data-pw-edit-device="desktop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"],
html[data-pw-edit-device="laptop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"],
html[data-pw-scene-lock="desktop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"],
html[data-pw-scene-lock="laptop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]{min-height:115px;height:115px}
html[data-pw-edit-device="mobile"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"],
html[data-pw-scene-lock="mobile"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]{min-height:88px;height:88px}
@media (min-width:1280px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]{min-height:115px;height:115px}
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(5n){border-right:none}
html[data-pw-edit-device="mobile"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(2n),
html[data-pw-edit-device="tablet"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(2n),
html[data-pw-scene-lock="mobile"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(2n),
html[data-pw-scene-lock="tablet"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(2n){border-right:none}
@media (max-width:1279px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(2n){border-right:none}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(5n){border-right:1px solid rgba(255,255,255,.12)}
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"] > [data-pw-el="card-media"],
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-media"]{
  position:absolute!important;top:8px!important;right:6px!important;bottom:8px!important;left:38%!important;
  width:auto!important;height:auto!important;aspect-ratio:auto!important;padding:0!important;margin:0!important;
  display:block!important;background:transparent!important;overflow:hidden!important;flex:none!important
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-media"] img{
  width:100%!important;height:100%!important;object-fit:contain!important;object-position:right center!important;
  padding:0!important;display:block;pointer-events:none
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]::after{
  content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
  background:linear-gradient(90deg,var(--pw-primary) 0%,var(--pw-primary) 32%,transparent 70%)
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-name"]{
  position:absolute;left:0;top:0;bottom:0;z-index:2;width:58%;margin:0;padding:10px 8px 10px 12px;
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;align-content:center;
  font:700 13px/1.25 var(--pw-font-ui),system-ui,sans-serif;color:#fff!important;
  text-shadow:0 1px 2px rgba(0,0,0,.35);overflow:hidden;white-space:normal
}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-actions{
  display:flex;align-items:center;justify-content:center;padding:8px 12px 10px;
  background:rgba(0,0,0,.15);border-top:1px solid rgba(255,255,255,.15)
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="section-more"],
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-all{
  display:inline-flex!important;align-items:center;justify-content:center;gap:6px;
  min-height:36px;padding:6px 16px;border-radius:999px!important;background:#fff!important;
  color:var(--pw-primary)!important;font:600 12px/1.2 var(--pw-font-ui),system-ui,sans-serif;
  text-decoration:none;border:1px solid rgba(255,255,255,.4);box-shadow:0 1px 2px rgba(0,0,0,.08)
}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-all-icon{width:14px;height:14px;flex-shrink:0;opacity:.7}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-empty{margin:0;padding:16px;text-align:center;font-size:13px;color:#fff}
html .pw-featured-cat[data-pw-featured-categories] .pw-shop-action-bar,
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-cart"],
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-buy"],
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-price"],
html .pw-featured-cat[data-pw-featured-categories] [data-pw-grid-more]{display:none!important}
`.trim()
