/** Cart page layout that wins over chrome/look CSS. Fit money and buttons; do not clip. */
export const PW_SHOP_CART_PAGE_STYLE_ID = 'pw-shop-cart-page-css'

/** Laptop 1280 / Desktop 1440 — two-column cart. Tablet/mobile stay stacked. */
export const PW_SHOP_CART_WIDE_MQ = '(min-width:1280px)'

export const PW_SHOP_CART_PAGE_CSS = `
.pw-shop[data-pw-page="cart"] .pw-shop-main,
.pw-shop-main:has(.pw-shop-cart),
.pw-shop-account-layout:has(.pw-shop-cart),
.pw-shop-account-content:has(.pw-shop-cart),
.pw-shop-cart,
.pw-shop-cart-layout,
.pw-shop-cart-list,
.pw-shop-cart-summary,
.pw-shop-cart-promo,
.pw-shop-cart .pw-shop-form,
.pw-shop-cart .pw-shop-address-pick{
  min-width:0!important;
  max-width:100%!important;
  width:100%!important;
  overflow-x:visible!important;
}
.pw-shop-account-content:has(.pw-shop-cart){
  padding:8px!important;
  overflow:visible!important;
  overflow-x:visible!important;
  contain:none!important;
  background:var(--pw-surface,#f8fafc)!important;
  border:none!important;
  box-shadow:none!important;
}
.pw-shop-account-content:has(.pw-shop-cart) .pw-shop-form{
  max-width:none!important;
  width:100%!important;
}
.pw-shop-main:has(.pw-shop-cart){
  padding-left:var(--pw-page-gutter,4px)!important;
  padding-right:var(--pw-page-gutter,4px)!important;
}
.pw-shop-cart,.pw-shop-cart *{box-sizing:border-box}
.pw-shop-cart h1{margin:0 0 12px!important;font-size:1.25rem!important}
.pw-shop-cart input:not([type="checkbox"]):not([type="radio"]),
.pw-shop-cart textarea,.pw-shop-cart select{
  min-width:0!important;
  max-width:100%!important;
  width:100%!important;
}
.pw-shop-cart input[type="checkbox"],.pw-shop-cart input[type="radio"]{
  width:18px!important;
  height:18px!important;
  min-width:18px!important;
  max-width:18px!important;
  min-height:18px!important;
  padding:0!important;
  margin-top:3px!important;
  flex-shrink:0!important;
}
.pw-shop-cart-layout{display:grid!important;gap:16px!important;align-items:start!important}
.pw-shop-cart-list,.pw-shop-cart-summary{
  background:#fff!important;
  border:1px solid var(--pw-border,#e5e7eb)!important;
  border-radius:16px!important;
}
.pw-shop-cart-row{
  grid-template-columns:22px 64px minmax(0,1fr)!important;
  align-items:start!important;
  gap:10px!important;
  min-width:0!important;
  max-width:100%!important;
  border-radius:16px!important;
}
.pw-shop-cart-row img,.pw-shop-cart-product-media{width:64px!important;height:64px!important;max-width:64px!important;border-radius:12px!important}
.pw-shop-cart-line-total-wrap{
  grid-column:1/-1!important;
  min-width:0!important;
  width:100%!important;
  display:flex!important;
  flex-wrap:wrap!important;
  justify-content:flex-end!important;
  gap:4px 10px!important;
}
.pw-shop-cart-row[data-pw-cart-qty="1"] .pw-shop-cart-line-total-wrap{display:none!important}
.pw-shop-cart-summary{
  contain:none!important;
  overflow:visible!important;
  width:100%!important;
  max-width:100%!important;
  padding:14px 12px!important;
}
.pw-shop-cart-kv{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(0,max-content)!important;
  gap:6px 8px!important;
  align-items:baseline!important;
  min-width:0!important;
  max-width:100%!important;
  margin:0!important;
  font-size:13px;
}
.pw-shop-cart-kv-k{min-width:0!important;overflow-wrap:anywhere!important;word-break:break-word!important}
.pw-shop-cart-kv-v{
  min-width:0!important;
  max-width:100%!important;
  white-space:normal!important;
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
  font-variant-numeric:tabular-nums;
  text-align:right!important;
  font-weight:700;
}
.pw-shop-cart-kv.is-list .pw-shop-cart-kv-v{color:#9ca3af;font-weight:500;text-decoration:line-through}
.pw-shop-cart-kv.is-flash .pw-shop-cart-kv-k{color:#e11d48}
.pw-shop-cart-kv.is-calendar .pw-shop-cart-kv-k{color:#dc2626}
.pw-shop-cart-kv.is-birthday .pw-shop-cart-kv-k,.pw-shop-cart-kv.is-birthday .pw-shop-cart-kv-v{color:#db2777}
.pw-shop-cart-kv.is-loyalty .pw-shop-cart-kv-k{color:#2563eb}
.pw-shop-cart-kv.is-google .pw-shop-cart-kv-k{color:#059669}
.pw-shop-cart-kv.is-voucher .pw-shop-cart-kv-k{color:#047857}
.pw-shop-cart-discount-breakdown p:not(.pw-shop-cart-section):not(.pw-shop-cart-saved):not(.pw-shop-cart-cap-meter):not(.pw-shop-cart-promo-msg){
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(0,max-content)!important;
  gap:6px 8px!important;
  align-items:baseline!important;
  min-width:0!important;
  max-width:100%!important;
}
.pw-shop-cart-discount-breakdown p span{min-width:0!important;overflow-wrap:anywhere!important;word-break:break-word!important}
.pw-shop-cart-discount-breakdown p strong{
  min-width:0!important;
  max-width:100%!important;
  white-space:normal!important;
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
  text-align:right;
  font-variant-numeric:tabular-nums
}
.pw-shop-cart-stack,
.pw-shop-cart-promo-row,
.pw-shop-cart-summary .pw-shop-address-form-actions,
.pw-shop-cart-actions{
  display:flex!important;
  flex-direction:column!important;
  flex-wrap:nowrap!important;
  align-items:stretch!important;
  gap:8px!important;
  width:100%!important;
  min-width:0!important;
  max-width:100%!important;
}
.pw-shop-cart-promo-row input:not([type="checkbox"]):not([type="radio"]),
.pw-shop-cart-promo-row .pw-shop-price,
.pw-shop-cart-summary .pw-shop-address-form-actions .pw-shop-btn,
.pw-shop-cart-actions .pw-shop-btn,
.pw-shop-cart-actions a.pw-shop-btn,
.pw-shop-cart-summary .pw-shop-btn{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  flex:none!important;
  box-sizing:border-box!important;
}
.pw-shop-cart-summary .pw-shop-btn,
.pw-shop-cart-actions .pw-shop-btn,
.pw-shop-cart-actions a.pw-shop-btn,
.pw-shop-cart-promo-row .pw-shop-btn{
  display:flex!important;
  justify-content:center!important;
  align-items:center!important;
  white-space:nowrap!important;
  overflow:visible!important;
  text-overflow:unset!important;
  text-align:center!important;
  overflow-wrap:normal!important;
  word-break:normal!important;
}
.pw-shop-cart .pw-shop-address-pick-item{
  display:flex!important;
  min-width:0!important;
  max-width:100%!important;
}
.pw-shop-cart .pw-shop-address-pick-item>span{min-width:0!important;overflow-wrap:anywhere!important;word-break:break-word!important}
.pw-shop-cart-saved,.pw-shop-cart-cap-meter,.pw-shop-cart-deposit-note,.pw-shop-cart p.pw-shop-muted,.pw-shop-cart-teaser,.pw-shop-cart-teaser p{
  display:block!important;
  white-space:normal!important;
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
  max-width:100%!important;
}
.pw-shop-cart-grand{
  display:flex!important;
  align-items:baseline!important;
  justify-content:space-between!important;
  gap:12px!important;
  margin:4px 0 0!important;
  padding:10px 0 2px!important;
  border-top:1px solid var(--pw-border,#e5e7eb)!important;
  font-size:15px!important;
  font-weight:700!important;
  max-width:100%!important;
}
.pw-shop-cart-grand span{min-width:0!important;overflow-wrap:anywhere!important}
.pw-shop-cart-grand strong{
  flex:none!important;
  color:var(--pw-buy)!important;
  font-size:1.15em!important;
  font-variant-numeric:tabular-nums;
  white-space:nowrap!important;
}
.pw-shop-cart-summary .pw-sale-count,
.pw-shop-cart-summary [data-pw-sale-count],
.pw-shop-cart .pw-sale-count{
  display:block!important;
  max-width:100%!important;
  white-space:normal!important;
  overflow:visible!important;
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
  font-family:inherit!important;
}
@media ${PW_SHOP_CART_WIDE_MQ}{
  .pw-shop-account-content:has(.pw-shop-cart){padding:16px 20px 28px!important}
  .pw-shop-main:has(.pw-shop-cart){
    padding-left:var(--pw-page-gutter,20px)!important;
    padding-right:var(--pw-page-gutter,20px)!important;
  }
  .pw-shop-cart h1{font-size:1.5rem!important;margin-bottom:16px!important}
  .pw-shop-cart-layout{
    grid-template-columns:minmax(0,1fr) minmax(320px,400px)!important;
    gap:20px!important;
  }
  .pw-shop-cart-summary{
    position:sticky!important;
    top:calc(var(--pw-sticky-head,72px) + 12px)!important;
    padding:18px 16px!important;
  }
  .pw-shop-cart-row{grid-template-columns:24px 72px minmax(0,1fr) minmax(7.5rem,auto)!important;align-items:center!important;gap:14px!important;padding:14px!important}
  .pw-shop-cart-row img,.pw-shop-cart-product-media{width:72px!important;height:72px!important;max-width:72px!important}
  .pw-shop-cart-line-total-wrap{grid-column:auto!important;display:block!important;width:auto!important;padding-top:0!important;margin-top:0!important;border-top:none!important}
  .pw-shop-cart-row[data-pw-cart-qty="1"] .pw-shop-cart-line-total-wrap{display:block!important}
  .pw-shop-cart-promo-row{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) max-content!important;
    align-items:center!important;
    gap:8px!important;
    flex-direction:unset!important;
  }
  .pw-shop-cart-promo-row input:not([type="checkbox"]):not([type="radio"]){
    width:100%!important;
    min-width:0!important;
    flex:unset!important;
  }
  .pw-shop-cart-promo-row .pw-shop-btn,
  .pw-shop-cart-promo-row.pw-shop-cart-stack .pw-shop-btn{
    width:auto!important;
    min-width:max-content!important;
    max-width:none!important;
    flex:none!important;
    padding:8px 14px!important;
  }
  .pw-shop-cart-actions,
  .pw-shop-cart-actions.pw-shop-cart-stack,
  .pw-shop-cart-summary .pw-shop-address-form-actions,
  .pw-shop-cart-summary .pw-shop-address-form-actions.pw-shop-cart-stack{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
    align-items:stretch!important;
    gap:10px!important;
    flex-direction:unset!important;
  }
  .pw-shop-cart-actions .pw-shop-btn,
  .pw-shop-cart-actions a.pw-shop-btn,
  .pw-shop-cart-actions.pw-shop-cart-stack a.pw-shop-btn{
    width:100%!important;
    min-width:0!important;
    flex:none!important;
    white-space:nowrap!important;
  }
  .pw-shop-cart-summary .pw-shop-address-form-actions .pw-shop-btn{
    width:100%!important;
    min-width:0!important;
    flex:none!important;
    white-space:normal!important;
    line-height:1.25!important;
  }
}
`
