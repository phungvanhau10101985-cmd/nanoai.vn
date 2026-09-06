/**
 * Lưới đề xuất — mặt 188 SimpleProductCard + SameShopRecommendationHeader.
 * Theme `--pw-*`, không hex cam. Sửa nhanh = live (ruler + chrome CSS).
 */

export const PW_RECOMMENDED_GRID_FACE_CSS = `
html [data-pw-personalize="recommended"] [data-pw-el="section-title"],
html [data-pw-personalize="recommended"] .pw-rec-title{
font-size:16px!important;line-height:1.3!important;font-weight:700!important;letter-spacing:0!important;text-transform:none!important;color:var(--pw-text,#111827);border-bottom:2px solid var(--pw-primary);padding-bottom:4px;width:fit-content;margin:0!important
}
html [data-pw-personalize="recommended"] [data-pw-grid],
html [data-pw-personalize="recommended"] .pw-product-grid{gap:16px!important}
html[data-pw-edit-device="mobile"] [data-pw-personalize="recommended"] [data-pw-grid],
html[data-pw-edit-device="tablet"] [data-pw-personalize="recommended"] [data-pw-grid],
html[data-pw-scene-lock="mobile"] [data-pw-personalize="recommended"] [data-pw-grid],
html[data-pw-scene-lock="tablet"] [data-pw-personalize="recommended"] [data-pw-grid]{gap:12px!important}
html [data-pw-personalize="recommended"] .pw-rec-head{margin:0 0 4px}
html [data-pw-personalize="recommended"] .pw-rec-head-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}
html [data-pw-personalize="recommended"] .pw-rec-actions{
display:inline-flex;max-width:100%;flex-shrink:0;align-items:center;gap:2px;border-radius:999px;border:1px solid color-mix(in srgb,var(--pw-primary) 22%,#e5e7eb);background:color-mix(in srgb,var(--pw-primary) 8%,#fff);padding:2px 4px
}
html [data-pw-personalize="recommended"] .pw-rec-actions[hidden]{display:none!important}
html [data-pw-personalize="recommended"] .pw-rec-edit,
html [data-pw-personalize="recommended"] .pw-rec-personalize-label{
display:inline-flex;min-height:30px;align-items:center;border-radius:999px;padding:0 8px;white-space:nowrap
}
html [data-pw-personalize="recommended"] .pw-rec-edit{font-size:12px;font-weight:700;color:var(--pw-primary)}
html [data-pw-personalize="recommended"] .pw-rec-edit:hover{background:color-mix(in srgb,var(--pw-primary) 12%,#fff);color:var(--pw-primary)}
html [data-pw-personalize="recommended"] .pw-rec-personalize-label{font-size:11px;font-weight:600;color:color-mix(in srgb,var(--pw-primary) 70%,#374151)}
html [data-pw-personalize="recommended"] .pw-rec-help-wrap{position:relative;display:inline-flex}
html [data-pw-personalize="recommended"] .pw-rec-help{
display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:999px;font-size:12px;font-weight:800;line-height:1;color:#6b7280;text-decoration:none
}
html [data-pw-personalize="recommended"] .pw-rec-help:hover{background:color-mix(in srgb,var(--pw-primary) 12%,#fff);color:var(--pw-primary)}
html [data-pw-personalize="recommended"] .pw-rec-help-sep{width:1px;height:14px;flex-shrink:0;background:color-mix(in srgb,var(--pw-primary) 22%,#e5e7eb)}
html [data-pw-personalize="recommended"] .pw-rec-help-tip{
pointer-events:none;position:absolute;left:0;top:calc(100% + 8px);z-index:30;width:min(17rem,calc(100vw - 2rem));border-radius:12px;border:1px solid #e5e7eb;background:#111827;color:#fff;padding:10px 12px;font-size:11px;line-height:1.45;opacity:0
}
html [data-pw-personalize="recommended"] .pw-rec-help-wrap:hover .pw-rec-help-tip,
html [data-pw-personalize="recommended"] .pw-rec-help-wrap:focus-within .pw-rec-help-tip{opacity:1}
html [data-pw-personalize="recommended"] .pw-cohort-hint{margin:6px 0 4px;font-size:12px;line-height:1.35;color:#4b5563}
html [data-pw-personalize="recommended"] .pw-cohort-hint-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
html [data-pw-personalize="recommended"] .pw-product-card,
html [data-pw-personalize="recommended"] [data-pw-el="card"]{
border-radius:12px;border:1px solid #f3f4f6;box-shadow:0 1px 2px rgba(15,23,42,.04);background:#fff;overflow:hidden;transition:border-color .15s,box-shadow .15s
}
html body:not(.nanoai-ve-active) [data-pw-personalize="recommended"] .pw-product-card:hover{
border-color:color-mix(in srgb,var(--pw-primary) 28%,#e5e7eb);box-shadow:0 8px 20px rgba(15,23,42,.08)
}
html [data-pw-personalize="recommended"] .pw-product-card-body{padding:8px!important;gap:4px!important}
html [data-pw-personalize="recommended"] [data-pw-el="card-name"],
html [data-pw-personalize="recommended"] .pw-product-card-body h3{
font-size:12px!important;font-weight:500!important;line-height:1.25!important;min-height:2rem!important;max-height:2rem!important
}
html body:not(.nanoai-ve-active) [data-pw-personalize="recommended"] [data-pw-el="card-name"]:hover,
html body:not(.nanoai-ve-active) [data-pw-personalize="recommended"] .pw-product-card-body h3:hover{color:var(--pw-primary)}
html [data-pw-personalize="recommended"] .pw-price{font-size:14px;font-weight:700;color:var(--pw-text,#111827)}
html [data-pw-personalize="recommended"] .pw-shop-action-bar,
html [data-pw-personalize="recommended"] .pw-product-card-body > [data-pw-el="card-cart"],
html [data-pw-personalize="recommended"] .pw-product-card-body > [data-pw-el="card-buy"]{display:none!important}
html [data-pw-personalize="recommended"] .pw-rec-stats{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:#6b7280;margin-top:2px}
html [data-pw-personalize="recommended"] .pw-rec-badge{
position:absolute;left:8px;top:8px;z-index:2;max-width:calc(100% - 3rem);border-radius:6px;background:var(--pw-primary);color:#fff;padding:2px 6px;font-size:9px;font-weight:700;line-height:1.2;box-shadow:0 1px 4px rgba(15,23,42,.12)
}
html [data-pw-personalize="recommended"] .pw-rec-fav{
position:absolute;top:4px;right:4px;z-index:3;display:inline-flex;width:44px;height:44px;align-items:center;justify-content:center;border:none;border-radius:999px;background:rgba(255,255,255,.92);color:#4b5563;cursor:pointer;padding:0
}
html [data-pw-personalize="recommended"] .pw-rec-fav svg{width:16px;height:16px;display:block}
html [data-pw-personalize="recommended"] .pw-rec-fav:hover,
html [data-pw-personalize="recommended"] .pw-rec-fav[aria-pressed="true"]{background:#ef4444;color:#fff}
html [data-pw-personalize="recommended"] .pw-rec-fav[aria-pressed="true"] svg{fill:#fff;stroke:#fff}
html [data-pw-personalize="recommended"] [data-pw-el="section-more"],
html [data-pw-personalize="recommended"] .pw-grid-all{display:none!important}
html [data-pw-personalize="recommended"] [data-pw-grid-more],
html [data-pw-personalize="recommended"] .pw-grid-more{
background:var(--pw-buy);color:#fff;border:none;border-radius:12px;padding:10px 24px;font-weight:700
}
html [data-pw-personalize="recommended"] .pw-grid-more-icon{display:none}
html [data-pw-personalize="recommended"] [data-pw-grid-actions],
html [data-pw-personalize="recommended"] .pw-grid-actions{margin-top:20px;padding-bottom:8px}
html [data-pw-personalize="recommended"] .pw-rec-picker{margin:8px 0 4px}
html [data-pw-personalize="recommended"] .pw-rec-picker[hidden]{display:none!important}
html [data-pw-personalize="recommended"] .pw-rec-picker-lead{margin:0 0 12px;font-size:14px;font-weight:500;color:#374151}
html [data-pw-personalize="recommended"] .pw-rec-picker-chips{display:flex;flex-wrap:wrap;gap:8px}
html [data-pw-personalize="recommended"] .pw-rec-picker-chip{
display:inline-flex;align-items:center;gap:6px;border-radius:999px;border:1px solid color-mix(in srgb,var(--pw-primary) 28%,#e5e7eb);background:#fff;color:var(--pw-primary);padding:6px 12px;font-size:12px;font-weight:700;text-decoration:none
}
html [data-pw-personalize="recommended"] .pw-rec-picker-chip:hover{background:color-mix(in srgb,var(--pw-primary) 8%,#fff)}
html [data-pw-personalize="recommended"] .pw-rec-picker-count{font-size:10px;font-weight:400;color:#9ca3af}
html [data-pw-personalize="recommended"] .pw-rec-picker-all{
display:inline-flex;align-items:center;border-radius:999px;background:#f9fafb;color:#4b5563;padding:6px 12px;font-size:12px;font-weight:700;text-decoration:none
}
html [data-pw-personalize="recommended"] .pw-rec-picker-all:hover{background:#f3f4f6}
`.trim()
