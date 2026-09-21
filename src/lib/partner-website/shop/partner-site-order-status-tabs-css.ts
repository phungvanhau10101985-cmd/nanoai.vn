/** Order status tabs — one swipeable row (Shopee). Engine CSS must win leftover visual HTML. */
export const PW_SHOP_ORDER_STATUS_TABS_STYLE_ID = 'pw-shop-order-status-tabs-css'

export const PW_SHOP_ORDER_STATUS_TABS_CSS = `
.pw-shop .pw-shop-order-filters,.pw-shop-account-content .pw-shop-order-filters{
  display:flex;flex-wrap:nowrap;align-items:stretch;gap:0;width:100%;max-width:100%;min-width:0;
  overflow-x:auto;overflow-y:hidden;padding:0 8px;margin:12px 0 4px;border-bottom:1px solid #e5e7eb;
  scroll-snap-type:x proximity;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-inline:contain
}
.pw-shop .pw-shop-order-filters::-webkit-scrollbar,.pw-shop-account-content .pw-shop-order-filters::-webkit-scrollbar{display:none}
.pw-shop .pw-shop-order-filter-chip,.pw-shop-account-content .pw-shop-order-filter-chip{
  flex:1 0 auto;scroll-snap-align:start;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:4px;min-width:4.75rem;min-height:52px;padding:8px 12px 9px;border:none;border-bottom:2px solid transparent;
  margin-bottom:-1px;border-radius:0;background:transparent;color:#4b5563;font-size:12px;font-weight:500;
  cursor:pointer;white-space:nowrap;text-align:center
}
@media(min-width:768px){
  .pw-shop .pw-shop-order-filter-chip,.pw-shop-account-content .pw-shop-order-filter-chip{font-size:13px;min-width:5.5rem}
}
.pw-shop .pw-shop-order-filter-chip:hover,.pw-shop-account-content .pw-shop-order-filter-chip:hover{
  color:var(--pw-text,#111827);border-color:transparent
}
.pw-shop .pw-shop-order-filter-chip.is-active,.pw-shop-account-content .pw-shop-order-filter-chip.is-active{
  border-color:var(--pw-primary);color:var(--pw-primary);background:transparent
}
.pw-shop .pw-shop-order-filter-badge,.pw-shop-account-content .pw-shop-order-filter-badge{
  min-width:18px;height:16px;padding:0 4px;border-radius:999px;background:var(--pw-buy,var(--pw-primary));
  color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;line-height:1
}
.pw-shop .pw-shop-order-filter-chip.is-active .pw-shop-order-filter-badge,
.pw-shop-account-content .pw-shop-order-filter-chip.is-active .pw-shop-order-filter-badge{
  background:var(--pw-buy,var(--pw-primary));color:#fff
}
@media(max-width:767px){
  .pw-shop .pw-shop-order-filters,.pw-shop-account-content .pw-shop-order-filters{
    margin-left:-10px;margin-right:-10px;padding-left:8px;padding-right:8px
  }
}
.pw-shop .pw-shop-account-hub-order-row{
  display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;overflow-y:hidden;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;overscroll-behavior-inline:contain
}
.pw-shop .pw-shop-account-hub-order-row::-webkit-scrollbar{display:none}
.pw-shop .pw-shop-account-hub-order-chip span:first-child{white-space:nowrap;max-width:none}
`
