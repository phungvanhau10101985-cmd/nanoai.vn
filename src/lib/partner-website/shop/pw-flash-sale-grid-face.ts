/**
 * Khối FLASH SALE — mặt 188 HomeFlashSaleSection + SimpleProductCard.
 * Theme `--pw-*`, không hex cam. Timer pill giữ đỏ hệ thống.
 */

export const PW_FLASH_SALE_GRID_FACE_CSS = `
html [data-pw-personalize="flash-sale"] .pw-flash-head,
html [data-pw-grid-kind="flash-sale"] .pw-flash-head{
display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px;margin:0 0 12px
}
html [data-pw-personalize="flash-sale"] .pw-flash-title,
html [data-pw-personalize="flash-sale"] [data-pw-el="section-title"]{
font-size:16px!important;line-height:1.3!important;font-weight:700!important;letter-spacing:0!important;text-transform:none!important;color:var(--pw-text,#111827);border-bottom:2px solid var(--pw-primary);padding-bottom:4px;width:fit-content;margin:0!important
}
html [data-pw-personalize="flash-sale"] .pw-flash-sub,
html [data-pw-personalize="flash-sale"] [data-pw-flash-sub]{
margin:4px 0 0;font-size:12px;line-height:1.4;color:#4b5563;max-width:36rem
}
html [data-pw-personalize="flash-sale"] .pw-flash-timer,
html [data-pw-personalize="flash-sale"] [data-pw-flash-timer]{
margin:0;border-radius:999px;background:#dc2626;color:#fff;padding:4px 12px;font-size:12px;font-weight:700;line-height:1.4;font-variant-numeric:tabular-nums
}
html [data-pw-personalize="flash-sale"] .pw-flash-timer[hidden]{display:none!important}
html [data-pw-personalize="flash-sale"] [data-pw-grid],
html [data-pw-personalize="flash-sale"] .pw-product-grid{gap:16px!important}
html[data-pw-edit-device="mobile"] [data-pw-personalize="flash-sale"] [data-pw-grid],
html[data-pw-edit-device="tablet"] [data-pw-personalize="flash-sale"] [data-pw-grid],
html[data-pw-scene-lock="mobile"] [data-pw-personalize="flash-sale"] [data-pw-grid],
html[data-pw-scene-lock="tablet"] [data-pw-personalize="flash-sale"] [data-pw-grid]{gap:12px!important}
html [data-pw-personalize="flash-sale"] .pw-product-card,
html [data-pw-personalize="flash-sale"] [data-pw-el="card"]{
border-radius:12px;border:1px solid #f3f4f6;box-shadow:0 1px 2px rgba(15,23,42,.04);background:#fff;overflow:hidden;transition:border-color .15s,box-shadow .15s
}
html body:not(.nanoai-ve-active) [data-pw-personalize="flash-sale"] .pw-product-card:hover{
border-color:color-mix(in srgb,var(--pw-primary) 28%,#e5e7eb);box-shadow:0 8px 20px rgba(15,23,42,.08)
}
html [data-pw-personalize="flash-sale"] .pw-product-card-body{padding:8px!important;gap:4px!important}
html [data-pw-personalize="flash-sale"] [data-pw-el="card-name"],
html [data-pw-personalize="flash-sale"] .pw-product-card-body h3{
font-size:12px!important;font-weight:500!important;line-height:1.25!important;min-height:2rem!important;max-height:2rem!important
}
html body:not(.nanoai-ve-active) [data-pw-personalize="flash-sale"] [data-pw-el="card-name"]:hover,
html body:not(.nanoai-ve-active) [data-pw-personalize="flash-sale"] .pw-product-card-body h3:hover{color:var(--pw-primary)}
html [data-pw-personalize="flash-sale"] .pw-price{font-size:14px;font-weight:700;color:var(--pw-text,#111827)}
html [data-pw-personalize="flash-sale"] .pw-shop-action-bar,
html [data-pw-personalize="flash-sale"] .pw-product-card-body > [data-pw-el="card-cart"],
html [data-pw-personalize="flash-sale"] .pw-product-card-body > [data-pw-el="card-buy"]{display:none!important}
html [data-pw-personalize="flash-sale"] .pw-rec-stats{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:#6b7280;margin-top:2px}
html [data-pw-personalize="flash-sale"] .pw-rec-fav{
position:absolute;top:4px;right:4px;z-index:3;display:inline-flex;width:44px;height:44px;align-items:center;justify-content:center;border:none;border-radius:999px;background:rgba(255,255,255,.92);color:#4b5563;cursor:pointer;padding:0
}
html [data-pw-personalize="flash-sale"] .pw-rec-fav svg{width:16px;height:16px;display:block}
html [data-pw-personalize="flash-sale"] .pw-rec-fav:hover,
html [data-pw-personalize="flash-sale"] .pw-rec-fav[aria-pressed="true"]{background:#ef4444;color:#fff}
html [data-pw-personalize="flash-sale"] .pw-rec-fav[aria-pressed="true"] svg{fill:#fff;stroke:#fff}
html [data-pw-personalize="flash-sale"] [data-pw-el="section-more"],
html [data-pw-personalize="flash-sale"] .pw-grid-all,
html [data-pw-personalize="flash-sale"] [data-pw-grid-more],
html [data-pw-personalize="flash-sale"] .pw-grid-more,
html [data-pw-personalize="flash-sale"] [data-pw-grid-actions]{display:none!important}
`.trim()
