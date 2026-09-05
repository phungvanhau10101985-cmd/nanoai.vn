/**
 * Featured category tiles — 188 hero grid + vertical marquee on every shop.
 * Theme `--pw-*` only. Device stamp wins `@media`.
 */

const GRID = '[data-pw-grid],[data-pw-featured-clone]'

const WIDE = [
  'html[data-pw-edit-device="desktop"]',
  'html[data-pw-edit-device="laptop"]',
  'html[data-pw-scene-lock="desktop"]',
  'html[data-pw-scene-lock="laptop"]',
]
  .map((p) => `${p} .pw-featured-cat[data-pw-featured-categories] ${GRID}`)
  .join(',')

const NARROW = [
  'html[data-pw-edit-device="mobile"]',
  'html[data-pw-edit-device="tablet"]',
  'html[data-pw-scene-lock="mobile"]',
  'html[data-pw-scene-lock="tablet"]',
]
  .map((p) => `${p} .pw-featured-cat[data-pw-featured-categories] ${GRID}`)
  .join(',')

export const PW_FEATURED_CATEGORIES_CSS = `
@keyframes pw-featured-cat-marquee-vertical{
  0%{transform:translateY(0)}
  100%{transform:translateY(-50%)}
}
html .pw-featured-cat[data-pw-featured-categories]{
  display:flex;flex-direction:column;height:208px!important;margin:0 0 16px;padding:0;border-radius:16px;overflow:hidden;
  background:var(--pw-primary);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.12);box-sizing:border-box
}
html[data-pw-edit-device="tablet"] .pw-featured-cat[data-pw-featured-categories],
html[data-pw-edit-device="laptop"] .pw-featured-cat[data-pw-featured-categories],
html[data-pw-edit-device="desktop"] .pw-featured-cat[data-pw-featured-categories],
html[data-pw-scene-lock="tablet"] .pw-featured-cat[data-pw-featured-categories],
html[data-pw-scene-lock="laptop"] .pw-featured-cat[data-pw-featured-categories],
html[data-pw-scene-lock="desktop"] .pw-featured-cat[data-pw-featured-categories]{height:288px!important}
@media (min-width:768px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories]{height:288px!important}
}
html .pw-featured-cat[data-pw-featured-categories] > .pw-featured-cat-inner{
  flex:1;min-height:0;display:flex;flex-direction:column;padding:0;margin:0;overflow:hidden;box-sizing:border-box
}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-viewport,
html .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-viewport]{
  position:relative;flex:1;min-height:0;overflow:hidden;width:100%;
  -webkit-mask-image:linear-gradient(to bottom,transparent 0%,#000 10%,#000 90%,transparent 100%);
  mask-image:linear-gradient(to bottom,transparent 0%,#000 10%,#000 90%,transparent 100%)
}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-viewport::before,
html .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-viewport]::before{
  content:"";pointer-events:none;position:absolute;inset:0;z-index:1;
  background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(255,255,255,.14),transparent 55%)
}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-viewport::after,
html .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-viewport]::after{
  content:"";pointer-events:none;position:absolute;inset-inline:0;bottom:0;height:40px;z-index:2;
  background:linear-gradient(to top,rgba(0,0,0,.35),transparent)
}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-marquee,
html .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-marquee]{
  position:relative;z-index:0;display:flex;flex-direction:column;width:100%;
  will-change:transform
}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-marquee:has([data-pw-featured-clone]),
html .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-marquee]:has([data-pw-featured-clone]){
  animation:pw-featured-cat-marquee-vertical 30s linear infinite
}
@media (max-width:767px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-marquee:has([data-pw-featured-clone]),
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-marquee]:has([data-pw-featured-clone]){
  animation-duration:26s
}
html[data-pw-edit-device="mobile"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-marquee:has([data-pw-featured-clone]),
html[data-pw-scene-lock="mobile"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-marquee:has([data-pw-featured-clone]),
html[data-pw-edit-device="mobile"] .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-marquee]:has([data-pw-featured-clone]),
html[data-pw-scene-lock="mobile"] .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-marquee]:has([data-pw-featured-clone]){
  animation-duration:26s
}
}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-marquee:hover,
html .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-marquee]:hover,
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-viewport.is-paused .pw-featured-cat-marquee,
html .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-viewport].is-paused [data-pw-featured-marquee]{
  animation-play-state:paused
}
@media (prefers-reduced-motion:reduce){
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-marquee,
html .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-marquee]{
  animation:none!important;will-change:auto
}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-viewport,
html .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-viewport]{
  overflow-y:auto;-webkit-overflow-scrolling:touch
}
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-grid],
html .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-clone]{
  display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:0!important;
  margin:0!important;width:100%;background:transparent;flex:none
}
${WIDE}{grid-template-columns:repeat(5,minmax(0,1fr))!important}
${NARROW}{grid-template-columns:repeat(2,minmax(0,1fr))!important}
@media (max-width:1279px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] ${GRID}{grid-template-columns:repeat(2,minmax(0,1fr))!important}
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
html[data-pw-edit-device="desktop"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card,
html[data-pw-edit-device="laptop"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card,
html[data-pw-scene-lock="desktop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"],
html[data-pw-scene-lock="laptop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"],
html[data-pw-scene-lock="desktop"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card,
html[data-pw-scene-lock="laptop"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card{min-height:115px;height:115px}
html[data-pw-edit-device="mobile"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"],
html[data-pw-scene-lock="mobile"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]{min-height:88px;height:88px}
@media (min-width:1280px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"],
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card{min-height:115px;height:115px}
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(5n),
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:nth-child(5n){border-right:none}
html[data-pw-edit-device="mobile"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(2n),
html[data-pw-edit-device="tablet"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(2n),
html[data-pw-scene-lock="mobile"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(2n),
html[data-pw-scene-lock="tablet"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(2n),
html[data-pw-edit-device="mobile"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:nth-child(2n),
html[data-pw-edit-device="tablet"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:nth-child(2n),
html[data-pw-scene-lock="mobile"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:nth-child(2n),
html[data-pw-scene-lock="tablet"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:nth-child(2n){border-right:none}
@media (max-width:1279px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(2n),
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:nth-child(2n){border-right:none}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:nth-child(5n),
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:nth-child(5n){border-right:1px solid rgba(255,255,255,.12)}
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"],
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card{
  transition:filter .45s ease,box-shadow .45s ease,transform .45s cubic-bezier(.22,1,.36,1)
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"] > [data-pw-el="card-media"],
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-media"],
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-media{
  position:absolute!important;inset:0!important;width:auto!important;height:auto!important;
  aspect-ratio:auto!important;padding:4px!important;margin:0!important;
  display:block!important;background:transparent!important;overflow:hidden!important;flex:none!important
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-media"] img,
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-media img{
  width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important;
  padding:0!important;display:block;pointer-events:none;transition:transform .5s ease
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]::before,
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card::before{
  content:"";position:absolute;inset-inline:0;bottom:0;z-index:1;pointer-events:none;height:36px;
  background:linear-gradient(to top,rgba(0,0,0,.65),transparent)
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]::after,
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card::after{
  content:"";position:absolute;inset:0;z-index:5;pointer-events:none;
  background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.22) 50%,transparent 58%);
  transform:translateX(-130%) skewX(-18deg);opacity:0
}
html .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-name"],
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card > span:not([data-pw-el="card-media"]):not(.pw-featured-cat-media):not(.pw-featured-cat-count){
  position:absolute;left:0;right:0;bottom:0;z-index:2;width:auto;margin:0;padding:4px 6px 6px;
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;
  font:700 10px/1.2 var(--pw-font-ui),system-ui,sans-serif;color:#fff!important;
  text-shadow:0 1px 3px rgba(0,0,0,.85);overflow:hidden;white-space:normal
}
html[data-pw-edit-device="desktop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-name"],
html[data-pw-edit-device="laptop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-name"],
html[data-pw-scene-lock="desktop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-name"],
html[data-pw-scene-lock="laptop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-name"]{font-size:11px;padding:4px 8px 6px}
html[data-pw-edit-device="desktop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover,
html[data-pw-edit-device="laptop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover,
html[data-pw-scene-lock="desktop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover,
html[data-pw-scene-lock="laptop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover,
html[data-pw-edit-device="desktop"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:hover,
html[data-pw-edit-device="laptop"] .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:hover{
  filter:brightness(1.06);transform:scale(1.02);z-index:2;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),0 12px 28px -8px rgba(0,0,0,.35)
}
html[data-pw-edit-device="desktop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover::after,
html[data-pw-edit-device="laptop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover::after,
html[data-pw-scene-lock="desktop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover::after,
html[data-pw-scene-lock="laptop"] .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover::after{
  opacity:1;animation:pw-featured-cat-tile-shine .7s ease
}
@media (min-width:768px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card-name"],
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card > span:not([data-pw-el="card-media"]):not(.pw-featured-cat-media){font-size:11px;padding:4px 8px 6px}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover,
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:hover{
  filter:brightness(1.06);transform:scale(1.02);z-index:2;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),0 12px 28px -8px rgba(0,0,0,.35)
}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover::after,
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:hover::after{
  opacity:1;animation:pw-featured-cat-tile-shine .7s ease
}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover img{
  transform:scale(1.05)
}
}
@keyframes pw-featured-cat-tile-shine{
  0%{transform:translateX(-130%) skewX(-18deg)}
  100%{transform:translateX(130%) skewX(-18deg)}
}
@media (max-width:767px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover,
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-card:hover{
  filter:none;transform:none;box-shadow:none
}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-featured-cat[data-pw-featured-categories] [data-pw-el="card"]:hover::after{
  animation:none;opacity:0
}
}
html .pw-featured-cat[data-pw-featured-categories] .pw-featured-cat-actions{
  position:relative;z-index:3;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:8px 12px 10px;
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
html.nanoai-ve-active .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-clone],
body.nanoai-ve-active .pw-featured-cat[data-pw-featured-categories] [data-pw-featured-clone]{pointer-events:none}
`.trim()
