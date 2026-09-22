/**
 * Modal chọn Size / Kiểu / Màu / Sort — nút Đóng + backdrop để thoát khi không chọn.
 * Native `<select>` trên mobile không có hủy. Một engine HTML live + React.
 */

export const PW_LISTING_FACET_MODAL_ATTR = 'data-pw-listing-facet-modal'
export const PW_LISTING_FACET_WRAP_ATTR = 'data-pw-listing-facet-wrap'
export const PW_LISTING_FACET_TRIGGER_ATTR = 'data-pw-listing-facet-trigger'

export const PW_LISTING_FACET_PICKER_CLOSE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'

export const PW_LISTING_FACET_PICKER_CSS = `
.pw-listing-facet-wrap{position:relative;display:block;min-width:0;width:100%}
.pw-listing-facet-wrap>select{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;opacity:0!important;pointer-events:none!important}
.pw-shop-filters .pw-listing-facet-trigger,.pw-page-filters .pw-listing-facet-trigger{position:relative;height:32px;border:1px solid var(--pw-border,#d1d5db);border-radius:6px;padding:0 22px 0 6px;font:inherit;font-size:11px;color:var(--pw-text,#111827);background:#fff;min-width:0;width:100%;box-sizing:border-box;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pw-listing-facet-trigger::after{content:"";position:absolute;right:8px;top:50%;width:0;height:0;border:4px solid transparent;border-top-color:#6b7280;margin-top:-1px;pointer-events:none}
@media (min-width:640px){
  .pw-shop-filters .pw-listing-facet-trigger,.pw-page-filters .pw-listing-facet-trigger{font-size:12px;padding:0 24px 0 8px}
  .pw-shop-filters .pw-listing-facet-wrap:has(select[data-pw-el="facet"]),.pw-page-filters .pw-listing-facet-wrap:has(select[data-pw-el="facet"]),.pw-shop-filters .pw-listing-facet-trigger[data-pw-el="facet"],.pw-page-filters .pw-listing-facet-trigger[data-pw-el="facet"]{width:auto;min-width:110px;max-width:200px}
  .pw-shop-filters .pw-listing-facet-wrap:has(select[data-pw-el="sort"]),.pw-page-filters .pw-listing-facet-wrap:has(select[data-pw-el="sort"]),.pw-shop-filters .pw-listing-facet-trigger[data-pw-el="sort"],.pw-page-filters .pw-listing-facet-trigger[data-pw-el="sort"]{width:auto;min-width:150px}
}
[${PW_LISTING_FACET_MODAL_ATTR}]{position:fixed;inset:0;z-index:100050;display:flex;align-items:flex-end;justify-content:center;padding:0;box-sizing:border-box}
[${PW_LISTING_FACET_MODAL_ATTR}][hidden]{display:none!important}
[${PW_LISTING_FACET_MODAL_ATTR}-backdrop]{position:absolute;inset:0;border:0;padding:0;margin:0;background:rgba(15,23,42,.48);cursor:pointer}
[${PW_LISTING_FACET_MODAL_ATTR}-card]{position:relative;z-index:1;width:100%;max-height:min(72dvh,560px);display:flex;flex-direction:column;overflow:hidden;padding:0;border-radius:16px 16px 0 0;background:#fff;box-shadow:0 -10px 40px rgba(15,23,42,.18)}
[${PW_LISTING_FACET_MODAL_ATTR}-head]{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 12px 12px 16px;border-bottom:1px solid var(--pw-border,#e5e7eb);flex-shrink:0}
[${PW_LISTING_FACET_MODAL_ATTR}-title]{margin:0;font:700 16px/1.3 system-ui,sans-serif;color:var(--pw-text,#111827)}
[${PW_LISTING_FACET_MODAL_ATTR}-close]{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border:0;border-radius:10px;background:transparent;color:#6b7280;cursor:pointer;padding:0}
[${PW_LISTING_FACET_MODAL_ATTR}-close]:hover{background:var(--pw-surface,#f3f4f6);color:#111827}
[${PW_LISTING_FACET_MODAL_ATTR}-close] svg{width:20px;height:20px}
[${PW_LISTING_FACET_MODAL_ATTR}-list]{overflow:auto;padding:8px 8px calc(12px + env(safe-area-inset-bottom,0px));-webkit-overflow-scrolling:touch}
.pw-listing-facet-option{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;padding:10px 12px;border:0;border-radius:10px;background:transparent;color:var(--pw-text,#111827);font:inherit;font-size:15px;text-align:left;cursor:pointer}
.pw-listing-facet-option:hover{background:var(--pw-surface,#f9fafb)}
.pw-listing-facet-option.is-selected{color:var(--pw-primary);font-weight:700;background:color-mix(in srgb,var(--pw-primary) 8%,transparent)}
html[data-pw-listing-facet-open="1"],html[data-pw-listing-facet-open="1"] body{overflow:hidden}
@media(min-width:768px){
  [${PW_LISTING_FACET_MODAL_ATTR}]{align-items:center;padding:24px}
  [${PW_LISTING_FACET_MODAL_ATTR}-card]{width:min(420px,94vw);max-height:min(70vh,560px);border-radius:16px}
}
html[data-pw-edit-device="mobile"] [${PW_LISTING_FACET_MODAL_ATTR}],html[data-pw-scene-lock="mobile"] [${PW_LISTING_FACET_MODAL_ATTR}]{align-items:flex-end;padding:0}
html[data-pw-edit-device="mobile"] [${PW_LISTING_FACET_MODAL_ATTR}-card],html[data-pw-scene-lock="mobile"] [${PW_LISTING_FACET_MODAL_ATTR}-card]{width:100%;border-radius:16px 16px 0 0}
html[data-pw-edit-device="tablet"] [${PW_LISTING_FACET_MODAL_ATTR}],html[data-pw-scene-lock="tablet"] [${PW_LISTING_FACET_MODAL_ATTR}],html[data-pw-edit-device="laptop"] [${PW_LISTING_FACET_MODAL_ATTR}],html[data-pw-scene-lock="laptop"] [${PW_LISTING_FACET_MODAL_ATTR}],html[data-pw-edit-device="desktop"] [${PW_LISTING_FACET_MODAL_ATTR}],html[data-pw-scene-lock="desktop"] [${PW_LISTING_FACET_MODAL_ATTR}]{align-items:center;padding:24px}
html[data-pw-edit-device="tablet"] [${PW_LISTING_FACET_MODAL_ATTR}-card],html[data-pw-scene-lock="tablet"] [${PW_LISTING_FACET_MODAL_ATTR}-card],html[data-pw-edit-device="laptop"] [${PW_LISTING_FACET_MODAL_ATTR}-card],html[data-pw-scene-lock="laptop"] [${PW_LISTING_FACET_MODAL_ATTR}-card],html[data-pw-edit-device="desktop"] [${PW_LISTING_FACET_MODAL_ATTR}-card],html[data-pw-scene-lock="desktop"] [${PW_LISTING_FACET_MODAL_ATTR}-card]{width:min(420px,94vw);border-radius:16px}
`
