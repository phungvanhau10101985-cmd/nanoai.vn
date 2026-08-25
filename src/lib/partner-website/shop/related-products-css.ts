/** Client-safe related-products styles. Keep Postgres fetchers out of this file. */
export const PW_RELATED_CSS = `
.pw-related{margin-top:40px;padding-top:20px;border-top:1px solid var(--pw-border,#e5e7eb);box-sizing:border-box}
.pw-related-title{margin:0 0 12px;font-size:1rem;line-height:1.4;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:.02em}
.pw-related-grid{gap:16px}
.pw-related-card{display:flex;flex-direction:column;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#fff}
.pw-related-card .pw-product-card-media,.pw-related-card [data-pw-el="card-media"]{display:block;aspect-ratio:1;background:#f3f4f6;overflow:hidden}
.pw-related-card .pw-product-card-media img,.pw-related-card [data-pw-el="card-media"] img{width:100%;height:100%;object-fit:cover;display:block}
.pw-related-card:hover .pw-product-card-media img{transform:scale(1.1);transition:transform .3s}
.pw-related-card-body{padding:8px;display:grid;gap:4px}
.pw-related-card [data-pw-el="card-name"]{margin:0;font-size:12px;font-weight:500;line-height:1.25;color:#111827;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pw-related-card [data-pw-el="card-name"] a{color:inherit;text-decoration:none}
.pw-related-card .pw-price,.pw-related-card [data-pw-el="card-price"]{margin:0;font-size:14px;font-weight:700;color:var(--pw-primary)}
.pw-related-card .pw-shop-action-bar,.pw-related-card [data-pw-el="card-cart"],.pw-related-card [data-pw-el="card-buy"]{display:none!important}
.pw-related-actions{margin-top:16px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap}
html[data-pw-edit-device="mobile"] .pw-related-actions,html[data-pw-edit-device="tablet"] .pw-related-actions,html[data-pw-scene-lock="mobile"] .pw-related-actions,html[data-pw-scene-lock="tablet"] .pw-related-actions{justify-content:space-between}
@media (max-width:1279px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-related-actions{justify-content:space-between}
}
.pw-related-more{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:none;border:none;padding:0;cursor:pointer;font:inherit;font-size:14px;color:#374151}
.pw-related-more[hidden]{display:none!important}
.pw-related-more-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid #d1d5db;border-radius:999px}
.pw-related-all{display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border-radius:8px;background:var(--pw-buy);color:#fff!important;font-size:14px;font-weight:600;text-decoration:none}
.pw-related-all[hidden]{display:none!important}
.pw-related-empty{margin:0;font-size:14px;color:#6b7280}
html[data-pw-edit-device="laptop"] .pw-related-grid,html[data-pw-scene-lock="laptop"] .pw-related-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important}
@media (min-width:1280px){
html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) .pw-related-grid,html:not([data-pw-scene-lock="mobile"]):not([data-pw-scene-lock="tablet"]) .pw-related-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important}
}
`.trim()
