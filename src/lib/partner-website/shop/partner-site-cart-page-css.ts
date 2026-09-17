/** Cart page layout that wins over chrome/look CSS. Fit money and buttons; do not clip. */
export const PW_SHOP_CART_PAGE_STYLE_ID = 'pw-shop-cart-page-css'

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
.pw-shop-cart-row{
  grid-template-columns:22px 64px minmax(0,1fr)!important;
  align-items:start!important;
  gap:10px!important;
  min-width:0!important;
  max-width:100%!important;
}
.pw-shop-cart-row img,.pw-shop-cart-product-media{width:64px!important;height:64px!important;max-width:64px!important}
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
  padding:12px 10px!important;
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
.pw-shop-cart-stack>*,
.pw-shop-cart-stack .pw-shop-btn,
.pw-shop-cart-stack input:not([type="checkbox"]):not([type="radio"]),
.pw-shop-cart-stack a.pw-shop-btn,
.pw-shop-cart-promo-row>*,
.pw-shop-cart-promo-row input:not([type="checkbox"]):not([type="radio"]),
.pw-shop-cart-promo-row .pw-shop-btn,
.pw-shop-cart-promo-row .pw-shop-price,
.pw-shop-cart-summary .pw-shop-address-form-actions .pw-shop-btn,
.pw-shop-cart-actions .pw-shop-btn,
.pw-shop-cart-summary .pw-shop-btn{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  flex:none!important;
  box-sizing:border-box!important;
}
.pw-shop-cart-summary .pw-shop-btn,
.pw-shop-cart-actions .pw-shop-btn,
.pw-shop-cart-promo-row .pw-shop-btn{
  display:flex!important;
  justify-content:center!important;
  white-space:normal!important;
  overflow:visible!important;
  text-overflow:unset!important;
  text-align:center!important;
}
.pw-shop-cart .pw-shop-address-pick-item{
  display:flex!important;
  min-width:0!important;
  max-width:100%!important;
}
.pw-shop-cart .pw-shop-address-pick-item>span{min-width:0!important;overflow-wrap:anywhere!important;word-break:break-word!important}
.pw-shop-cart-saved,.pw-shop-cart-cap-meter,.pw-shop-cart-deposit-note,.pw-shop-cart-grand,.pw-shop-cart p.pw-shop-muted,.pw-shop-cart-teaser,.pw-shop-cart-teaser p{
  display:block!important;
  white-space:normal!important;
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
  max-width:100%!important;
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
@media(min-width:1600px){
  .pw-shop-cart-layout{grid-template-columns:minmax(0,1.35fr) minmax(280px,.85fr)!important}
  .pw-shop-cart-row{grid-template-columns:24px 72px minmax(0,1fr) minmax(0,auto)!important;align-items:center!important}
  .pw-shop-cart-row img,.pw-shop-cart-product-media{width:72px!important;height:72px!important;max-width:72px!important}
  .pw-shop-cart-line-total-wrap{grid-column:auto!important;display:block!important;width:auto!important}
  .pw-shop-cart-row[data-pw-cart-qty="1"] .pw-shop-cart-line-total-wrap{display:block!important}
  .pw-shop-cart-promo-row,.pw-shop-cart-actions,.pw-shop-cart-summary .pw-shop-address-form-actions{
    flex-direction:row!important;align-items:center!important
  }
  .pw-shop-cart-promo-row input{flex:1 1 auto!important;width:auto!important}
  .pw-shop-cart-promo-row .pw-shop-btn,.pw-shop-cart-actions .pw-shop-btn,.pw-shop-cart-summary .pw-shop-address-form-actions .pw-shop-btn{
    width:auto!important;flex:1 1 0!important
  }
}
`
