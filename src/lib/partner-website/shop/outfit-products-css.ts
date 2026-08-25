/** Client-safe outfit-grid styles. Keep Postgres fetchers out of this file. */
export const PW_OUTFIT_CSS = `
.pw-outfit{margin-top:24px;padding-top:20px;border-top:1px solid var(--pw-border,#e5e7eb);box-sizing:border-box}
.pw-outfit-title{margin:0 0 2px;font-size:1rem;line-height:1.4;font-weight:700;color:var(--pw-text,#111827)}
.pw-outfit-subtitle{margin:0 0 12px;font-size:12px;line-height:1.4;color:var(--pw-muted,#6b7280)}
.pw-outfit-slots{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}
.pw-outfit-slot{display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:999px;padding:6px 12px;font:600 13px/1.2 system-ui,sans-serif;cursor:pointer;background:var(--pw-surface,#f3f4f6);color:var(--pw-text,#374151)}
.pw-outfit-slot[aria-selected="true"],.pw-outfit-slot.is-active{background:var(--pw-primary);color:#fff}
.pw-outfit-grid{gap:16px}
.pw-outfit-card{display:flex;flex-direction:column;border:1px solid var(--pw-border,#e5e7eb);border-radius:8px;overflow:hidden;background:#fff}
.pw-outfit-card .pw-product-card-media,.pw-outfit-card [data-pw-el="card-media"]{display:block;aspect-ratio:1;background:var(--pw-surface,#f3f4f6);overflow:hidden}
.pw-outfit-card .pw-product-card-media img,.pw-outfit-card [data-pw-el="card-media"] img{width:100%;height:100%;object-fit:cover;display:block}
.pw-outfit-card:hover .pw-product-card-media img{transform:scale(1.1);transition:transform .3s}
.pw-outfit-card-body{padding:8px;display:grid;gap:4px}
.pw-outfit-card [data-pw-el="card-name"]{margin:0;font-size:12px;font-weight:500;line-height:1.25;color:var(--pw-text,#111827);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pw-outfit-card [data-pw-el="card-name"] a{color:inherit;text-decoration:none}
.pw-outfit-reason{margin:0;display:inline-flex;align-self:start;padding:2px 6px;border-radius:4px;background:var(--pw-surface,#fff7ed);color:var(--pw-primary);font-size:10px;line-height:1.3}
.pw-outfit-card .pw-price,.pw-outfit-card [data-pw-el="card-price"]{margin:0;font-size:14px;font-weight:700;color:var(--pw-primary)}
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
html[data-pw-edit-device="laptop"] .pw-outfit-grid,html[data-pw-scene-lock="laptop"] .pw-outfit-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important}
@media (min-width:1280px){
html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) .pw-outfit-grid,html:not([data-pw-scene-lock="mobile"]):not([data-pw-scene-lock="tablet"]) .pw-outfit-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important}
}
`.trim()
