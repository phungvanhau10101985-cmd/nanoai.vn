/** Visual polish for account / cart / orders. Layout contracts stay in theme + cart-page CSS. */
export const PW_SHOP_ACCOUNT_COMMERCE_POLISH_CSS = `
.pw-shop-btn{transition:filter .16s ease,box-shadow .16s ease,transform .12s ease,background-color .16s ease,border-color .16s ease,color .16s ease}
@media(hover:hover){
  .pw-shop-btn:hover:not(:disabled){filter:brightness(1.06);box-shadow:0 8px 18px color-mix(in srgb,var(--pw-primary) 26%,transparent)}
  .pw-shop-btn-outline:hover:not(:disabled){filter:none;background:color-mix(in srgb,var(--pw-primary) 8%,#fff);box-shadow:none}
  .pw-shop-btn-cart:hover:not(:disabled){box-shadow:0 8px 18px color-mix(in srgb,var(--pw-cart) 28%,transparent)}
  .pw-shop-btn-buy:hover:not(:disabled){box-shadow:0 8px 18px color-mix(in srgb,var(--pw-buy) 28%,transparent)}
}
.pw-shop-btn:active:not(:disabled){transform:translateY(1px)}
.pw-shop-btn:focus-visible,.pw-shop-account-nav-item:focus-visible,.pw-shop-order-filter-chip:focus-visible,.pw-shop-qty button:focus-visible,.pw-shop-form input:not([type="checkbox"]):not([type="radio"]):focus-visible,.pw-shop-form textarea:focus-visible,.pw-shop-form select:focus-visible{
  outline:2px solid color-mix(in srgb,var(--pw-primary) 55%,transparent);outline-offset:2px
}
.pw-shop-form input:not([type="checkbox"]):not([type="radio"]):focus,.pw-shop-form textarea:focus,.pw-shop-form select:focus{
  border-color:var(--pw-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--pw-primary) 16%,transparent)
}

.pw-shop-account-nav{box-shadow:0 8px 24px rgba(15,23,42,.05)}
.pw-shop-account-nav-item{transition:background-color .15s ease,color .15s ease,border-color .15s ease}
.pw-shop-account-content{box-shadow:0 8px 28px rgba(15,23,42,.05)}
.pw-shop-account-hub-identity{display:flex;align-items:center;gap:14px;min-width:0}
.pw-shop-account-avatar{width:52px;height:52px;border-radius:999px;overflow:hidden;flex-shrink:0;display:grid;place-items:center;font-size:15px;font-weight:800;letter-spacing:.02em;color:var(--pw-primary);background:color-mix(in srgb,var(--pw-primary) 14%,#fff);border:1px solid color-mix(in srgb,var(--pw-primary) 22%,#fff)}
.pw-shop-account-avatar img{width:100%;height:100%;object-fit:cover;display:block}
.pw-shop-account-hub-head{padding:12px 16px 16px}
.pw-shop-account-hub-copy{min-width:0}
.pw-shop-account-hub-edit{margin-top:10px;padding:0 12px;border-radius:999px;border:1px solid color-mix(in srgb,var(--pw-primary) 28%,#fff);background:color-mix(in srgb,var(--pw-primary) 8%,#fff);transition:background-color .15s ease,border-color .15s ease}
.pw-shop-account-hub-edit:hover{background:color-mix(in srgb,var(--pw-primary) 14%,#fff)}
.pw-shop-account-hub-orders{border-radius:0;padding:10px 12px 12px}
.pw-shop-account-hub-order-chip{transition:border-color .15s ease,box-shadow .15s ease,color .15s ease}
@media(hover:hover){.pw-shop-account-hub-order-chip:hover{border-color:color-mix(in srgb,var(--pw-primary) 45%,var(--pw-border,#e5e7eb));box-shadow:0 6px 16px rgba(15,23,42,.06)}}
.pw-shop-account-hub-row{transition:background-color .15s ease,padding-left .15s ease}
@media(hover:hover){.pw-shop-account-hub-row:hover{background:color-mix(in srgb,var(--pw-primary) 6%,#fff)}}
.pw-shop-account-hub-chevron{transition:transform .15s ease,color .15s ease}
@media(hover:hover){.pw-shop-account-hub-row:hover .pw-shop-account-hub-chevron{transform:translateX(2px);color:var(--pw-primary)}}
.pw-shop-account-summary-head{align-items:center}
.pw-shop-account-dl{padding:4px 0 2px}
.pw-shop-account-dl>div{display:grid;gap:3px;padding:12px 0;border-bottom:1px solid var(--pw-border,#f3f4f6)}
.pw-shop-account-dl>div:last-child{border-bottom:none}
.pw-shop-account-session-btns button{transition:background-color .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease}
@media(hover:hover){
  .pw-shop-account-session-switch:hover{background:color-mix(in srgb,var(--pw-primary) 8%,#fff)}
  .pw-shop-account-session-logout:hover{background:#f9fafb}
}

.pw-shop-empty{display:grid;justify-items:center;gap:8px;margin:8px 0 4px;padding:36px 18px;text-align:center;border:1px dashed color-mix(in srgb,var(--pw-primary) 22%,var(--pw-border,#e5e7eb));border-radius:18px;background:linear-gradient(180deg,color-mix(in srgb,var(--pw-primary) 6%,#fff),#fff)}
.pw-shop-empty p{margin:0;max-width:22rem;color:var(--pw-muted,#6b7280);font-size:14px;line-height:1.5}
.pw-shop-empty .pw-shop-btn{margin-top:8px;width:auto;min-width:9.5rem}
.pw-shop-empty-mark{width:64px;height:64px;border-radius:20px;display:grid;place-items:center;background:color-mix(in srgb,var(--pw-primary) 12%,#fff);color:var(--pw-primary);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--pw-primary) 16%,transparent)}
.pw-shop-empty-mark svg{width:28px;height:28px}

.pw-shop-skel{--pw-skel:color-mix(in srgb,var(--pw-primary) 10%,#f3f4f6);--pw-skel-shine:color-mix(in srgb,var(--pw-primary) 4%,#fff);position:relative;overflow:hidden;background:var(--pw-skel);border-radius:10px}
.pw-shop-skel::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--pw-skel-shine),transparent);transform:translateX(-100%);animation:pw-shop-skel 1.15s ease-in-out infinite}
.pw-shop-skel-stack{display:grid;gap:12px;margin:8px 0}
.pw-shop-skel-line{height:12px;width:100%}
.pw-shop-skel-line.w-40{width:40%}
.pw-shop-skel-line.w-60{width:60%}
.pw-shop-skel-thumb{width:64px;height:64px;border-radius:12px;flex-shrink:0}
.pw-shop-skel-card{padding:14px;border:1px solid var(--pw-border,#e5e7eb);border-radius:14px;background:#fff;display:grid;gap:12px}
.pw-shop-skel-row{display:flex;gap:12px;align-items:center}
.pw-shop-skel-copy{flex:1;min-width:0;display:grid;gap:8px}
@keyframes pw-shop-skel{to{transform:translateX(100%)}}

.pw-shop-order-filters{margin-top:14px}
.pw-shop-order-filter-chip{transition:color .15s ease,border-color .15s ease,background-color .15s ease}
@media(hover:hover){.pw-shop-order-filter-chip:hover{background:color-mix(in srgb,var(--pw-primary) 6%,transparent)}}
.pw-shop-order-card{transition:box-shadow .2s ease,border-color .2s ease,transform .18s ease}
@media(hover:hover) and (min-width:768px){.pw-shop-order-card:hover{box-shadow:0 12px 28px rgba(15,23,42,.1)}}
.pw-shop-order-thumb,.pw-shop-product-hit-media{border-radius:12px}
.pw-shop-order-actions .pw-shop-btn{transition:filter .16s ease,box-shadow .16s ease,transform .12s ease,background-color .16s ease}
.pw-shop-order-timeline{gap:0;padding:4px 0 2px}
.pw-shop-order-timeline li{padding:8px 0 14px 24px}
.pw-shop-order-timeline li::before{top:11px;width:11px;height:11px;border:2px solid #fff;box-shadow:0 0 0 1px var(--pw-border,#e5e7eb);z-index:1}
.pw-shop-order-timeline li:not(:last-child)::after{content:'';position:absolute;left:4.5px;top:22px;bottom:0;width:2px;background:var(--pw-border,#e5e7eb)}
.pw-shop-order-timeline li.is-done:not(:last-child)::after,.pw-shop-order-timeline li.is-active:not(:last-child)::after{background:color-mix(in srgb,var(--pw-primary) 55%,var(--pw-border,#e5e7eb))}
.pw-shop-order-timeline li.is-done::before,.pw-shop-order-timeline li.is-active::before{box-shadow:0 0 0 3px color-mix(in srgb,var(--pw-primary) 22%,transparent);border-color:#fff}
.pw-shop-order-payment{margin:0 16px 16px;padding:14px;border:1px solid var(--pw-border,#e5e7eb);border-radius:12px;background:var(--pw-surface,#f8fafc)}
.pw-shop-order-payment .pw-shop-order-actions{padding:0;border:none;background:transparent}

.pw-shop-cart-row{transition:border-color .18s ease,box-shadow .18s ease,background-color .18s ease}
@media(hover:hover){.pw-shop-cart-row:hover{box-shadow:0 10px 24px rgba(15,23,42,.08);border-color:color-mix(in srgb,var(--pw-primary) 28%,var(--pw-border,#e5e7eb))}}
.pw-shop-cart-row.is-selected{background:color-mix(in srgb,var(--pw-primary) 5%,#fff);box-shadow:0 0 0 1px color-mix(in srgb,var(--pw-primary) 22%,transparent)}
.pw-shop-cart-product-media,.pw-shop-cart-row img{border-radius:12px}
.pw-shop-qty{background:var(--pw-surface,#f9fafb);box-shadow:inset 0 0 0 1px transparent}
.pw-shop-qty button{transition:background-color .15s ease,color .15s ease}
.pw-shop-qty button:hover:not(:disabled){background:color-mix(in srgb,var(--pw-primary) 10%,#fff);color:var(--pw-primary)}
.pw-shop-cart-remove{min-height:32px;padding:0 6px;border-radius:8px;transition:color .15s ease,background-color .15s ease}
.pw-shop-cart-remove:hover{background:#fef2f2}
.pw-shop-cart-grand{letter-spacing:-.01em}
.pw-shop-cart-summary{box-shadow:0 10px 28px rgba(15,23,42,.06)}

.pw-shop-wallet-hint{margin:0 0 16px}
.pw-shop-wallet-list{display:grid;gap:12px}
.pw-shop-wallet-card{display:grid;gap:6px;padding:16px;border-radius:16px;border:1px dashed color-mix(in srgb,var(--pw-primary) 32%,#d1d5db);background:linear-gradient(135deg,color-mix(in srgb,var(--pw-primary) 8%,#fff),#fff);transition:box-shadow .18s ease,border-color .18s ease}
.pw-shop-wallet-card.is-ineligible{opacity:.72;filter:grayscale(.12)}
@media(hover:hover){.pw-shop-wallet-card:hover{box-shadow:0 10px 22px rgba(15,23,42,.07)}}
.pw-shop-wallet-card-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.pw-shop-wallet-code{display:inline-flex;align-items:center;min-height:32px;padding:4px 10px;border-radius:8px;background:var(--pw-surface,#f3f4f6);font-weight:700;font-family:ui-monospace,Menlo,monospace;letter-spacing:.04em}
.pw-shop-wallet-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:4px}

.pw-shop-deposit{overflow:hidden}
.pw-shop-deposit-qr{background:linear-gradient(180deg,color-mix(in srgb,var(--pw-primary) 8%,#fff),#fff)}
.pw-shop-deposit-qr img{box-shadow:0 10px 28px rgba(15,23,42,.1);border:8px solid #fff}
.pw-shop-deposit-box{transition:border-color .15s ease,box-shadow .15s ease}
.pw-shop-deposit-success-head .mark{box-shadow:0 8px 18px rgba(15,23,42,.12)}
.pw-shop-deposit-center .pw-shop-deposit-spin{width:22px;height:22px;border-width:2.5px}

.pw-shop-address-card,.pw-shop-address-pick-item{transition:border-color .15s ease,box-shadow .15s ease}
@media(hover:hover){
  .pw-shop-address-card:hover,.pw-shop-address-pick-item:hover{box-shadow:0 8px 18px rgba(15,23,42,.06)}
}
.pw-shop-address-foot{margin-top:16px}
.pw-shop-account-link-card{transition:border-color .15s ease,background-color .15s ease,color .15s ease,box-shadow .15s ease}

.pw-shop-notif-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0 4px}
.pw-shop-notif-head h2{margin:0}
.pw-shop-notif-login{text-align:center;padding:32px 8px}
.pw-shop-notif-login p{margin:0 0 12px}
.pw-shop-notif-list{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:10px}
.pw-shop-notif-card{display:grid;gap:6px;width:100%;text-align:left;padding:14px 14px 12px;border:1px solid var(--pw-border,#f3f4f6);border-radius:14px;background:#fff;cursor:pointer;font:inherit;color:inherit;transition:border-color .15s ease,box-shadow .15s ease,background-color .15s ease}
.pw-shop-notif-card.is-unread{background:color-mix(in srgb,var(--pw-primary) 8%,#fff);border-color:color-mix(in srgb,var(--pw-primary) 22%,#fff);font-weight:600}
@media(hover:hover){.pw-shop-notif-card:hover{box-shadow:0 8px 18px rgba(15,23,42,.06);border-color:color-mix(in srgb,var(--pw-primary) 28%,var(--pw-border,#e5e7eb))}}
.pw-shop-notif-card:focus-visible{outline:2px solid color-mix(in srgb,var(--pw-primary) 55%,transparent);outline-offset:2px}
.pw-shop-notif-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.pw-shop-notif-title-row{display:flex;align-items:center;gap:8px;min-width:0}
.pw-shop-notif-dot{width:8px;height:8px;border-radius:999px;background:var(--pw-primary);flex-shrink:0}
.pw-shop-notif-title{display:block;font-weight:inherit}
.pw-shop-notif-time{font-size:12px;font-weight:400;white-space:nowrap}
.pw-shop-notif-body{display:block;margin:0;padding-left:16px;font-weight:400;white-space:pre-line}

.pw-shop-page-status{margin:8px 0 0}

@media(prefers-reduced-motion:reduce){
  .pw-shop-btn,.pw-shop-account-nav-item,.pw-shop-account-hub-row,.pw-shop-account-hub-chevron,.pw-shop-order-card,.pw-shop-cart-row,.pw-shop-wallet-card,.pw-shop-qty button{transition:none}
  .pw-shop-skel::after,.pw-shop-deposit-spin{animation:none}
}
`
