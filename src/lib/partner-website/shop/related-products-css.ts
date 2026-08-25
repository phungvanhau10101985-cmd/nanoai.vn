/** Client-safe related-products styles. Keep Postgres fetchers out of this file. */
import { PW_PRODUCT_GRID_RULER_CSS } from '@/lib/partner-website/shop/pw-product-grid-ruler'

export const PW_RELATED_CHROME_CSS = `
.pw-related{margin-top:40px;padding-top:20px;border-top:1px solid var(--pw-border,#e5e7eb);box-sizing:border-box}
.pw-related-title{margin:0 0 12px;font-size:1rem;line-height:1.4;font-weight:700;color:var(--pw-text,#111827);text-transform:uppercase;letter-spacing:.02em}
.pw-related-card{border:1px solid var(--pw-border,#e5e7eb);border-radius:8px;background:#fff}
.pw-related-card:hover .pw-product-card-media img{transform:scale(1.06);transition:transform .3s}
.pw-related-card-body{padding:8px;display:flex;flex-direction:column;gap:4px;flex:1}
.pw-related-card .pw-shop-action-bar,.pw-related-card [data-pw-el="card-cart"],.pw-related-card [data-pw-el="card-buy"]{display:none!important}
.pw-related-actions{margin-top:16px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap}
html[data-pw-edit-device="mobile"] .pw-related-actions,html[data-pw-edit-device="tablet"] .pw-related-actions,html[data-pw-scene-lock="mobile"] .pw-related-actions,html[data-pw-scene-lock="tablet"] .pw-related-actions{justify-content:space-between}
@media (max-width:1279px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-related-actions{justify-content:space-between}
}
.pw-related-more{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:none;border:none;padding:0;cursor:pointer;font:inherit;font-size:14px;color:var(--pw-text,#374151)}
.pw-related-more[hidden]{display:none!important}
.pw-related-more-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid var(--pw-border,#d1d5db);border-radius:999px}
.pw-related-all{display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border-radius:8px;background:var(--pw-buy);color:#fff!important;font-size:14px;font-weight:600;text-decoration:none}
.pw-related-all[hidden]{display:none!important}
.pw-related-empty{margin:0;font-size:14px;color:var(--pw-muted,#6b7280)}
`.trim()

export const PW_RELATED_CSS = `
${PW_PRODUCT_GRID_RULER_CSS}
${PW_RELATED_CHROME_CSS}
`.trim()
