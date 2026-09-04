import { PW_BG_CLEARED_CSS, PW_PAPER_CSS } from '@/lib/partner-website/visual-editor/pw-bg-stack'
import { PW_CHROME_COUNT_BADGE_HIDE_CSS } from '@/lib/partner-website/shop/chrome-count-badges'
import {
  PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT,
  PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID,
} from '@/lib/partner-website/shop/pin-chrome-icon-badges'
import {
  PARTNER_SHOP_STICK_HEADER_CSS,
  PARTNER_SHOP_STICK_HEADER_SCRIPT,
  PARTNER_SHOP_STICK_HEADER_SCRIPT_ID,
} from '@/lib/partner-website/shop/stick-header-elements'
import {
  PARTNER_SHOP_CHROME_FLOAT_CSS,
  PARTNER_SHOP_CHROME_FLOAT_SCRIPT,
  PW_CHROME_FLOAT_SCRIPT_ID,
} from '@/lib/partner-website/shop/chrome-float-widgets'
import {
  PARTNER_SHOP_HIDDEN_CSS,
  PARTNER_SHOP_STAY_SCROLL_CSS,
  PARTNER_SHOP_STAY_SCROLL_SCRIPT,
  PW_STAY_SCROLL_SCRIPT_ID,
} from '@/lib/partner-website/shop/stay-scroll-elements'
import {
  PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT,
  PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT_ID,
  PW_MOBILE_HEADER_ICON_ONLY_RULES,
  PW_ESCAPED_HEAD_CHROME_HIDE_CSS,
  PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS,
  PW_MOBILE_HEADER_PDP_LEFTOVER_HIDE_CSS,
  PW_MOBILE_HEADER_STACK_RULES,
  PW_MOBILE_HEADER_STACK_WIN_CSS,
  PW_MOBILE_HEADER_TOPBAR_HIDE_CSS,
} from '@/lib/partner-website/shop/mobile-header-logo-collapse'
import {
  PARTNER_SHOP_LISTING_HEAD_SCRIPT,
  PARTNER_SHOP_LISTING_HEAD_SCRIPT_ID,
  PW_LISTING_HEAD_CSS,
} from '@/lib/partner-website/shop/listing-head'
import { PARTNER_SHOP_CHROME_KIT_CSS } from '@/lib/partner-website/shop/partner-site-chrome-kit'
import { injectPartnerShopFontsIntoHtml } from '@/lib/partner-website/shop/inject-partner-shop-fonts'
import { PW_OUTFIT_CSS } from '@/lib/partner-website/shop/outfit-products-css'
import { PW_FEATURED_CATEGORIES_CSS } from '@/lib/partner-website/shop/featured-categories-css'
import { PW_PRODUCT_GRID_RULER_CSS } from '@/lib/partner-website/shop/pw-product-grid-ruler'
import { PW_RELATED_CSS } from '@/lib/partner-website/shop/related-products-css'
import {
  PARTNER_SHOP_IMAGE_ZOOM_SCRIPT,
  PARTNER_SHOP_IMAGE_ZOOM_SCRIPT_ID,
  PARTNER_SHOP_SCENE_CENTER_SCRIPT,
  PARTNER_SHOP_SCENE_CENTER_SCRIPT_ID,
  pwSceneCenterCss,
  pwSceneUnifiedStackCss,
  pwHostPrefixCss,
  pwSceneChromeAddedVisibilityCss,
  pwSceneDeviceVisibilityCss,
  PW_SCENE_COMPACT_HOSTS,
  PW_SCENE_DESKTOP_HOSTS,
  PW_SCENE_LAPTOP_HOSTS,
  PW_SCENE_PHONE_HOSTS,
  PW_SCENE_TABLET_HOSTS,
  PW_SCENE_UNLOCKED_HTML,
  PW_SCENE_WIDE_HOSTS,
  PARTNER_SHOP_AUTHORED_BLOCK_CSS,
  PARTNER_SHOP_BANNER_LIVE_MATCH_CSS,
  PARTNER_SHOP_BANNER_MEDIA_FILL_CSS,
  PARTNER_SHOP_HROW_CSS,
  PARTNER_SHOP_MID_INSERT_GAP_CSS,
  PARTNER_SHOP_PAGE_FIT_CSS,
  PARTNER_SHOP_STACK_FLOW_CSS,
  PW_SCENE_HEAD_Z,
  PW_SCENE_LOGO_Z,
  PW_SCENE_TOPBAR_Z,
} from '@/lib/partner-website/visual-editor/pw-scene'
import { PARTNER_SHOP_SLIDER_CSS } from '@/lib/partner-website/visual-editor/pw-slider-runtime'
import {
  PW_CHROME_BTN_MIN_H,
  PW_CHROME_H_VAR,
  PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS,
  PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS,
  PW_CHROME_NOT_ICON_ONLY_SEL,
  PW_CHROME_TOKEN_VARS_CSS,
  PW_CHROME_W_VAR,
  PW_STOCK_CHROME_EDIT_CSS,
  PW_CHROME_LABELED_MIN_W_CSS,
  PW_CHROME_ICON_CIRCLE_CSS,
  PW_CHROME_ICON_SQUARE_CSS,
  PW_CHROME_LABEL_FACE_CSS,
  PW_CHROME_FACE_EXTRAS_CSS,
  PW_CHROME_LABEL_BELOW_CSS,
  PW_LEAD_COUPON_CSS,
  PW_SEARCH_IMAGE_IN_FORM_BTN_CSS,
  PW_SEARCH_IMAGE_IN_FORM_WRAP_CSS,
} from '@/lib/partner-website/visual-editor/chrome-widgets'
import {
  PW_DOCK_BAR_MIN_H,
  PW_HEAD_ICON_SIZE,
  PW_HEAD_KIT_GAP,
  PW_PDP_DOCK_GLYPH,
  PW_SEARCH_FORM_HEIGHT,
  PW_SEARCH_ICON_SIZE,
} from '@/lib/partner-website/shop/chrome-rhythm'

/** Live mobile: tap logo / Chat mua like a button, not a dragged image. */
export const PARTNER_SHOP_TAP_CHROME_CSS = `
a.pw-brand,a.pw-shop-brand,[data-pw-chrome-btn],[data-nanoai-open-chat],.pw-chat-open{
-webkit-tap-highlight-color:transparent;
-webkit-touch-callout:none;
touch-action:manipulation;
}
a.pw-brand img,a.pw-shop-brand img,.pw-logo,.pw-chrome-chat-logo,[data-pw-chrome-btn] img,[data-nanoai-open-chat] img{
-webkit-user-drag:none;
user-select:none;
pointer-events:none;
}
`

/** Persistent chrome layout — same rules Sửa nhanh uses, kept on the live shop. */
export const PARTNER_SHOP_SEARCH_HISTORY_CSS = `
.pw-header-search,.pw-shop-search-wrap,[data-pw-el="search"]{overflow:visible!important}
.pw-header-search > .pw-search-form,.pw-shop-search-wrap > .pw-shop-search-form,.pw-header-search > [data-pw-search-form]{flex:1 1 auto!important;width:100%!important;min-width:0!important}
[data-pw-search-history]{position:absolute;left:0;right:0;top:100%;margin-top:4px;z-index:400;display:block;width:100%;min-width:0;max-height:min(320px,70vh);overflow-x:hidden;overflow-y:auto;box-sizing:border-box;background:#fff;color:var(--pw-text,#111);border:1px solid var(--pw-border,#e5e7eb);border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.16)}
[data-pw-search-history][hidden]{display:none!important}
[data-pw-search-history-head]{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--pw-border,#e5e7eb);font:600 12px/1.3 var(--pw-font-ui),system-ui,sans-serif;color:var(--pw-text,#111)}
[data-pw-search-history-empty]{margin:0;padding:16px 12px;text-align:center;font:12px/1.4 var(--pw-font-ui),system-ui,sans-serif;color:var(--pw-muted,#6b7280)}
[data-pw-search-history-item]{display:flex;align-items:center;gap:4px;padding:0 4px}
[data-pw-search-history-q]{flex:1 1 auto;min-width:0;min-height:40px;text-align:left;text-decoration:none;font:14px/1.3 var(--pw-font-ui),system-ui,sans-serif;color:var(--pw-text,#111);background:none;border:none;cursor:pointer;padding:8px 8px;border-radius:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
[data-pw-search-history-q]:hover{background:var(--pw-surface,#f3f4f6);color:var(--pw-primary)!important}
[data-pw-search-history-x]{flex:0 0 auto;width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:var(--pw-muted,#6b7280);cursor:pointer;font-size:18px;line-height:1}
[data-pw-search-history-x]:hover{background:var(--pw-surface,#f3f4f6);color:var(--pw-text,#111)}
[data-pw-search-history-clear]{display:block;width:calc(100% - 16px);margin:8px;min-height:36px;border:0;border-radius:8px;background:transparent;color:var(--pw-muted,#6b7280);cursor:pointer;font:600 12px/1.3 var(--pw-font-ui),system-ui,sans-serif}
[data-pw-search-history-clear]:hover{background:var(--pw-surface,#f3f4f6);color:#b91c1c}
body.nanoai-ve-active [data-pw-search-history]{display:none!important}
`.trim()

export const PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID = 'pw-shop-chrome-layout'

/**
 * Footer columns / policy links stay in document flow.
 * Chrome-btn stamp + leftover drag `top/left` must not stack lines on mobile.
 */
export const PARTNER_SHOP_FOOTER_INFLOW_CSS = `
html .pw-footer-col,html .pw-shop-footer-col,html .pw-footer-col ul,html .pw-shop-footer-col ul{
  position:relative!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;
  height:auto!important;min-height:0!important;overflow:visible!important;transform:none!important
}
html .pw-footer-col a:not([data-pw-hidden="1"]):not([data-pw-chrome-added]):not([data-pw-chrome-float]):not([data-pw-pin-screen]):not([data-pw-el="logo"]):not(.pw-brand):not(.pw-shop-brand),
html .pw-shop-footer-col a:not([data-pw-hidden="1"]):not([data-pw-chrome-added]):not([data-pw-chrome-float]):not([data-pw-pin-screen]):not([data-pw-el="logo"]):not(.pw-brand):not(.pw-shop-brand),
html .pw-footer-col li:not([data-pw-hidden="1"]),html .pw-shop-footer-col li:not([data-pw-hidden="1"]),
html .pw-footer-col h3,html .pw-shop-footer-col h3,
html .pw-footer-bar a,html .pw-footer-bar p,html .pw-footer-bar span,
html .pw-shop-footer-bar a,html .pw-shop-footer-bar p,html .pw-shop-footer-bar span,
html .pw-footer-bottom a,html .pw-footer-bottom span,html .pw-footer-bottom p{
  position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;
  inset:auto!important;transform:none!important;float:none!important;
  display:block!important;width:auto!important;max-width:100%!important;
  height:auto!important;max-height:none!important;min-height:1.45em!important;
  line-height:1.45!important;white-space:normal!important;margin-left:0!important;margin-right:0!important
}
html .pw-footer-col [data-pw-hidden="1"],html .pw-shop-footer-col [data-pw-hidden="1"],
html .pw-footer-col li:has(>[data-pw-hidden="1"]),html .pw-shop-footer-col li:has(>[data-pw-hidden="1"]),
html .pw-footer-bar [data-pw-hidden="1"],html .pw-shop-footer-bar [data-pw-hidden="1"],
html .pw-footer-bottom [data-pw-hidden="1"]{display:none!important}
html .pw-footer-bar a.pw-shop-footer-moit,html .pw-shop-footer-bar a.pw-shop-footer-moit,html .pw-footer-bottom a.pw-shop-footer-moit{
  display:inline-flex!important;align-items:center!important;justify-content:center!important;
  width:fit-content!important;max-width:100%!important;margin-top:10px!important;padding:8px 12px!important;
  border:1px solid var(--pw-border)!important;border-radius:8px!important;
  background:var(--pw-surface)!important;color:var(--pw-text)!important;
  font-size:12px!important;font-weight:600!important;line-height:1.35!important;text-decoration:none!important
}
html .pw-footer-bar a.pw-shop-footer-moit:hover,html .pw-shop-footer-bar a.pw-shop-footer-moit:hover,html .pw-footer-bottom a.pw-shop-footer-moit:hover{
  color:var(--pw-primary)!important;border-color:var(--pw-primary)!important
}
html .pw-footer:not([data-pw-bg-cleared="1"]):not([data-pw-paper="image"]),html .pw-shop-footer:not([data-pw-bg-cleared="1"]):not([data-pw-paper="image"]){background:var(--pw-footer,#fff)!important}
html [data-pw-footer-added]{
  position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;
  inset:auto!important;transform:none!important;float:none!important;z-index:auto!important
}
html .pw-shop-footer-inner>[data-pw-footer-added],html .pw-footer-grid>[data-pw-footer-added]{min-width:0;align-self:start}
html footer [data-pw-footer-added][data-pw-added-text],html footer [data-pw-footer-added][data-pw-added-text-slot],
html .pw-footer [data-pw-footer-added][data-pw-added-text],html .pw-shop-footer [data-pw-footer-added][data-pw-added-text-slot]{
  font-size:14px!important;font-weight:600!important;line-height:1.45!important;color:inherit;white-space:normal!important
}
html footer [data-pw-footer-added][data-pw-added-btn-slot],html .pw-footer [data-pw-footer-added][data-pw-added-btn-slot],
html .pw-shop-footer [data-pw-footer-added][data-pw-added-btn-slot]{padding:0!important;text-align:left!important;width:auto!important}
html .pw-footer-grid,html .pw-shop-footer-inner{display:grid!important;height:auto!important;gap:28px 32px!important}
html[data-pw-edit-device="mobile"] .pw-footer-grid,html[data-pw-edit-device="mobile"] .pw-shop-footer-inner,
html[data-pw-scene-lock="mobile"] .pw-footer-grid,html[data-pw-scene-lock="mobile"] .pw-shop-footer-inner{grid-template-columns:1fr!important;gap:20px!important}
html[data-pw-edit-device="tablet"] .pw-footer-grid,html[data-pw-edit-device="tablet"] .pw-shop-footer-inner,
html[data-pw-scene-lock="tablet"] .pw-footer-grid,html[data-pw-scene-lock="tablet"] .pw-shop-footer-inner{grid-template-columns:repeat(2,minmax(0,1fr))!important}
html[data-pw-edit-device="laptop"] .pw-footer-grid,html[data-pw-edit-device="laptop"] .pw-shop-footer-inner,
html[data-pw-edit-device="desktop"] .pw-footer-grid,html[data-pw-edit-device="desktop"] .pw-shop-footer-inner,
html[data-pw-scene-lock="laptop"] .pw-footer-grid,html[data-pw-scene-lock="laptop"] .pw-shop-footer-inner,
html[data-pw-scene-lock="desktop"] .pw-footer-grid,html[data-pw-scene-lock="desktop"] .pw-shop-footer-inner{
  grid-template-columns:minmax(200px,1.25fr) repeat(4,minmax(0,1fr))!important
}
@media (max-width:767px){
html:not([data-pw-edit-device="tablet"]):not([data-pw-edit-device="laptop"]):not([data-pw-edit-device="desktop"]) .pw-footer-grid,
html:not([data-pw-edit-device="tablet"]):not([data-pw-edit-device="laptop"]):not([data-pw-edit-device="desktop"]) .pw-shop-footer-inner{grid-template-columns:1fr!important}
}
`.trim()

/** Clamp leftover logo coords so the box stays inside the device width. */
export const PARTNER_SHOP_LOGO_HOST_SCRIPT_ID = 'pw-shop-logo-host'
export const PARTNER_SHOP_LOGO_HOST_SCRIPT = `(function(){
  function headerMainOf(el){
    var header=el&&el.closest?el.closest('header,.pw-header,.pw-shop-header'):null;
    return header&&header.querySelector?(header.querySelector('.pw-header-main,.pw-shop-header-inner')||header):header;
  }
  function rebaseToHeaderMain(el){
    if(!el||!el.style)return;
    var host=headerMainOf(el);
    if(!host||el.parentNode===host)return;
    var r=null,hr=null;
    try{r=el.getBoundingClientRect();hr=host.getBoundingClientRect();}catch(eBox){}
    try{host.appendChild(el);}catch(eMove){return;}
    if(r&&hr){
      el.style.setProperty('left',Math.max(0,Math.round(r.left-hr.left))+'px','important');
      el.style.setProperty('top',Math.max(0,Math.round(r.top-hr.top))+'px','important');
      el.style.removeProperty('right');
      el.style.removeProperty('bottom');
      el.style.removeProperty('transform');
    }
  }
  function clamp(){
    var viewW=document.documentElement.clientWidth||window.innerWidth||0;
    var sceneW=parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--pw-scene-w'))||0;
    if(sceneW>0)viewW=Math.min(viewW,sceneW);
    var logos=document.querySelectorAll('[data-pw-logo-float="1"]');
    for(var i=0;i<logos.length;i++){
      var el=logos[i];
      if(!el||!el.style)continue;
      rebaseToHeaderMain(el);
      var left=parseFloat(el.style.left);
      var top=parseFloat(el.style.top);
      var w=parseFloat(el.style.width)||0;
      var z=el.getAttribute('data-pw-z');
      if(z)el.style.setProperty('z-index',z,'important');
      if(isFinite(left)&&left<0)el.style.setProperty('left','0px','important');
      if(isFinite(top)&&top<0)el.style.setProperty('top','0px','important');
      if(viewW>0&&isFinite(left)&&w>0&&left+w>viewW){
        el.style.setProperty('left',Math.max(0,Math.round(viewW-w))+'px','important');
      }
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clamp);
  else clamp();
  window.addEventListener('resize',clamp);
})();`

/** Compact header (Sửa nhanh Mobile/Tablet). Live khóa cùng máy phải cùng mặt — không chờ tab hẹp. */
const PW_COMPACT_HEADER_RULES = `
.pw-header-main,.pw-shop-header-inner{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;column-gap:6px!important;padding:8px 10px!important}
.pw-header-main,.pw-shop-header-inner{overflow:visible!important;min-width:0!important;max-width:100%!important}
.pw-brand-cluster,.pw-shop-brand-cluster{flex:0 0 auto!important;width:auto!important;max-width:200px!important;overflow:visible!important}
.pw-header a.pw-brand:not([data-pw-logo-float]),.pw-shop-header a.pw-shop-brand:not([data-pw-logo-float]),.pw-header a[data-pw-logo-home]:not([data-pw-logo-float]),.pw-shop-header a[data-pw-logo-home]:not([data-pw-logo-float]){max-width:none!important;overflow:visible!important;transform:translate(var(--pw-logo-x, 0px), var(--pw-logo-y, 0px))!important}
.pw-header a.pw-brand:has(img:not([data-pw-logo-empty])) .pw-wordmark,.pw-shop-header a.pw-shop-brand:has(img:not([data-pw-logo-empty])) .pw-wordmark,.pw-header a[data-pw-logo-home]:has(img:not([data-pw-logo-empty])) .pw-wordmark{display:none!important}
.pw-header-search,.pw-shop-search-wrap{flex:1 1 0%!important;width:auto!important;min-width:96px!important;max-width:100%!important;margin:0!important;min-height:${PW_SEARCH_FORM_HEIGHT.mobile}px!important;transform:none!important;position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;opacity:1!important;visibility:visible!important;z-index:170!important;display:flex!important}
.pw-header-search[data-pw-search-width],.pw-shop-search-wrap[data-pw-search-width]{flex:1 1 0%!important;width:auto!important;min-width:96px!important;max-width:100%!important}
.pw-header-actions,.pw-shop-header-actions{flex:0 0 auto!important;display:flex!important;flex-wrap:nowrap!important;width:auto!important;max-width:none!important;margin-left:auto!important;gap:var(--pw-kit-gap, ${PW_HEAD_KIT_GAP.mobile}px)!important}
.pw-nav-main,.pw-shop-nav-row{display:none!important}
.pw-seo-row:not(:empty):not([hidden]){display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important}
.pw-seo-row:empty,.pw-seo-row[hidden],[data-pw-seo-row]:empty,[data-pw-seo-row][hidden]{display:none!important;height:0!important;min-height:0!important;max-height:0!important;padding:0!important;margin:0!important;overflow:hidden!important;border:0!important}
.pw-topbar,.pw-shop-topbar{display:none!important}
.pw-header,.pw-shop-header{background:var(--pw-primary)!important;border:none!important;box-shadow:0 6px 18px color-mix(in srgb, var(--pw-primary) 35%, transparent)!important}
.pw-wordmark,.pw-brand,.pw-shop-brand{color:#fff!important}
.pw-header-actions .pw-icon-btn:not([data-pw-chrome-float]),.pw-shop-header-actions .pw-icon-btn:not([data-pw-chrome-float]),.pw-header-actions [data-pw-chrome-kit="1"],.pw-shop-header-actions [data-pw-chrome-kit="1"],.pw-header-actions .pw-account-btn,.pw-shop-header-actions .pw-account-btn,.pw-header .pw-account-btn,.pw-shop-header .pw-account-btn{color:#fff!important}
.pw-search-form,.pw-shop-search-form{border:none!important;height:${PW_SEARCH_FORM_HEIGHT.mobile}px!important;background:#fff!important;box-shadow:0 2px 8px rgba(15,23,42,.10)!important}
`.trim()

const PW_PHONE_HEADER_FACE_RULES = `
.pw-cat-btn:not([data-pw-chrome-added]),.pw-shop-cat-btn:not([data-pw-chrome-added]),.pw-brand-cluster [data-pw-chrome-btn="categories"],.pw-shop-brand-cluster [data-pw-chrome-btn="categories"]{width:40px!important;height:40px!important;min-width:40px!important;padding:0!important;justify-content:center!important;gap:0!important;border:1.5px solid rgba(255,255,255,.55)!important;background:rgba(255,255,255,.16)!important;color:#fff!important;border-radius:10px!important}
.pw-cat-btn:not([data-pw-chrome-added])>span:not(.pw-chrome-icon-wrap),.pw-shop-cat-btn:not([data-pw-chrome-added])>span:not(.pw-chrome-icon-wrap),.pw-brand-cluster [data-pw-chrome-btn="categories"]>span:not(.pw-chrome-icon-wrap),.pw-shop-brand-cluster [data-pw-chrome-btn="categories"]>span:not(.pw-chrome-icon-wrap){display:none!important}
.pw-cat-btn:not([data-pw-chrome-style="text"]):not(.pw-chrome-link) .pw-chrome-icon-wrap,.pw-shop-cat-btn:not([data-pw-chrome-style="text"]):not(.pw-chrome-link) .pw-chrome-icon-wrap,[data-pw-el="cat-toggle"]:not([data-pw-chrome-style="text"]):not(.pw-chrome-link) .pw-chrome-icon-wrap{display:inline-flex!important;visibility:visible!important;opacity:1!important;width:20px!important;height:20px!important;min-width:20px!important;min-height:20px!important}
.pw-cat-btn:not([data-pw-chrome-style="text"]):not(.pw-chrome-link) svg,.pw-shop-cat-btn:not([data-pw-chrome-style="text"]):not(.pw-chrome-link) svg,[data-pw-el="cat-toggle"]:not([data-pw-chrome-style="text"]):not(.pw-chrome-link) svg{display:block!important;visibility:visible!important;opacity:1!important;width:20px!important;height:20px!important;max-width:20px!important;max-height:20px!important;stroke:currentColor!important;fill:none!important;stroke-width:2!important}
.pw-search-submit .pw-shop-search-submit-label,.pw-shop-search-submit .pw-shop-search-submit-label{display:none!important;font-size:0!important}
.pw-search-submit,.pw-shop-search-submit{min-width:${PW_SEARCH_FORM_HEIGHT.mobile}px!important;padding:0 10px!important}
.pw-brand-cluster,.pw-shop-brand-cluster{max-width:90px!important;gap:6px!important}
.pw-header-actions,.pw-shop-header-actions{flex:0 0 auto!important;min-width:36px!important;max-width:46%!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none}
.pw-header-actions::-webkit-scrollbar,.pw-shop-header-actions::-webkit-scrollbar{width:0;height:0}
.pw-header-actions [data-pw-chrome-btn="cart"],.pw-shop-header-actions [data-pw-chrome-btn="cart"]{order:-1!important}
.pw-header-actions [data-pw-chrome-kit="1"] .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-kit="1"] .pw-chrome-btn-label,.pw-header-actions [data-pw-chrome-kit="1"] .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-kit="1"] .pw-shop-nav-label,.pw-header-actions [data-pw-chrome-kit="1"] .pw-account-btn-label,.pw-shop-header-actions [data-pw-chrome-kit="1"] .pw-account-btn-label{display:none!important}
.pw-header-actions [data-pw-chrome-kit="1"],.pw-shop-header-actions [data-pw-chrome-kit="1"]{min-width:44px!important;min-height:44px!important;padding:6px!important}
`.trim()

const PW_TABLET_HEADER_FACE_RULES = `
.pw-cat-btn:not([data-pw-chrome-added])${PW_CHROME_NOT_ICON_ONLY_SEL},.pw-shop-cat-btn:not([data-pw-chrome-added])${PW_CHROME_NOT_ICON_ONLY_SEL},.pw-brand-cluster [data-pw-chrome-btn="categories"]${PW_CHROME_NOT_ICON_ONLY_SEL},.pw-shop-brand-cluster [data-pw-chrome-btn="categories"]${PW_CHROME_NOT_ICON_ONLY_SEL}{height:34px!important;padding:0 10px!important;border:1.5px solid rgba(255,255,255,.55)!important;background:rgba(255,255,255,.16)!important;color:#fff!important;border-radius:999px!important;gap:6px!important}
.pw-cat-btn:not([data-pw-chrome-added])${PW_CHROME_NOT_ICON_ONLY_SEL}>span:not(.pw-chrome-icon-wrap),.pw-shop-cat-btn:not([data-pw-chrome-added])${PW_CHROME_NOT_ICON_ONLY_SEL}>span:not(.pw-chrome-icon-wrap){display:inline!important;font-size:12px!important;font-weight:700!important;color:#fff!important}
.pw-search-submit .pw-shop-search-submit-label,.pw-shop-search-submit .pw-shop-search-submit-label{display:none!important;font-size:0!important}
`.trim()

export const PARTNER_SHOP_MOBILE_HEADER_SEARCH_LOCK_CSS = [
  pwHostPrefixCss(PW_SCENE_COMPACT_HOSTS, PW_COMPACT_HEADER_RULES),
  pwHostPrefixCss(PW_SCENE_PHONE_HOSTS, PW_PHONE_HEADER_FACE_RULES),
  pwHostPrefixCss(PW_SCENE_PHONE_HOSTS, PW_MOBILE_HEADER_STACK_RULES),
  pwHostPrefixCss(PW_SCENE_PHONE_HOSTS, PW_MOBILE_HEADER_ICON_ONLY_RULES),
  pwHostPrefixCss(PW_SCENE_TABLET_HOSTS, PW_TABLET_HEADER_FACE_RULES),
  pwHostPrefixCss(
    PW_SCENE_WIDE_HOSTS,
    '.pw-nav-main,.pw-shop-nav-row{display:flex!important;flex-wrap:nowrap!important;justify-content:center!important;align-items:center!important}.pw-header,.pw-shop-header{background:#fff!important;border-bottom:1px solid #f3f4f6!important;box-shadow:none!important}'
  ),
  `@media (max-width:899px){${pwHostPrefixCss([PW_SCENE_UNLOCKED_HTML], PW_COMPACT_HEADER_RULES)}${pwHostPrefixCss([PW_SCENE_UNLOCKED_HTML], PW_PHONE_HEADER_FACE_RULES)}}`,
  `@media (max-width:767px){${pwHostPrefixCss([PW_SCENE_UNLOCKED_HTML], PW_MOBILE_HEADER_STACK_RULES)}${pwHostPrefixCss([PW_SCENE_UNLOCKED_HTML], PW_MOBILE_HEADER_ICON_ONLY_RULES)}}`,
  PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS,
  PW_MOBILE_HEADER_PDP_LEFTOVER_HIDE_CSS,
  PW_ESCAPED_HEAD_CHROME_HIDE_CSS,
  PW_LISTING_HEAD_CSS,
].join('')

/** Desktop/Laptop: Danh mục trái | logo mép phải cách ô tìm 50px | ô tìm neo giữa | icon phải. */
export const PW_WIDE_HEADER_BALANCE_RULES = `
.pw-header-main,.pw-shop-header-inner{justify-content:flex-start!important;align-items:center!important;gap:8px!important;position:relative!important}
.pw-brand-cluster,.pw-shop-brand-cluster{flex:0 0 auto!important;width:auto!important;min-width:0!important;max-width:none!important;justify-content:flex-start!important;position:static!important}
.pw-header-main a.pw-brand,.pw-header-main a.pw-shop-brand,.pw-header-main a[data-pw-logo-home],.pw-shop-header-inner a.pw-brand,.pw-shop-header-inner a.pw-shop-brand,.pw-shop-header-inner a[data-pw-logo-home],.pw-header-main .pw-brand-cluster>.pw-logo-frame,.pw-header-main .pw-shop-brand-cluster>.pw-logo-frame,.pw-shop-header-inner .pw-brand-cluster>.pw-logo-frame,.pw-shop-header-inner .pw-shop-brand-cluster>.pw-logo-frame,.pw-header-main .pw-brand-cluster>[data-pw-logo-frame="1"],.pw-header-main .pw-shop-brand-cluster>[data-pw-logo-frame="1"],.pw-shop-header-inner .pw-brand-cluster>[data-pw-logo-frame="1"],.pw-shop-header-inner .pw-shop-brand-cluster>[data-pw-logo-frame="1"]{position:absolute!important;left:calc(50% - 190px - 50px + var(--pw-logo-x, 0px))!important;top:calc(50% + var(--pw-logo-y, 0px))!important;right:auto!important;bottom:auto!important;transform:translate(-100%, -50%)!important;margin:0!important;z-index:126!important;flex:0 0 auto!important}
.pw-header-search:not([data-pw-stay-scroll]),.pw-shop-search-wrap:not([data-pw-stay-scroll]){position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;flex:0 0 auto!important;width:100%!important;min-width:180px!important;max-width:380px!important;margin:0!important;z-index:125!important}
.pw-header-search[data-pw-search-width-user="1"],.pw-shop-search-wrap[data-pw-search-width-user="1"]{flex:0 0 auto!important;max-width:none!important}
.pw-header-actions,.pw-shop-header-actions{flex:1 1 0%!important;min-width:0!important;max-width:none!important;display:flex!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-end!important;margin-left:0!important;margin-right:0!important;gap:var(--pw-kit-gap, ${PW_HEAD_KIT_GAP.desktop}px)!important;transform:translateX(var(--pw-kit-x, 0px))!important}
.pw-header-actions [data-pw-chrome-kit="1"],.pw-shop-header-actions [data-pw-chrome-kit="1"],.pw-header-actions [data-pw-chrome-btn],.pw-shop-header-actions [data-pw-chrome-btn]{--pw-chrome-size:${PW_HEAD_ICON_SIZE.desktop}px;--pw-chrome-label:11px;--pw-chrome-pad-x:6px;--pw-chrome-pad-y:4px;--pw-chrome-gap:4px}
.pw-header-actions [data-pw-chrome-btn]:not([data-pw-chrome-size]),.pw-shop-header-actions [data-pw-chrome-btn]:not([data-pw-chrome-size]){--pw-chrome-size:${PW_HEAD_ICON_SIZE.desktop}px!important;--pw-chrome-w:${PW_HEAD_ICON_SIZE.desktop}px!important;--pw-chrome-h:${PW_HEAD_ICON_SIZE.desktop}px!important}
.pw-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"],.pw-shop-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"]{min-width:44px!important;padding:4px 6px!important;gap:2px!important}
.pw-header-actions [data-pw-chrome-btn]:not([data-pw-chrome-style="icon-label-below"]):not(.pw-chrome-label-below),.pw-shop-header-actions [data-pw-chrome-btn]:not([data-pw-chrome-style="icon-label-below"]):not(.pw-chrome-label-below){padding:4px 8px!important;gap:4px!important;font-size:11px!important}
.pw-search-form,.pw-shop-search-form{height:${PW_SEARCH_FORM_HEIGHT.desktop}px!important}
.pw-search-submit,.pw-shop-search-submit{padding:0 12px!important;font-size:11px!important}
.pw-cat-btn:not([data-pw-chrome-added]),.pw-shop-cat-btn:not([data-pw-chrome-added]){height:32px!important;padding:0 8px!important;font-size:12px!important}
.pw-wordmark{font-size:1rem!important}
.pw-logo,.pw-shop-logo{height:28px!important}
.pw-logo-frame .pw-logo,.pw-logo-frame .pw-shop-logo,[data-pw-logo-frame="1"] .pw-logo,[data-pw-logo-frame="1"] .pw-shop-logo,.pw-logo-frame img,[data-pw-logo-frame="1"] img{height:100%!important;width:100%!important;max-height:none!important;max-width:none!important}
.pw-nav-main,.pw-shop-nav-row{padding:0 0 6px!important;gap:12px!important}
.pw-nav-main>a,.pw-nav-main>button,.pw-shop-nav-row>a,.pw-shop-nav-row>button{font-size:11px!important}
.pw-topbar-inner,.pw-shop-topbar-inner{padding:4px var(--pw-chrome-inset,60px)!important}
.pw-topbar,.pw-shop-topbar,[data-pw-region="topbar"]{min-height:28px!important}
`.trim()

/** Footer logo offset — translate only, never the header `left: calc(50% - 190px…)` formula. */
export const PW_FOOTER_LOGO_OFFSET_RULES = `
.pw-footer .pw-shop-footer-brand>a,.pw-shop-footer .pw-shop-footer-brand>a,.pw-footer a:has(>img.pw-shop-footer-logo),.pw-shop-footer a:has(>img.pw-shop-footer-logo){display:inline-block!important;position:relative!important;transform:translate(var(--pw-logo-x, 0px), var(--pw-logo-y, 0px))!important}
.pw-footer .pw-shop-footer-brand,.pw-shop-footer .pw-shop-footer-brand{overflow:visible!important}
`.trim()

export const PARTNER_SHOP_WIDE_HEADER_BALANCE_CSS = [
  pwHostPrefixCss(PW_SCENE_WIDE_HOSTS, PW_WIDE_HEADER_BALANCE_RULES),
  pwHostPrefixCss(
    PW_SCENE_DESKTOP_HOSTS,
    `.pw-header-main,.pw-shop-header-inner{gap:8px!important;padding:8px var(--pw-chrome-inset,60px)!important}.pw-header-actions [data-pw-chrome-btn]:not([data-pw-chrome-size]),.pw-shop-header-actions [data-pw-chrome-btn]:not([data-pw-chrome-size]){--pw-chrome-size:${PW_HEAD_ICON_SIZE.desktop}px!important;--pw-chrome-w:${PW_HEAD_ICON_SIZE.desktop}px!important;--pw-chrome-h:${PW_HEAD_ICON_SIZE.desktop}px!important}`
  ),
  pwHostPrefixCss(
    PW_SCENE_LAPTOP_HOSTS,
    `.pw-header-main,.pw-shop-header-inner{gap:6px!important;padding:6px var(--pw-chrome-inset,60px)!important}.pw-header-actions,.pw-shop-header-actions{gap:var(--pw-kit-gap, ${PW_HEAD_KIT_GAP.laptop}px)!important}.pw-header-actions [data-pw-chrome-kit="1"],.pw-shop-header-actions [data-pw-chrome-kit="1"],.pw-header-actions [data-pw-chrome-btn],.pw-shop-header-actions [data-pw-chrome-btn]{--pw-chrome-size:${PW_HEAD_ICON_SIZE.laptop}px}.pw-header-actions [data-pw-chrome-btn]:not([data-pw-chrome-size]),.pw-shop-header-actions [data-pw-chrome-btn]:not([data-pw-chrome-size]){--pw-chrome-size:${PW_HEAD_ICON_SIZE.laptop}px!important;--pw-chrome-w:${PW_HEAD_ICON_SIZE.laptop}px!important;--pw-chrome-h:${PW_HEAD_ICON_SIZE.laptop}px!important}`
  ),
  `@media (min-width:900px){${pwHostPrefixCss([PW_SCENE_UNLOCKED_HTML], PW_WIDE_HEADER_BALANCE_RULES)}}`,
].join('')

/** Beat leftover inline transform/width that would push chrome outside the device frame. */
export const PARTNER_SHOP_SEARCH_CLAMP_SCRIPT_ID = 'pw-shop-chrome-inset'
export const PARTNER_SHOP_SEARCH_CLAMP_SCRIPT = `(function(){
  function isCompact(){
    var html=document.documentElement;
    var stamped=html&&html.getAttribute('data-pw-edit-device');
    var lock=html&&html.getAttribute('data-pw-scene-lock');
    var device=stamped||lock||'';
    if(device==='desktop'||device==='laptop')return false;
    if(device==='mobile'||device==='tablet')return true;
    var w=window.innerWidth||document.documentElement.clientWidth||0;
    return w>0&&w<900;
  }
  function isInflowHeaderSearch(el){
    if(!el||!el.getAttribute||!el.closest)return false;
    if(!el.closest('.pw-header-main,.pw-shop-header-inner'))return false;
    if(el.getAttribute('data-pw-placement'))return false;
    if(el.getAttribute('data-pw-stay-scroll')==='1')return false;
    if(el.getAttribute('data-pw-box-x')!=null)return false;
    if(el.getAttribute('data-pw-fixed-x')!=null)return false;
    var st=el.style;
    if(st){
      var pos=String(st.position||'');
      if(pos==='absolute'||pos==='fixed')return false;
    }
    return true;
  }
  function isFloatChrome(el){
    if(!el||!el.getAttribute)return false;
    if(el.getAttribute('data-pw-chrome-float')==='1')return true;
    if(el.getAttribute('data-pw-pin-screen')==='1')return true;
    var k=el.getAttribute('data-pw-chrome-btn')||'';
    return k==='chat'||k==='chat-zalo'||k==='chat-facebook'||k==='topup';
  }
  function isLegacyInflowCategory(el){
    if(!el||!el.getAttribute||!el.closest)return false;
    var k=el.getAttribute('data-pw-chrome-btn')||'';
    var cat=k==='categories'||el.getAttribute('data-pw-el')==='cat-toggle'||el.getAttribute('data-pw-cat-toggle')!=null;
    if(!cat||el.getAttribute('data-pw-placement'))return false;
    return !!el.closest('.pw-brand-cluster,.pw-shop-brand-cluster');
  }
  function resetLegacyInflowCategory(el){
    if(!isLegacyInflowCategory(el)||!el.style)return false;
    el.style.setProperty('position','relative','important');
    el.style.setProperty('left','auto','important');
    el.style.setProperty('top','auto','important');
    el.style.setProperty('right','auto','important');
    el.style.setProperty('bottom','auto','important');
    el.style.setProperty('transform','none','important');
    return true;
  }
  function resetLegacyInflowWordmark(el){
    if(!el||!el.style||!el.closest)return;
    if(el.getAttribute&&el.getAttribute('data-pw-placement'))return;
    if(!el.closest('.pw-brand:not([data-pw-logo-float]),.pw-shop-brand:not([data-pw-logo-float]),a[data-pw-logo-home]:not([data-pw-logo-float])'))return;
    el.style.setProperty('position','relative','important');
    el.style.setProperty('left','auto','important');
    el.style.setProperty('top','auto','important');
    el.style.setProperty('right','auto','important');
    el.style.setProperty('bottom','auto','important');
    el.style.setProperty('transform','none','important');
  }
  function isPlacedChrome(el){
    if(!el||!el.getAttribute)return false;
    if(el.getAttribute('data-pw-user-move')==='1')return true;
    if(el.getAttribute('data-pw-stay-scroll')==='1')return true;
    if(el.getAttribute('data-pw-chrome-added')==='1')return true;
    if(el.getAttribute('data-pw-placement'))return true;
    if(el.getAttribute('data-pw-box-x')!=null)return true;
    if(el.getAttribute('data-pw-fixed-x')!=null)return true;
    var st=el.style;
    if(!st)return false;
    var pos=st.position||'';
    if(pos==='absolute'||pos==='fixed')return true;
    var left=st.left||'';
    var top=st.top||'';
    return (left&&left!=='auto')||(top&&top!=='auto');
  }
  function pinFlow(el){
    if(!el||!el.style)return;
    if(el.classList&&el.classList.contains('pw-stick-header-on'))return;
    if(resetLegacyInflowCategory(el))return;
    if(el.getAttribute&&el.getAttribute('data-pw-user-move'))return;
    if(isFloatChrome(el))return;
    if(isPlacedChrome(el))return;
    if(el.getAttribute&&el.getAttribute('data-pw-hidden')==='1')return;
    el.style.setProperty('transform','none','important');
    el.style.setProperty('left','auto','important');
    el.style.setProperty('top','auto','important');
    el.style.setProperty('right','auto','important');
    el.style.setProperty('bottom','auto','important');
    el.style.setProperty('position','relative','important');
  }
  function pinSearch(el){
    if(!el||!el.style)return;
    if(!isCompact()&&isInflowHeaderSearch(el)){
      try{el.removeAttribute('data-pw-user-move');}catch(errMv){}
      el.style.removeProperty('transform');
      el.style.removeProperty('left');
      el.style.removeProperty('top');
      el.style.removeProperty('right');
      el.style.removeProperty('bottom');
      el.style.removeProperty('position');
      el.style.removeProperty('margin');
      el.style.removeProperty('margin-left');
      el.style.removeProperty('margin-right');
      var userSized=el.getAttribute('data-pw-search-width-user')==='1';
      var saved=parseFloat(el.getAttribute('data-pw-search-width')||'');
      if(userSized&&saved>0){
        var w=Math.max(180,Math.min(520,Math.round(saved)));
        el.style.setProperty('flex','0 0 auto','important');
        el.style.setProperty('width',w+'px','important');
        el.style.setProperty('max-width','none','important');
        el.style.setProperty('min-width','180px','important');
      } else {
        try{el.removeAttribute('data-pw-search-width');}catch(errSearchAttr){}
        el.style.removeProperty('flex');
        el.style.removeProperty('width');
        el.style.removeProperty('max-width');
        el.style.removeProperty('min-width');
      }
      return;
    }
    if(el.getAttribute&&el.getAttribute('data-pw-user-move'))return;
    if(!isCompact()){
      pinFlow(el);
      var savedWide=parseFloat(el.getAttribute('data-pw-search-width')||'');
      var userSizedWide=el.getAttribute('data-pw-search-width-user')==='1';
      if(savedWide>0&&userSizedWide){
        var ww=Math.max(72,Math.min(520,Math.round(savedWide)));
        el.style.setProperty('flex','0 0 auto','important');
        el.style.setProperty('width',ww+'px','important');
        el.style.setProperty('max-width','none','important');
        el.style.setProperty('min-width','72px','important');
      } else if (el.getAttribute('data-pw-search-width-user')!=='1') {
        try{el.removeAttribute('data-pw-search-width');}catch(errSearchAttr){}
      }
      return;
    }
    el.style.setProperty('transform','none','important');
    el.style.setProperty('left','auto','important');
    el.style.setProperty('top','auto','important');
    el.style.setProperty('right','auto','important');
    el.style.setProperty('bottom','auto','important');
    el.style.setProperty('position','relative','important');
    el.style.setProperty('margin','0','important');
    el.style.setProperty('flex','1 1 0%','important');
    el.style.setProperty('width','auto','important');
    el.style.setProperty('max-width','100%','important');
    el.style.setProperty('min-width','96px','important');
    el.style.setProperty('min-height','36px','important');
    el.style.setProperty('opacity','1','important');
    el.style.setProperty('visibility','visible','important');
  }
  function clamp(){
    var wordmarks=document.querySelectorAll('.pw-wordmark');
    var wi;
    for(wi=0;wi<wordmarks.length;wi++)resetLegacyInflowWordmark(wordmarks[wi]);
    var search=document.querySelectorAll('.pw-header-search,.pw-shop-search-wrap,[data-pw-el="search"]');
    var i;
    for(i=0;i<search.length;i++)pinSearch(search[i]);
    var icons=document.querySelectorAll(
      'header .pw-icon-btn,header .pw-shop-icon-btn,.pw-header .pw-icon-btn,.pw-shop-header .pw-icon-btn,'+
      '.pw-header-actions [data-pw-chrome-btn],.pw-shop-header-actions [data-pw-chrome-btn],'+
      '.pw-header-actions [data-pw-chrome-added],.pw-shop-header-actions [data-pw-chrome-added],'+
      '.pw-account-btn,.pw-cat-btn,.pw-shop-cat-btn,[data-pw-el="cat-toggle"],[data-pw-cat-toggle],[data-pw-chrome-btn="categories"],'+
      '.pw-bottom-nav>a,.pw-shop-bottom-nav>a,.pw-bottom-nav>button,.pw-shop-bottom-nav>button'
    );
    for(i=0;i<icons.length;i++){
      if(icons[i].closest&&icons[i].closest('.pw-cat-panel,.pw-account-panel,.pw-shop-cat-panel,.pw-shop-account-panel'))continue;
      pinFlow(icons[i]);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clamp);
  else clamp();
  window.addEventListener('resize',clamp);
})();`

/** Product cards: mobile/tablet 2, laptop 4, desktop 5. */
const PW_PRODUCT_GRID_SEL =
  '.pw-product-grid,.pw-shop-grid,.pw-shop-detail-grid,[data-pw-catalog] [data-pw-grid],[data-pw-region="catalog"] [data-pw-el="grid"],.pw-search-grid,.pw-shop-search-grid'

function pwProductGridUnder(prefix: string): string {
  return PW_PRODUCT_GRID_SEL.split(',')
    .map((sel) => `${prefix} ${sel}`)
    .join(',')
}

const PARTNER_SHOP_PRODUCT_GRID_2COL_CSS = `
${PW_PRODUCT_GRID_SEL}{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
${pwProductGridUnder('html[data-pw-edit-device="mobile"]')},${pwProductGridUnder('html[data-pw-edit-device="tablet"]')},${pwProductGridUnder('html[data-pw-scene-lock="mobile"]')},${pwProductGridUnder('html[data-pw-scene-lock="tablet"]')}{grid-template-columns:repeat(2,minmax(0,1fr))!important}
${pwProductGridUnder('html[data-pw-edit-device="laptop"]')},${pwProductGridUnder('html[data-pw-scene-lock="laptop"]')}{grid-template-columns:repeat(4,minmax(0,1fr))!important}
${pwProductGridUnder('html[data-pw-edit-device="desktop"]')},${pwProductGridUnder('html[data-pw-scene-lock="desktop"]')}{grid-template-columns:repeat(5,minmax(0,1fr))!important}
@media (min-width:1280px){
${pwProductGridUnder('html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]):not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="mobile"]):not([data-pw-scene-lock="tablet"]):not([data-pw-scene-lock="desktop"])')}{grid-template-columns:repeat(4,minmax(0,1fr))!important}
}
@media (min-width:1440px){
${pwProductGridUnder('html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]):not([data-pw-edit-device="laptop"]):not([data-pw-scene-lock="mobile"]):not([data-pw-scene-lock="tablet"]):not([data-pw-scene-lock="laptop"])')}{grid-template-columns:repeat(5,minmax(0,1fr))!important}
}
`.trim()

export const PARTNER_SHOP_CHROME_LAYOUT_CSS = `
html{overflow-x:visible!important;max-width:100%}
body{overflow-x:hidden!important;max-width:100%}
html{--pw-content:1200px;--pw-page-gutter:20px;--pw-block-w:min(calc(var(--pw-scene-w,100%) - 32px),var(--pw-content,1200px));--pw-chrome-inset:calc(var(--pw-block-w) * 0.05)}
html[data-pw-edit-device="mobile"],html[data-pw-scene-lock="mobile"]{--pw-page-gutter:4px;--pw-block-w:min(calc(var(--pw-scene-w,100%) - 8px),var(--pw-content,1200px))}
@media (max-width:767px){html:not([data-pw-edit-device]):not([data-pw-scene-lock]){--pw-page-gutter:4px;--pw-block-w:min(calc(var(--pw-scene-w,100%) - 8px),var(--pw-content,1200px))}}
html[data-pw-edit-device="mobile"] .pw-container:not(.pw-header-main):not(.pw-shop-header-inner):not(.pw-topbar-inner):not(.pw-nav-main):not(.pw-shop-nav-row),html[data-pw-scene-lock="mobile"] .pw-container:not(.pw-header-main):not(.pw-shop-header-inner):not(.pw-topbar-inner):not(.pw-nav-main):not(.pw-shop-nav-row){padding-left:4px!important;padding-right:4px!important}
html[data-pw-edit-device="mobile"] .pw-page-shell,html[data-pw-scene-lock="mobile"] .pw-page-shell,html[data-pw-edit-device="mobile"] .pw-shop-main,html[data-pw-scene-lock="mobile"] .pw-shop-main{padding-left:4px!important;padding-right:4px!important}
html[data-pw-edit-device="mobile"] .pw-page-shell .pw-container:not(.pw-header-main):not(.pw-shop-header-inner):not(.pw-topbar-inner):not(.pw-nav-main):not(.pw-shop-nav-row),html[data-pw-scene-lock="mobile"] .pw-page-shell .pw-container:not(.pw-header-main):not(.pw-shop-header-inner):not(.pw-topbar-inner):not(.pw-nav-main):not(.pw-shop-nav-row),html[data-pw-edit-device="mobile"] .pw-shop-main .pw-container:not(.pw-header-main):not(.pw-shop-header-inner):not(.pw-topbar-inner):not(.pw-nav-main):not(.pw-shop-nav-row),html[data-pw-scene-lock="mobile"] .pw-shop-main .pw-container:not(.pw-header-main):not(.pw-shop-header-inner):not(.pw-topbar-inner):not(.pw-nav-main):not(.pw-shop-nav-row){padding-left:0!important;padding-right:0!important}
@media (max-width:767px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-container:not(.pw-header-main):not(.pw-shop-header-inner):not(.pw-topbar-inner):not(.pw-nav-main):not(.pw-shop-nav-row){padding-left:4px!important;padding-right:4px!important}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-page-shell,html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-shop-main{padding-left:4px!important;padding-right:4px!important}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-page-shell .pw-container:not(.pw-header-main):not(.pw-shop-header-inner):not(.pw-topbar-inner):not(.pw-nav-main):not(.pw-shop-nav-row),html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-shop-main .pw-container:not(.pw-header-main):not(.pw-shop-header-inner):not(.pw-topbar-inner):not(.pw-nav-main):not(.pw-shop-nav-row){padding-left:0!important;padding-right:0!important}
}
${pwSceneCenterCss()}
${PARTNER_SHOP_PRODUCT_GRID_2COL_CSS}
${PW_PRODUCT_GRID_RULER_CSS}
${PW_RELATED_CSS}
${PW_OUTFIT_CSS}
${PW_FEATURED_CATEGORIES_CSS}
.pw-for-you-badge{position:absolute;top:8px;left:8px;z-index:2;background:var(--pw-primary);color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px}
.pw-header .pw-icon-btn:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-shop-header .pw-icon-btn:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-header .pw-shop-icon-btn:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-shop-header .pw-shop-icon-btn:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-header-actions [data-pw-chrome-btn]:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-shop-header-actions [data-pw-chrome-btn]:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-header .pw-account-btn:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-shop-header .pw-account-btn:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-bottom-nav>a:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-shop-bottom-nav>a:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-bottom-nav>button:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-shop-bottom-nav>button:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-cat-btn:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),.pw-shop-cat-btn:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),[data-pw-el="cat-toggle"]:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]),[data-pw-chrome-btn="categories"]:not(.pw-stick-header-on):not([data-pw-chrome-float]):not([data-pw-chrome-added]):not([data-pw-stay-scroll]){position:relative!important;transform:none!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important}
.pw-brand-cluster [data-pw-chrome-btn="categories"]:not([data-pw-placement]),.pw-shop-brand-cluster [data-pw-chrome-btn="categories"]:not([data-pw-placement]){
  position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;transform:none!important
}
${PW_FOOTER_LOGO_OFFSET_RULES}
${PW_CHROME_TOKEN_VARS_CSS}
.pw-chrome-icon-wrap{position:relative!important;display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;width:${PW_CHROME_W_VAR}!important;height:${PW_CHROME_H_VAR}!important;flex-shrink:0!important;overflow:visible!important}
${PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS}
.pw-chrome-icon-wrap svg,.pw-chrome-icon-wrap .pw-shop-nav-icon{width:${PW_CHROME_W_VAR}!important;height:${PW_CHROME_H_VAR}!important;max-width:${PW_CHROME_W_VAR}!important;max-height:${PW_CHROME_H_VAR}!important;display:block!important;opacity:1!important;visibility:visible!important;stroke:currentColor!important;fill:none!important;flex-shrink:0}
.pw-chrome-icon-wrap svg.pw-chrome-brand-logo{stroke:none!important;fill:none!important}
.pw-chrome-icon-wrap .pw-chrome-chat-logo{width:${PW_CHROME_W_VAR}!important;height:${PW_CHROME_H_VAR}!important;max-width:${PW_CHROME_W_VAR}!important;max-height:${PW_CHROME_H_VAR}!important;object-fit:cover!important;border-radius:999px!important;display:block!important;pointer-events:none!important;flex-shrink:0}
[data-pw-chrome-btn="chat"] .pw-chrome-icon-wrap,[data-pw-chrome-btn="chat-zalo"] .pw-chrome-icon-wrap,[data-pw-chrome-btn="chat-facebook"] .pw-chrome-icon-wrap{overflow:hidden!important;border-radius:999px!important}
[data-pw-chrome-btn="chat"] .pw-chrome-chat-logo{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:cover!important;border-radius:999px!important}
[data-pw-chrome-btn="chat"][data-pw-chat-icon-logo="1"] .pw-chrome-icon-wrap,[data-pw-chrome-btn="chat"][data-pw-chat-icon-logo="1"] .pw-chrome-chat-logo{border-radius:999px!important;object-fit:cover!important}
.pw-chrome-icon-wrap .pw-cart-badge,.pw-chrome-icon-wrap .pw-shop-cart-badge{position:absolute!important;top:-5px!important;right:-9px!important;left:auto!important;bottom:auto!important;min-width:16px;height:16px;margin:0!important;z-index:5}
${PW_CHROME_COUNT_BADGE_HIDE_CSS}
.pw-header-actions .pw-icon-btn,.pw-shop-header-actions .pw-icon-btn,.pw-header-actions .pw-shop-icon-btn,.pw-shop-header-actions .pw-shop-icon-btn,.pw-header-actions [data-pw-chrome-btn],.pw-shop-header-actions [data-pw-chrome-btn]{overflow:visible!important}
.pw-bottom-nav,.pw-shop-bottom-nav{display:flex!important;flex-wrap:nowrap!important;grid-template-columns:none!important;justify-content:space-around;align-items:stretch;overflow:visible;z-index:${PW_SCENE_HEAD_Z}!important;background:#fff}
.pw-bottom-nav>a:not([data-pw-pdp-home]):not([data-pw-dock-show="pdp"]):not([data-pw-hidden="1"]),.pw-shop-bottom-nav>a:not([data-pw-pdp-home]):not([data-pw-dock-show="pdp"]):not([data-pw-hidden="1"]),.pw-bottom-nav>.pw-icon-btn:not([data-pw-hidden="1"]),.pw-shop-bottom-nav>.pw-icon-btn:not([data-pw-hidden="1"]),.pw-bottom-nav>.pw-shop-icon-btn:not([data-pw-hidden="1"]),.pw-shop-bottom-nav>.pw-shop-icon-btn:not([data-pw-hidden="1"]),.pw-bottom-nav>.pw-account-btn:not([data-pw-hidden="1"]),.pw-shop-bottom-nav>.pw-account-btn:not([data-pw-hidden="1"]),[data-pw-chrome-kit="dock"]>.pw-account-btn:not([data-pw-hidden="1"]){
  flex:1 1 0!important;min-width:0!important;min-height:0!important;width:auto!important;height:auto!important;
  display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
  gap:2px!important;padding:6px 2px!important;background:transparent!important;position:relative!important;color:#6b7280!important;overflow:visible!important
}
.pw-bottom-nav .pw-account-btn,.pw-shop-bottom-nav .pw-account-btn,[data-pw-chrome-kit="dock"] .pw-account-btn{color:#6b7280!important}
.pw-bottom-nav>a.is-active,.pw-shop-bottom-nav>a.is-active{color:var(--pw-primary)!important}
.pw-bottom-nav>a:not([data-pw-chrome-added]),.pw-shop-bottom-nav>a:not([data-pw-chrome-added]){
  transform:none;left:auto;top:auto;right:auto;bottom:auto
}
.pw-bottom-nav svg,.pw-shop-bottom-nav svg{width:${PW_CHROME_W_VAR}!important;height:${PW_CHROME_H_VAR}!important;max-width:${PW_CHROME_W_VAR}!important;max-height:${PW_CHROME_H_VAR}!important;flex-shrink:0;stroke:currentColor!important;fill:none!important}
.pw-bottom-nav .pw-pdp-like-icon,.pw-shop-bottom-nav .pw-pdp-like-icon,.pw-pdp-sticky-nav .pw-pdp-like-icon{fill:inherit!important}
.pw-pdp-sticky,.pw-pdp-sticky-nav{max-width:100%;box-sizing:border-box}
.pw-pdp-sticky svg,.pw-pdp-sticky-nav svg{width:${PW_CHROME_W_VAR}!important;height:${PW_CHROME_H_VAR}!important;max-width:${PW_CHROME_W_VAR}!important;max-height:${PW_CHROME_H_VAR}!important;flex-shrink:0;display:block}
.pw-pdp-sticky-nav svg,.pw-bottom-nav[data-pw-pdp-bottom] .pw-pdp-sticky-nav svg,.pw-shop-bottom-nav[data-pw-pdp-bottom] .pw-pdp-sticky-nav svg{width:17px!important;height:17px!important;max-width:17px!important;max-height:17px!important}
main,.pw-shop-main,.pw-main{overflow:visible}
[data-pw-added-bg-slot="1"]:not([data-pw-stay-scroll="1"]):not([data-pw-pin-screen="1"]){position:relative;display:block;width:100%;box-sizing:border-box}
[data-pw-added-image][data-pw-image-radius],[data-pw-info-image][data-pw-image-radius]{overflow:hidden}
${PW_BG_CLEARED_CSS}
${PW_PAPER_CSS}
.pw-pdp,.pw-shop-breadcrumb,[data-pw-region="gallery"],[data-pw-region="pdp-info"],[data-pw-region="reviews"],[data-pw-region="breadcrumb"],[data-pw-region="catalog"],[data-pw-region="content"],[data-pw-region="form"]{position:relative;z-index:2}
.pw-pdp-actions [data-pw-chrome-btn],.pw-pdp-actions .pw-shop-btn{position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;transform:none!important;margin-left:0;margin-right:0}
${pwSceneUnifiedStackCss()}
.pw-bottom-nav .pw-shop-icon-label,.pw-shop-bottom-nav .pw-shop-icon-label,.pw-bottom-nav .pw-chrome-btn-label,.pw-shop-bottom-nav .pw-chrome-btn-label,.pw-bottom-nav .pw-shop-nav-label,.pw-shop-bottom-nav .pw-shop-nav-label,.pw-bottom-nav>a>span:not(.pw-chrome-icon-wrap):not(.pw-cart-badge):not(.pw-shop-cart-badge),.pw-shop-bottom-nav>a>span:not(.pw-chrome-icon-wrap):not(.pw-cart-badge):not(.pw-shop-cart-badge){
  display:block!important;max-width:100%!important;white-space:normal!important;overflow:visible!important;text-overflow:unset!important;text-align:center;line-height:1.15;overflow-wrap:break-word;word-break:break-word
}
.pw-header-actions .pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]),.pw-shop-header-actions .pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]),
.pw-nav-main .pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]),.pw-shop-nav-row .pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]),
[data-pw-chrome-added].pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]),
[data-pw-chrome-btn="chat"].pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]),[data-pw-chrome-btn="chat-zalo"].pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]),[data-pw-chrome-btn="chat-facebook"].pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]),
.pw-cat-btn.pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]),.pw-shop-cat-btn.pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]){
  width:auto!important;height:auto!important;
  min-width:0!important;min-height:0!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,4px)!important;border-radius:999px!important;flex-direction:row!important
}
.pw-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only):not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]),.pw-shop-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only):not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]),
.pw-header-actions .pw-chrome-has-label:not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]),.pw-shop-header-actions .pw-chrome-has-label:not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]),
.pw-header-actions .pw-chrome-link,.pw-shop-header-actions .pw-chrome-link,
[data-pw-chrome-added].pw-chrome-has-label:not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]),[data-pw-chrome-added].pw-chrome-link{
  display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;
  gap:var(--pw-chrome-gap,6px)!important;width:auto!important;height:auto!important;min-width:0!important;
  min-height:${PW_CHROME_BTN_MIN_H}!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px)!important;border-radius:999px!important;background:transparent!important;font-size:var(--pw-chrome-label,13px)!important;font-weight:700!important
}
.pw-header-actions .pw-chrome-icon-only,.pw-shop-header-actions .pw-chrome-icon-only,
[data-pw-chrome-added].pw-chrome-icon-only,
.pw-cat-btn.pw-chrome-icon-only,.pw-shop-cat-btn.pw-chrome-icon-only{
  padding:0!important
}
[data-pw-el="cat-toggle"]${PW_CHROME_NOT_ICON_ONLY_SEL},.pw-cat-btn${PW_CHROME_NOT_ICON_ONLY_SEL},.pw-shop-cat-btn${PW_CHROME_NOT_ICON_ONLY_SEL}{
  height:auto!important;min-height:${PW_CHROME_BTN_MIN_H}!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px)!important;
  font-size:var(--pw-chrome-label,13px)!important;gap:var(--pw-chrome-gap,6px)!important
}
.pw-header-actions .pw-chrome-icon-square,.pw-shop-header-actions .pw-chrome-icon-square,
.pw-nav-main .pw-chrome-icon-square,.pw-shop-nav-row .pw-chrome-icon-square,
[data-pw-chrome-added].pw-chrome-icon-square,
[data-pw-chrome-btn="chat"].pw-chrome-icon-square,[data-pw-chrome-btn="chat-zalo"].pw-chrome-icon-square,[data-pw-chrome-btn="chat-facebook"].pw-chrome-icon-square,
.pw-bottom-nav .pw-chrome-icon-square,.pw-shop-bottom-nav .pw-chrome-icon-square{
  border-radius:10px!important
}
.pw-chrome-icon-square .pw-chrome-icon-wrap,
[data-pw-chrome-btn="chat"].pw-chrome-icon-square .pw-chrome-icon-wrap,
[data-pw-chrome-btn="chat-zalo"].pw-chrome-icon-square .pw-chrome-icon-wrap,
[data-pw-chrome-btn="chat-facebook"].pw-chrome-icon-square .pw-chrome-icon-wrap{
  border-radius:8px!important
}
.pw-chrome-icon-square .pw-chrome-chat-logo,[data-pw-chrome-btn="chat"].pw-chrome-icon-square .pw-chrome-chat-logo{
  border-radius:8px!important
}
.pw-header-actions .pw-chrome-icon-circle,.pw-shop-header-actions .pw-chrome-icon-circle,
.pw-nav-main .pw-chrome-icon-circle,.pw-shop-nav-row .pw-chrome-icon-circle,
[data-pw-chrome-added].pw-chrome-icon-circle,
[data-pw-chrome-btn="chat"].pw-chrome-icon-circle,[data-pw-chrome-btn="chat-zalo"].pw-chrome-icon-circle,[data-pw-chrome-btn="chat-facebook"].pw-chrome-icon-circle,[data-pw-chrome-btn="topup"].pw-chrome-icon-circle,
.pw-bottom-nav .pw-chrome-icon-circle,.pw-shop-bottom-nav .pw-chrome-icon-circle{
  border-radius:999px!important
}
.pw-chrome-icon-circle .pw-chrome-icon-wrap,
[data-pw-chrome-btn="chat"].pw-chrome-icon-circle .pw-chrome-icon-wrap,
[data-pw-chrome-btn="chat-zalo"].pw-chrome-icon-circle .pw-chrome-icon-wrap,
[data-pw-chrome-btn="chat-facebook"].pw-chrome-icon-circle .pw-chrome-icon-wrap,
[data-pw-chrome-btn="topup"].pw-chrome-icon-circle .pw-chrome-icon-wrap{
  border-radius:999px!important
}
.pw-chrome-icon-circle .pw-chrome-chat-logo,[data-pw-chrome-btn="chat"].pw-chrome-icon-circle .pw-chrome-chat-logo{
  border-radius:999px!important
}
.pw-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only):not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]) .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only):not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]) .pw-chrome-btn-label,
.pw-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only):not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]) .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only):not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]) .pw-shop-nav-label,
.pw-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only):not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]) .pw-account-btn-label,.pw-shop-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only):not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]) .pw-account-btn-label{
  display:inline!important;max-width:none!important;overflow:visible!important;white-space:nowrap!important;font-size:var(--pw-chrome-label,13px)!important
}
.pw-header-actions [data-pw-chrome-added].pw-chrome-label-below:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-below:not(.pw-chrome-icon-only),
.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"]:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"]:not(.pw-chrome-icon-only){
  flex-direction:column!important;align-items:center!important;justify-content:center!important;
  padding:var(--pw-chrome-pad-y,4px) 6px!important;border-radius:10px!important
}
.pw-header-actions [data-pw-chrome-added].pw-chrome-label-below .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-below .pw-chrome-btn-label,
.pw-header-actions [data-pw-chrome-added].pw-chrome-label-below .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-below .pw-shop-nav-label,
.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"] .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"] .pw-chrome-btn-label,
.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"] .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"] .pw-shop-nav-label{
  display:block!important;text-align:center!important;white-space:nowrap!important;max-width:none!important
}
.pw-header-actions [data-pw-chrome-added].pw-chrome-label-left:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-left:not(.pw-chrome-icon-only),
.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"]:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"]:not(.pw-chrome-icon-only){
  flex-direction:row!important;align-items:center!important;justify-content:center!important
}
.pw-header-actions [data-pw-chrome-added].pw-chrome-label-left .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-left .pw-chrome-btn-label,
.pw-header-actions [data-pw-chrome-added].pw-chrome-label-left .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-left .pw-shop-nav-label,
.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"] .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"] .pw-chrome-btn-label,
.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"] .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"] .pw-shop-nav-label{
  display:inline!important;white-space:nowrap!important;text-align:right!important;max-width:none!important
}
${PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS}
.pw-nav-main [data-pw-chrome-added]:not(.pw-chrome-icon-only),.pw-shop-nav-row [data-pw-chrome-added]:not(.pw-chrome-icon-only){
  display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:var(--pw-chrome-gap,6px)!important;
  width:auto!important;height:auto!important;min-width:0!important;background:transparent!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px)!important;border-radius:999px!important;font-size:var(--pw-chrome-label,13px)!important
}
.pw-bottom-nav .pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]),.pw-shop-bottom-nav .pw-chrome-icon-only:not(.pw-chrome-icon-square):not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-square"]):not([data-pw-chrome-style="icon-circle"]){
  flex:0 0 auto!important;width:auto!important;height:auto!important;
  min-width:0!important;min-height:0!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,4px)!important;border-radius:999px!important;flex-direction:row!important
}
.pw-bottom-nav .pw-chrome-has-label:not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]),.pw-shop-bottom-nav .pw-chrome-has-label:not(.pw-chrome-label-below):not([data-pw-chrome-style="icon-label-below"]),
.pw-bottom-nav .pw-chrome-link,.pw-shop-bottom-nav .pw-chrome-link{
  flex:0 0 auto!important;width:auto!important;height:auto!important;min-width:0!important;
  min-height:${PW_CHROME_BTN_MIN_H}!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px)!important;border-radius:999px!important;flex-direction:row!important;gap:var(--pw-chrome-gap,6px)!important;font-size:var(--pw-chrome-label,13px)!important
}
${PW_CHROME_LABEL_BELOW_CSS}
${PW_CHROME_FACE_EXTRAS_CSS}
.pw-chrome-label-left,[data-pw-chrome-style="icon-label-left"],
.pw-header-actions .pw-chrome-label-left,.pw-shop-header-actions .pw-chrome-label-left,
.pw-nav-main .pw-chrome-label-left,.pw-shop-nav-row .pw-chrome-label-left,
.pw-bottom-nav .pw-chrome-label-left,.pw-shop-bottom-nav .pw-chrome-label-left,
[data-pw-chrome-added].pw-chrome-label-left,
.pw-bottom-nav [data-pw-chrome-added].pw-chrome-label-left,.pw-shop-bottom-nav [data-pw-chrome-added].pw-chrome-label-left{
  flex-direction:row!important;align-items:center!important;justify-content:center!important
}
.pw-chrome-label-left .pw-chrome-btn-label,.pw-chrome-label-left .pw-shop-nav-label,.pw-chrome-label-left .pw-shop-icon-label,
[data-pw-chrome-style="icon-label-left"] .pw-chrome-btn-label,[data-pw-chrome-style="icon-label-left"] .pw-shop-nav-label{
  display:inline!important;white-space:nowrap!important;text-align:right!important;max-width:none!important
}
.pw-bottom-nav [data-pw-chrome-added] svg,.pw-shop-bottom-nav [data-pw-chrome-added] svg,
.pw-bottom-nav [data-pw-chrome-btn] svg,.pw-shop-bottom-nav [data-pw-chrome-btn] svg{
  width:${PW_CHROME_W_VAR}!important;height:${PW_CHROME_H_VAR}!important;
  max-width:${PW_CHROME_W_VAR}!important;max-height:${PW_CHROME_H_VAR}!important
}
${PW_STOCK_CHROME_EDIT_CSS}
${PW_CHROME_LABELED_MIN_W_CSS}
${PW_CHROME_LABEL_FACE_CSS}
${PW_CHROME_LABEL_BELOW_CSS}
${PW_CHROME_FACE_EXTRAS_CSS}
${PW_CHROME_ICON_CIRCLE_CSS}
${PW_CHROME_ICON_SQUARE_CSS}
${PW_LEAD_COUPON_CSS}
${PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS}
.pw-nav-main>a,.pw-nav-main>a.pw-nav-sale,.pw-nav-main>a.is-sale,.pw-nav-main>button,
.pw-nav-main a,.pw-nav-main a.pw-nav-sale,.pw-nav-main a.is-sale,.pw-nav-main button,
.pw-shop-nav-row>a,.pw-shop-nav-row>a.pw-nav-sale,.pw-shop-nav-row>a.is-sale,.pw-shop-nav-row>button,
.pw-shop-nav-row a,.pw-shop-nav-row a.pw-nav-sale,.pw-shop-nav-row a.is-sale,.pw-shop-nav-row button,
.pw-nav-row-scroll a,.pw-nav-row-scroll button,.pw-nav-pill a,.pw-nav-pill button,
.pw-cat-panel a,.pw-cat-panel a.pw-nav-sale,.pw-cat-panel a.is-sale,
.pw-shop-cat-panel a,.pw-shop-cat-panel a.pw-nav-sale,.pw-shop-cat-panel a.is-sale{color:#374151!important;transition:color .15s ease}
.pw-nav-main>a:hover,.pw-shop-nav-row>a:hover,
.pw-nav-main a:hover,.pw-nav-main button:hover,.pw-shop-nav-row a:hover,.pw-shop-nav-row button:hover,
.pw-nav-row-scroll a:hover,.pw-nav-row-scroll button:hover,.pw-nav-pill:hover a,.pw-nav-pill:hover button,
.pw-cat-panel a:hover,.pw-shop-cat-panel a:hover,[data-pw-cat-panel] a:hover,
.pw-cat-mega-l2:hover,.pw-cat-mega-l3:hover,
.pw-cat-mega-l1 a.is-active,.pw-cat-panel a.is-active,.pw-shop-cat-panel a.is-active,[data-pw-cat-panel] a.is-active{
  color:var(--pw-primary)!important
}
.pw-cat-panel .pw-cat-mega-kho-more:hover,.pw-shop-cat-panel .pw-cat-mega-kho-more:hover,[data-pw-cat-panel] .pw-cat-mega-kho-more:hover{
  color:var(--pw-accent)!important
}
.pw-header,.pw-shop-header{position:sticky!important;top:0!important;z-index:${PW_SCENE_HEAD_Z}!important;display:flex!important;flex-direction:column!important}
html:not([data-pw-edit-device]) .pw-nav-main:not([data-pw-nav-live]),html:not([data-pw-edit-device]) .pw-shop-nav-row:not([data-pw-nav-live]){visibility:hidden}
html .pw-nav-main,html .pw-shop-nav-row{width:var(--pw-block-w)!important;max-width:var(--pw-block-w)!important;margin-left:auto!important;margin-right:auto!important;align-self:center!important;flex:0 0 auto!important;box-sizing:border-box;padding-left:var(--pw-chrome-inset,60px)!important;padding-right:var(--pw-chrome-inset,60px)!important}
@media (min-width:900px){
${PW_SCENE_UNLOCKED_HTML} .pw-nav-main,${PW_SCENE_UNLOCKED_HTML} .pw-shop-nav-row{display:flex!important;flex-wrap:nowrap!important;justify-content:center!important;align-items:center!important;gap:12px!important;overflow-x:auto!important;padding-left:var(--pw-chrome-inset,60px)!important;padding-right:var(--pw-chrome-inset,60px)!important}
${PW_SCENE_UNLOCKED_HTML} .pw-nav-main>a,${PW_SCENE_UNLOCKED_HTML} .pw-nav-main>button,${PW_SCENE_UNLOCKED_HTML} .pw-shop-nav-row>a,${PW_SCENE_UNLOCKED_HTML} .pw-shop-nav-row>button{white-space:nowrap!important;flex:0 0 auto!important}
}
@media (max-width:899px){
${PW_SCENE_UNLOCKED_HTML} .pw-nav-main,${PW_SCENE_UNLOCKED_HTML} .pw-shop-nav-row{display:none!important}
}
@media (min-width:900px) and (max-width:1439px){
html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-nav-main,html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-shop-nav-row{gap:8px!important;padding-left:var(--pw-chrome-inset,60px)!important;padding-right:var(--pw-chrome-inset,60px)!important}
html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-nav-main>a,html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-nav-main>button,html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-shop-nav-row>a,html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-shop-nav-row>button{font-size:11px!important;letter-spacing:.04em!important}
html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-header-main,html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-shop-header-inner{gap:12px!important;align-items:center!important}
html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-brand-cluster,html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-shop-brand-cluster,html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-header-actions,html:not([data-pw-edit-device="desktop"]):not([data-pw-scene-lock="desktop"]) .pw-shop-header-actions{align-self:center!important;align-items:center!important}
}
.pw-topbar,.pw-shop-topbar,[data-pw-region="topbar"]{position:relative!important;z-index:${PW_SCENE_TOPBAR_Z}!important;display:block!important;width:100%!important;min-width:100%!important;max-width:none!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;clip-path:none!important;overflow:visible!important;min-height:36px!important;height:auto!important;flex:0 0 auto!important;align-self:stretch!important;box-sizing:border-box}
body:not(.nanoai-ve-active) .pw-topbar,body:not(.nanoai-ve-active) .pw-shop-topbar{pointer-events:none!important}
body:not(.nanoai-ve-active) .pw-topbar a,body:not(.nanoai-ve-active) .pw-topbar button,body:not(.nanoai-ve-active) .pw-shop-topbar a,body:not(.nanoai-ve-active) .pw-shop-topbar button{pointer-events:auto!important}
.pw-header,.pw-shop-header,.pw-header-main,.pw-shop-header-inner,.pw-brand-cluster,.pw-shop-brand-cluster{overflow:visible!important}
html .pw-header-main,html .pw-shop-header-inner{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;min-width:0;position:relative!important;max-width:var(--pw-block-w)!important;width:var(--pw-block-w)!important;margin-left:auto!important;margin-right:auto!important;align-self:center!important;box-sizing:border-box;padding-left:var(--pw-chrome-inset,60px)!important;padding-right:var(--pw-chrome-inset,60px)!important}
html .pw-topbar-inner,html .pw-shop-topbar-inner{display:flex!important;justify-content:flex-end!important;align-items:center!important;max-width:var(--pw-block-w)!important;width:var(--pw-block-w)!important;margin-left:auto!important;margin-right:auto!important;align-self:center!important;box-sizing:border-box;padding-left:var(--pw-chrome-inset,60px)!important;padding-right:var(--pw-chrome-inset,60px)!important}
html .pw-hero,html .pw-banner,html .pw-shop-hero,html .pw-shop-banner,html [data-pw-region="banner"]{max-width:var(--pw-block-w)!important;width:var(--pw-block-w)!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box}
html [data-pw-block-w]:not([data-pw-region="header"]):not([data-pw-region="nav"]):not([data-pw-region="topbar"]):not([data-pw-region="footer"]):not([data-pw-added-bg]){width:var(--pw-block-w)!important;max-width:100%!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box}
html [data-pw-block-h]:not([data-pw-added-bg]):not([data-pw-added-catalog]):not([data-pw-featured-categories]):not([data-pw-region="catalog"]){min-height:var(--pw-block-h)!important;height:var(--pw-block-h)!important}
.pw-brand-cluster,.pw-shop-brand-cluster,.pw-brand:not([data-pw-logo-float]),.pw-shop-brand:not([data-pw-logo-float]),a[data-pw-logo-home]:not([data-pw-logo-float]){position:relative!important;z-index:120!important;flex:0 0 auto!important;overflow:visible!important}
.pw-brand:not([data-pw-logo-float]),.pw-shop-brand:not([data-pw-logo-float]),a[data-pw-logo-home]:not([data-pw-logo-float]){display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:100%!important;vertical-align:middle}
.pw-brand-cluster,.pw-shop-brand-cluster{pointer-events:none!important}
.pw-brand-cluster > *,.pw-shop-brand-cluster > *,.pw-brand-cluster a,.pw-shop-brand-cluster a,.pw-brand-cluster button,.pw-shop-brand-cluster button,.pw-brand-cluster img,.pw-shop-brand-cluster img,.pw-brand-cluster [data-pw-el],.pw-shop-brand-cluster [data-pw-el],.pw-brand-cluster .pw-chrome-cat-wrap,.pw-shop-brand-cluster .pw-chrome-cat-wrap,.pw-brand-cluster .pw-logo-frame,.pw-shop-brand-cluster .pw-logo-frame,.pw-brand-cluster [data-pw-logo-frame],.pw-shop-brand-cluster [data-pw-logo-frame],[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn,[data-pw-image-search],.pw-search-image-btn,.pw-shop-search-image{pointer-events:auto!important}
header [data-pw-logo-float="1"],.pw-header [data-pw-logo-float="1"],.pw-shop-header [data-pw-logo-float="1"]{
  position:absolute!important;margin:0!important;max-width:none!important;max-height:none!important;overflow:hidden!important;pointer-events:auto!important
}
header [data-pw-logo-float="1"]:not([data-pw-z]),.pw-header [data-pw-logo-float="1"]:not([data-pw-z]),.pw-shop-header [data-pw-logo-float="1"]:not([data-pw-z]){z-index:${PW_SCENE_LOGO_Z}!important}
header img.pw-logo,header img.pw-shop-logo,.pw-header img.pw-logo,.pw-shop-header img.pw-shop-logo,header [data-pw-logo-added],.pw-header [data-pw-logo-added],.pw-shop-header [data-pw-logo-added]{
  overflow:visible!important;object-fit:contain!important;object-position:left center!important;max-width:none!important;max-height:none!important
}
header img.pw-logo:not([data-pw-z]),header img.pw-shop-logo:not([data-pw-z]),.pw-header img.pw-logo:not([data-pw-z]),.pw-shop-header img.pw-shop-logo:not([data-pw-z]),header [data-pw-logo-added]:not([data-pw-z]),.pw-header [data-pw-logo-added]:not([data-pw-z]),.pw-shop-header [data-pw-logo-added]:not([data-pw-z]){z-index:${PW_SCENE_LOGO_Z}!important}
header .pw-logo-frame img,header [data-pw-logo-frame="1"] img,.pw-header .pw-logo-frame img,.pw-shop-header .pw-logo-frame img,header img[data-pw-logo-float],.pw-header img[data-pw-logo-float],.pw-shop-header img[data-pw-logo-float]{
  max-width:none!important;max-height:none!important
}
header,.pw-header,.pw-shop-header,.pw-header-main,.pw-shop-header-inner,.pw-brand-cluster,.pw-shop-brand-cluster,a.pw-brand,a.pw-shop-brand{background-repeat:no-repeat!important}
body:not(.nanoai-ve-active) [data-pw-logo-empty="1"],body:not(.nanoai-ve-active) .pw-logo-frame:has([data-pw-logo-empty="1"]),body:not(.nanoai-ve-active) [data-pw-logo-frame="1"]:has([data-pw-logo-empty="1"]){display:none!important}
body:not(.nanoai-ve-active) [data-pw-seo-coach],body:not(.nanoai-ve-active) .pw-seo-coach,body:not(.nanoai-ve-active) [data-pw-article-editor],body:not(.nanoai-ve-active) .pw-article-editor{display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;margin:0!important;padding:0!important;border:0!important}
.nanoai-ve-active [data-pw-seo-coach],.nanoai-ve-active .pw-seo-coach,.nanoai-ve-active [data-pw-article-editor],.nanoai-ve-active .pw-article-editor{display:block!important;visibility:visible!important;height:auto!important;max-height:none!important;overflow:visible!important;opacity:1!important}
header [data-pw-logo-added],.pw-header [data-pw-logo-added],.pw-shop-header [data-pw-logo-added],header .pw-logo-frame img,header [data-pw-logo-frame="1"] img{
  max-width:none!important;max-height:none!important;opacity:1!important;visibility:visible!important
}
.pw-logo-frame,[data-pw-logo-frame="1"]{display:inline-flex!important;align-items:center;justify-content:center;overflow:hidden!important;flex-shrink:0;position:relative;vertical-align:middle;max-width:none!important;max-height:none!important}
.pw-logo-frame:not([data-pw-z]),[data-pw-logo-frame="1"]:not([data-pw-z]){z-index:${PW_SCENE_LOGO_Z}!important}
h1 .pw-logo-frame:not([data-pw-logo-user-size="1"]),h1 [data-pw-logo-frame="1"]:not([data-pw-logo-user-size="1"]),[data-pw-el="heading"] .pw-logo-frame:not([data-pw-logo-user-size="1"]),[data-pw-info-title] .pw-logo-frame:not([data-pw-logo-user-size="1"]),.pw-shop-info .pw-logo-frame:not([data-pw-logo-user-size="1"]):not([data-pw-logo-float="1"]),main .pw-logo-frame:not([data-pw-logo-user-size="1"]):not([data-pw-logo-float="1"]){max-width:180px!important}
h1 a.pw-brand:not([data-pw-logo-float]),h1 a[data-pw-logo-home]:not([data-pw-logo-float]),[data-pw-el="heading"] a.pw-brand:not([data-pw-logo-float]),[data-pw-info-title] a.pw-brand:not([data-pw-logo-float]){width:max-content!important;max-width:180px!important}
body:not(.nanoai-ve-active) a.pw-brand,
body:not(.nanoai-ve-active) a.pw-shop-brand,
body:not(.nanoai-ve-active) a[data-pw-logo-home],
body:not(.nanoai-ve-active) .pw-logo-frame,
body:not(.nanoai-ve-active) [data-pw-logo-frame="1"],
body:not(.nanoai-ve-active) [data-pw-logo-float="1"],
body:not(.nanoai-ve-active) header img.pw-logo,
body:not(.nanoai-ve-active) header img.pw-shop-logo,
body:not(.nanoai-ve-active) .pw-header img.pw-logo,
body:not(.nanoai-ve-active) .pw-shop-header img.pw-shop-logo{
  cursor:pointer!important;pointer-events:auto!important
}
.pw-logo-frame img,[data-pw-logo-frame="1"] img{max-width:none!important;max-height:none!important;width:100%!important;height:100%!important;object-fit:contain!important;object-position:center center!important}
header .pw-logo-frame img,header [data-pw-logo-frame="1"] img,.pw-header .pw-logo-frame img,.pw-shop-header .pw-logo-frame img{object-position:center center!important}
header .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),header [data-pw-logo-frame="1"]:not([data-pw-logo-float="1"]) ~ [data-pw-logo-frame="1"]:not([data-pw-logo-float="1"]),.pw-header .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),.pw-shop-header .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),.pw-brand-cluster > .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),.pw-shop-brand-cluster > .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]){display:none!important}
header a.pw-brand img.pw-logo ~ img.pw-logo,header a.pw-shop-brand img.pw-logo ~ img.pw-logo,.pw-header a.pw-brand img.pw-shop-logo ~ img.pw-shop-logo{display:none!important}
.pw-header-search,.pw-shop-search-wrap{flex:1 1 0%!important;min-width:72px!important;min-height:36px!important;max-width:100%!important;width:auto!important;margin:0!important;position:relative;z-index:1;opacity:1;visibility:visible}
.pw-search-form,.pw-shop-search-form,form[data-pw-search-form]{display:flex!important;align-items:stretch!important;width:100%!important;min-width:0!important;box-sizing:border-box}
.pw-search-form input[type="search"],.pw-shop-search-form input[type="search"],input[data-pw-search]{flex:1 1 auto!important;min-width:0!important;width:auto!important;max-width:none!important}
.pw-search-form .pw-search-image-btn:not([data-pw-chrome-size]),.pw-search-form .pw-shop-search-image:not([data-pw-chrome-size]),.pw-shop-search-form .pw-search-image-btn:not([data-pw-chrome-size]),.pw-shop-search-form .pw-shop-search-image:not([data-pw-chrome-size]),.pw-search-form .pw-search-submit:not([data-pw-chrome-size]),.pw-search-form .pw-shop-search-submit:not([data-pw-chrome-size]),.pw-shop-search-form .pw-search-submit:not([data-pw-chrome-size]),.pw-shop-search-form .pw-shop-search-submit:not([data-pw-chrome-size]){--pw-chrome-size:${PW_SEARCH_ICON_SIZE.desktop}px}
${PW_SEARCH_IMAGE_IN_FORM_BTN_CSS}
${PW_SEARCH_IMAGE_IN_FORM_WRAP_CSS}
.pw-search-form .pw-search-image-btn .pw-chrome-btn-label,.pw-search-form .pw-search-image-btn .pw-shop-nav-label,.pw-search-form .pw-shop-search-image .pw-chrome-btn-label,.pw-search-form .pw-shop-search-image .pw-shop-nav-label,.pw-shop-search-form .pw-search-image-btn .pw-chrome-btn-label,.pw-shop-search-form .pw-search-image-btn .pw-shop-nav-label,.pw-shop-search-form .pw-shop-search-image .pw-chrome-btn-label,.pw-shop-search-form .pw-shop-search-image .pw-shop-nav-label{display:none!important}
.pw-search-form .pw-search-submit,.pw-search-form .pw-shop-search-submit,.pw-shop-search-form .pw-search-submit,.pw-shop-search-form .pw-shop-search-submit{flex:0 0 auto!important}
.pw-search-form .pw-search-image-btn svg,.pw-search-form .pw-shop-search-image svg,.pw-shop-search-form .pw-search-image-btn svg,.pw-shop-search-form .pw-shop-search-image svg,.pw-search-form .pw-search-submit svg,.pw-shop-search-form .pw-search-submit svg,.pw-search-form .pw-shop-search-submit-icon,.pw-shop-search-form .pw-shop-search-submit-icon{width:var(--pw-chrome-w,var(--pw-chrome-size,${PW_SEARCH_ICON_SIZE.desktop}px))!important;height:var(--pw-chrome-h,var(--pw-chrome-size,${PW_SEARCH_ICON_SIZE.desktop}px))!important;max-width:var(--pw-chrome-w,var(--pw-chrome-size,${PW_SEARCH_ICON_SIZE.desktop}px))!important;max-height:var(--pw-chrome-h,var(--pw-chrome-size,${PW_SEARCH_ICON_SIZE.desktop}px))!important;flex-shrink:0}
[data-pw-ph]::placeholder,input[style*="--pw-ph"]::placeholder,textarea[style*="--pw-ph"]::placeholder{color:var(--pw-ph)!important}
.pw-search-default-icon,.pw-shop-search-default-icon{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 auto;width:18px;height:100%;margin:0 0 0 10px;color:#9ca3af;pointer-events:none}
.pw-search-default-icon svg,.pw-shop-search-default-icon svg,.pw-search-default-glyph{display:block!important;width:${PW_SEARCH_ICON_SIZE.desktop}px!important;height:${PW_SEARCH_ICON_SIZE.desktop}px!important;max-width:${PW_SEARCH_ICON_SIZE.desktop}px!important;max-height:${PW_SEARCH_ICON_SIZE.desktop}px!important}
.pw-search-form .pw-search-submit,.pw-search-form .pw-shop-search-submit,.pw-shop-search-form .pw-search-submit,.pw-shop-search-form .pw-shop-search-submit{display:inline-flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:center!important;align-self:stretch!important;overflow:hidden!important;background:var(--pw-primary)!important;color:#fff!important}
.pw-search-form .pw-search-submit::before,.pw-search-form .pw-shop-search-submit::before,.pw-shop-search-form .pw-search-submit::before,.pw-shop-search-form .pw-shop-search-submit::before{content:none!important;display:none!important;width:0!important;height:0!important;background:none!important;-webkit-mask:none!important;mask:none!important}
.pw-search-form .pw-search-submit svg,.pw-search-form .pw-shop-search-submit svg,.pw-shop-search-form .pw-search-submit svg,.pw-shop-search-form .pw-shop-search-submit svg,.pw-search-form .pw-shop-search-submit-icon,.pw-shop-search-form .pw-shop-search-submit-icon{display:block!important;width:${PW_SEARCH_ICON_SIZE.desktop}px!important;height:${PW_SEARCH_ICON_SIZE.desktop}px!important;max-width:${PW_SEARCH_ICON_SIZE.desktop}px!important;max-height:${PW_SEARCH_ICON_SIZE.desktop}px!important;flex-shrink:0}
.pw-shop-search-submit-icon{display:none;width:18px;height:18px;flex-shrink:0}
.pw-search-submit:has(svg)::before,.pw-shop-search-submit:has(svg)::before{content:none!important;display:none!important}
@media (max-width:899px){
${PW_SCENE_UNLOCKED_HTML} .pw-shop-search-submit-label{display:none}
${PW_SCENE_UNLOCKED_HTML} .pw-shop-search-submit-icon{display:block;width:16px;height:16px}
${PW_SCENE_UNLOCKED_HTML} .pw-search-submit::before,${PW_SCENE_UNLOCKED_HTML} .pw-shop-search-submit::before{content:""!important;display:block!important;width:16px;height:16px;flex-shrink:0;background-color:currentColor!important;background-image:none!important;-webkit-mask:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");mask:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")}
${PW_SCENE_UNLOCKED_HTML} .pw-search-submit:has(svg)::before,${PW_SCENE_UNLOCKED_HTML} .pw-shop-search-submit:has(svg)::before,${PW_SCENE_UNLOCKED_HTML} .pw-search-submit:has(.pw-shop-search-submit-icon)::before,${PW_SCENE_UNLOCKED_HTML} .pw-shop-search-submit:has(.pw-shop-search-submit-icon)::before{content:none!important;display:none!important}
}
.pw-header-actions,.pw-shop-header-actions{flex:0 0 auto!important;margin-left:auto!important;z-index:2}
[data-pw-chrome-added]:not(.pw-shop-btn):not(.pw-shop-btn-buy):not(.pw-btn-hero){-webkit-appearance:none;appearance:none}
[data-pw-chrome-added].pw-cat-btn,[data-pw-chrome-added].pw-shop-cat-btn,[data-pw-el="cat-toggle"][data-pw-chrome-added]{
  background:transparent!important;border-color:transparent!important;box-shadow:none!important
}
${pwSceneChromeAddedVisibilityCss()}
@media (min-width:768px){
${PW_SCENE_UNLOCKED_HTML} [data-pw-chrome-added][data-pw-device="mobile"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
}
@media (max-width:767px){
${PW_SCENE_UNLOCKED_HTML} [data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
${PW_SCENE_UNLOCKED_HTML} [data-pw-chrome-added][data-pw-device="laptop"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
${PW_SCENE_UNLOCKED_HTML} [data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
}
@media (min-width:1280px){
${PW_SCENE_UNLOCKED_HTML} [data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
.pw-bottom-nav,.pw-shop-bottom-nav{display:none!important}
body{padding-bottom:0}
}
@media (max-width:1279px){
.pw-bottom-nav,.pw-shop-bottom-nav{display:flex!important;position:fixed!important;left:0;right:0;bottom:0;z-index:${PW_SCENE_HEAD_Z}!important;background:#fff}
body{padding-bottom:72px}
}
html[data-pw-scene-lock="desktop"] .pw-bottom-nav,html[data-pw-scene-lock="desktop"] .pw-shop-bottom-nav,html[data-pw-scene-lock="laptop"] .pw-bottom-nav,html[data-pw-scene-lock="laptop"] .pw-shop-bottom-nav,html[data-pw-edit-device="desktop"] .pw-bottom-nav,html[data-pw-edit-device="desktop"] .pw-shop-bottom-nav,html[data-pw-edit-device="laptop"] .pw-bottom-nav,html[data-pw-edit-device="laptop"] .pw-shop-bottom-nav{display:none!important}
html[data-pw-scene-lock="desktop"] body,html[data-pw-scene-lock="laptop"] body,html[data-pw-edit-device="desktop"] body,html[data-pw-edit-device="laptop"] body{padding-bottom:0}
html[data-pw-scene-lock="tablet"] .pw-bottom-nav,html[data-pw-scene-lock="tablet"] .pw-shop-bottom-nav,html[data-pw-scene-lock="mobile"] .pw-bottom-nav,html[data-pw-scene-lock="mobile"] .pw-shop-bottom-nav,html[data-pw-edit-device="tablet"] .pw-bottom-nav,html[data-pw-edit-device="tablet"] .pw-shop-bottom-nav,html[data-pw-edit-device="mobile"] .pw-bottom-nav,html[data-pw-edit-device="mobile"] .pw-shop-bottom-nav{display:flex!important;position:fixed!important;left:0;right:0;bottom:0;z-index:${PW_SCENE_HEAD_Z}!important;background:#fff}
html[data-pw-scene-lock="tablet"] body,html[data-pw-scene-lock="mobile"] body,html[data-pw-edit-device="tablet"] body,html[data-pw-edit-device="mobile"] body{padding-bottom:72px}
.pw-bottom-nav[data-pw-pdp-bottom],.pw-shop-bottom-nav[data-pw-pdp-bottom]{justify-content:flex-start!important;align-items:stretch!important;gap:6px!important;min-height:48px!important;padding:2px 6px calc(2px + env(safe-area-inset-bottom,0px))!important;background:#f3f4f6!important;border-top:1px solid #e5e7eb!important}
.pw-bottom-nav[data-pw-pdp-bottom] .pw-pdp-sticky-nav,.pw-shop-bottom-nav[data-pw-pdp-bottom] .pw-pdp-sticky-nav{display:flex;align-items:stretch;gap:1px;flex:0 0 auto;padding-right:6px;margin-right:2px;border-right:1px solid #e5e7eb}
.pw-bottom-nav[data-pw-pdp-bottom] .pw-pdp-sticky-ctas,.pw-shop-bottom-nav[data-pw-pdp-bottom] .pw-pdp-sticky-ctas{flex:1;min-width:0;display:flex;gap:4px}
.pw-bottom-nav[data-pw-pdp-bottom] .pw-shop-btn,.pw-shop-bottom-nav[data-pw-pdp-bottom] .pw-shop-btn{flex:1;min-height:40px;padding:0 8px!important;font-size:11px!important;font-weight:600!important;text-transform:uppercase;border-radius:6px!important;color:#fff!important;background:var(--pw-cart)!important}
.pw-bottom-nav[data-pw-pdp-bottom] .pw-shop-btn-buy,.pw-shop-bottom-nav[data-pw-pdp-bottom] .pw-shop-btn-buy{background:var(--pw-buy)!important;color:#fff!important}
.pw-bottom-nav[data-pw-pdp-bottom] .pw-pdp-sticky-nav a,.pw-bottom-nav[data-pw-pdp-bottom] .pw-pdp-sticky-nav button,.pw-shop-bottom-nav[data-pw-pdp-bottom] .pw-pdp-sticky-nav a,.pw-shop-bottom-nav[data-pw-pdp-bottom] .pw-pdp-sticky-nav button{flex:0 0 44px!important;width:44px!important;gap:2px!important;padding:2px 0!important;font-size:10px!important;line-height:1.05!important;color:#4b5563!important;background:transparent!important}
.pw-bottom-nav[data-pw-pdp-bottom] .is-try,.pw-shop-bottom-nav[data-pw-pdp-bottom] .is-try{color:var(--pw-primary)!important}
.pw-bottom-nav[data-pw-pdp-bottom] .is-fav[aria-pressed="true"],.pw-shop-bottom-nav[data-pw-pdp-bottom] .is-fav[aria-pressed="true"],.pw-bottom-nav[data-pw-pdp-bottom] .is-fav.is-active,.pw-shop-bottom-nav[data-pw-pdp-bottom] .is-fav.is-active{color:#e11d48!important}
.pw-bottom-nav[data-pw-pdp-bottom] .is-fav[aria-pressed="true"] svg,.pw-shop-bottom-nav[data-pw-pdp-bottom] .is-fav[aria-pressed="true"] svg,.pw-bottom-nav[data-pw-pdp-bottom] .is-fav.is-active svg,.pw-shop-bottom-nav[data-pw-pdp-bottom] .is-fav.is-active svg{fill:currentColor!important}
.pw-pdp-sticky-copy,.pw-pdp-like-copy{display:flex;flex-direction:column;align-items:center;line-height:1.05;text-align:center}
.pw-pdp-like-count{font-weight:600;font-variant-numeric:tabular-nums}
@media (max-width:767px){
html:has([data-pw-page="product"]) .pw-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),html:has([data-pw-page="product"]) .pw-shop-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),html[data-pw-page="product"] .pw-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),[data-pw-page="product"] .pw-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),[data-pw-page="product"] .pw-shop-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]){display:none!important}
}
html[data-pw-edit-device="mobile"]:has([data-pw-page="product"]) .pw-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),html[data-pw-edit-device="mobile"]:has([data-pw-page="product"]) .pw-shop-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),html[data-pw-scene-lock="mobile"]:has([data-pw-page="product"]) .pw-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),html[data-pw-scene-lock="mobile"]:has([data-pw-page="product"]) .pw-shop-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),html[data-pw-edit-device="mobile"] [data-pw-page="product"] .pw-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),html[data-pw-edit-device="mobile"] [data-pw-page="product"] .pw-shop-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),html[data-pw-scene-lock="mobile"] [data-pw-page="product"] .pw-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]),html[data-pw-scene-lock="mobile"] [data-pw-page="product"] .pw-shop-bottom-nav:not([data-pw-pdp-bottom]):not([data-pw-chrome-kit="dock"]){display:none!important}
${PARTNER_SHOP_CHROME_KIT_CSS}
${pwHostPrefixCss(
  PW_SCENE_PHONE_HOSTS,
  `.pw-bottom-nav[data-pw-chrome-kit="dock"],.pw-shop-bottom-nav[data-pw-chrome-kit="dock"]{min-height:${PW_DOCK_BAR_MIN_H.mobile}px!important}.pw-pdp-sticky-nav svg,.pw-bottom-nav[data-pw-chrome-kit="dock"] .pw-pdp-sticky-nav svg,.pw-shop-bottom-nav[data-pw-chrome-kit="dock"] .pw-pdp-sticky-nav svg{width:${PW_PDP_DOCK_GLYPH.mobile}px!important;height:${PW_PDP_DOCK_GLYPH.mobile}px!important;max-width:${PW_PDP_DOCK_GLYPH.mobile}px!important;max-height:${PW_PDP_DOCK_GLYPH.mobile}px!important}`
)}
${pwSceneDeviceVisibilityCss()}
${PARTNER_SHOP_MOBILE_HEADER_SEARCH_LOCK_CSS}
${PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS}
${PARTNER_SHOP_STICK_HEADER_CSS}
${PARTNER_SHOP_HIDDEN_CSS}
${PARTNER_SHOP_STAY_SCROLL_CSS}
${PARTNER_SHOP_CHROME_FLOAT_CSS}
${PW_CHROME_ICON_SQUARE_CSS}
${PARTNER_SHOP_FOOTER_INFLOW_CSS}
${PARTNER_SHOP_BANNER_MEDIA_FILL_CSS}
${PARTNER_SHOP_PAGE_FIT_CSS}
${PARTNER_SHOP_STACK_FLOW_CSS}
${PARTNER_SHOP_MID_INSERT_GAP_CSS}
${PARTNER_SHOP_BANNER_LIVE_MATCH_CSS}
${PARTNER_SHOP_AUTHORED_BLOCK_CSS}
${PARTNER_SHOP_HROW_CSS}
${PARTNER_SHOP_SLIDER_CSS}
${PARTNER_SHOP_WIDE_HEADER_BALANCE_CSS}
${PARTNER_SHOP_SEARCH_HISTORY_CSS}
${PARTNER_SHOP_TAP_CHROME_CSS}
${PW_MOBILE_HEADER_STACK_WIN_CSS}
${PW_MOBILE_HEADER_TOPBAR_HIDE_CSS}
html[data-pw-edit-device="mobile"] .pw-brand-cluster,html[data-pw-edit-device="mobile"] .pw-shop-brand-cluster,html[data-pw-scene-lock="mobile"] .pw-brand-cluster,html[data-pw-scene-lock="mobile"] .pw-shop-brand-cluster{pointer-events:auto!important}
html[data-pw-edit-device="mobile"] .pw-cat-btn,html[data-pw-edit-device="mobile"] .pw-shop-cat-btn,html[data-pw-edit-device="mobile"] [data-pw-el="cat-toggle"],html[data-pw-edit-device="mobile"] [data-pw-cat-toggle],html[data-pw-edit-device="mobile"] .pw-chrome-cat-wrap,html[data-pw-scene-lock="mobile"] .pw-cat-btn,html[data-pw-scene-lock="mobile"] .pw-shop-cat-btn,html[data-pw-scene-lock="mobile"] [data-pw-el="cat-toggle"],html[data-pw-scene-lock="mobile"] [data-pw-cat-toggle],html[data-pw-scene-lock="mobile"] .pw-chrome-cat-wrap{position:relative!important;z-index:200!important;pointer-events:auto!important}
@media (max-width:767px){html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-brand-cluster,html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-shop-brand-cluster{pointer-events:auto!important}html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-cat-btn,html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-shop-cat-btn,html:not([data-pw-edit-device]):not([data-pw-scene-lock]) [data-pw-el="cat-toggle"],html:not([data-pw-edit-device]):not([data-pw-scene-lock]) [data-pw-cat-toggle],html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-chrome-cat-wrap{position:relative!important;z-index:200!important;pointer-events:auto!important}}
`.trim()

/**
 * Runtime-only classes the editor adds while Sửa nhanh is open. Persisting them breaks two
 * things: `body:not(.nanoai-ve-active)` rules stop matching on the live shop, and the editor
 * refuses to re-arm on a document that already claims to be active.
 */
const VISUAL_EDITOR_RUNTIME_STATE_CLASSES = [
  'nanoai-ve-active',
  'nanoai-ve-selected',
  'nanoai-ve-highlight',
  'nanoai-ve-hover',
  'nanoai-ve-dragging',
  'nanoai-ve-photo-edit',
]

export function stripVisualEditorRuntimeStateClasses(html: string): string {
  if (!VISUAL_EDITOR_RUNTIME_STATE_CLASSES.some((cls) => html.includes(cls))) return html
  return html.replace(/<body\b[^>]*>/i, (bodyTag) =>
    bodyTag.replace(/\sclass=(["'])([\s\S]*?)\1/i, (_attr, quote: string, value: string) => {
      const kept = value
        .split(/\s+/)
        .filter((cls) => cls && !VISUAL_EDITOR_RUNTIME_STATE_CLASSES.includes(cls))
      return kept.length ? ` class=${quote}${kept.join(' ')}${quote}` : ''
    })
  )
}

/** Persisted author HTML contains deterministic styles only; runtime scripts are injected on render. */
export function injectPartnerShopChromeLayoutStyles(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return html
  let out = stripVisualEditorRuntimeStateClasses(trimmed)
  const styleTag = `<style id="${PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID}">${PARTNER_SHOP_CHROME_LAYOUT_CSS}</style>`
  let replaced = false
  out = out.replace(
    new RegExp(`<style id="${PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID}">[\\s\\S]*?<\\/style>`, 'gi'),
    () => {
      if (replaced) return ''
      replaced = true
      return styleTag
    }
  )
  if (!replaced) {
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${styleTag}\n</head>`)
    } else if (/<html[^>]*>/i.test(out)) {
      out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${styleTag}</head>`)
    } else {
      out = `${styleTag}\n${out}`
    }
  }
  return injectPartnerShopFontsIntoHtml(out)
}

export function injectPartnerShopChromeLayoutCss(html: string): string {
  let out = injectPartnerShopChromeLayoutStyles(html)
  if (!out.trim()) return out
  out = injectNamedScript(out, PARTNER_SHOP_SCENE_CENTER_SCRIPT_ID, PARTNER_SHOP_SCENE_CENTER_SCRIPT, true)
  if (!out.includes(PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID)) {
    const scriptTag = `<script id="${PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID}">${PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT}</script>`
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${scriptTag}\n</body>`)
    else out = `${out}\n${scriptTag}`
  }
  out = injectNamedScript(out, PARTNER_SHOP_STICK_HEADER_SCRIPT_ID, PARTNER_SHOP_STICK_HEADER_SCRIPT)
  out = injectNamedScript(out, PW_STAY_SCROLL_SCRIPT_ID, PARTNER_SHOP_STAY_SCROLL_SCRIPT)
  out = injectNamedScript(out, PW_CHROME_FLOAT_SCRIPT_ID, PARTNER_SHOP_CHROME_FLOAT_SCRIPT)
  out = injectNamedScript(out, PARTNER_SHOP_LOGO_HOST_SCRIPT_ID, PARTNER_SHOP_LOGO_HOST_SCRIPT)
  out = injectNamedScript(out, PARTNER_SHOP_SEARCH_CLAMP_SCRIPT_ID, PARTNER_SHOP_SEARCH_CLAMP_SCRIPT)
  out = injectNamedScript(out, PARTNER_SHOP_IMAGE_ZOOM_SCRIPT_ID, PARTNER_SHOP_IMAGE_ZOOM_SCRIPT)
  out = injectNamedScript(out, PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT_ID, PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT)
  out = injectNamedScript(out, PARTNER_SHOP_LISTING_HEAD_SCRIPT_ID, PARTNER_SHOP_LISTING_HEAD_SCRIPT)
  return out
}

function injectNamedScript(html: string, id: string, body: string, inHead = false): string {
  const tag = `<script id="${id}">${body}</script>`
  let replaced = false
  let out = html.replace(new RegExp(`<script id="${id}">[\\s\\S]*?<\\/script>`, 'gi'), () => {
    if (replaced) return ''
    replaced = true
    return tag
  })
  if (!replaced) {
    if (inHead && /<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${tag}\n</head>`)
    else if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${tag}\n</body>`)
    else out = `${out}\n${tag}`
  }
  return out
}
