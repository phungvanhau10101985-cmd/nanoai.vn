/** Client-safe outfit-grid styles. Keep Postgres fetchers out of this file. */
import { PW_PRODUCT_GRID_RULER_CSS } from '@/lib/partner-website/shop/pw-product-grid-ruler'

export const PW_OUTFIT_CHROME_CSS = `
.pw-outfit{margin-top:24px;padding-top:20px;border-top:1px solid var(--pw-border,#e5e7eb);box-sizing:border-box}
.pw-outfit-title{margin:0 0 2px;font-size:1rem;line-height:1.4;font-weight:700;color:var(--pw-text,#111827)}
.pw-outfit-subtitle{margin:0 0 12px;font-size:12px;line-height:1.4;color:var(--pw-muted,#6b7280)}
.pw-outfit-slots{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}
.pw-outfit-slot{display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:999px;padding:6px 12px;font:600 13px/1.2 system-ui,sans-serif;cursor:pointer;background:var(--pw-surface,#f3f4f6);color:var(--pw-text,#374151)}
.pw-outfit-slot[aria-selected="true"],.pw-outfit-slot.is-active{background:var(--pw-primary);color:#fff}
.pw-outfit-card{border:1px solid var(--pw-border,#e5e7eb);border-radius:8px;background:#fff}
.pw-outfit-card:hover .pw-product-card-media img{transform:scale(1.06);transition:transform .3s}
.pw-outfit-card-body{padding:8px;display:flex;flex-direction:column;gap:4px;flex:1}
.pw-outfit-reason{margin:0;display:inline-flex;align-self:start;padding:2px 6px;border-radius:4px;background:var(--pw-surface,#fff7ed);color:var(--pw-primary);font-size:10px;line-height:1.3}
.pw-outfit-card .pw-shop-action-bar,.pw-outfit-card [data-pw-el="card-cart"],.pw-outfit-card [data-pw-el="card-buy"]{display:none!important}
.pw-outfit-actions{margin-top:16px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap}
html[data-pw-edit-device="mobile"] .pw-outfit-actions,html[data-pw-edit-device="tablet"] .pw-outfit-actions,html[data-pw-scene-lock="mobile"] .pw-outfit-actions,html[data-pw-scene-lock="tablet"] .pw-outfit-actions{justify-content:space-between}
@media (max-width:1279px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-outfit-actions{justify-content:space-between}
}
.pw-outfit-more{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:none;border:none;padding:0;cursor:pointer;font:inherit;font-size:14px;color:var(--pw-text,#374151)}
.pw-outfit-more[hidden]{display:none!important}
.pw-outfit-more-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid var(--pw-border,#d1d5db);border-radius:999px}
.pw-outfit-all{display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border-radius:8px;background:var(--pw-buy);color:#fff!important;font-size:14px;font-weight:600;text-decoration:none}
.pw-outfit-all[hidden]{display:none!important}
.pw-outfit-empty{margin:0;font-size:14px;color:var(--pw-muted,#6b7280)}
`.trim()

export const PW_OUTFIT_CSS = `
${PW_PRODUCT_GRID_RULER_CSS}
${PW_OUTFIT_CHROME_CSS}
`.trim()
