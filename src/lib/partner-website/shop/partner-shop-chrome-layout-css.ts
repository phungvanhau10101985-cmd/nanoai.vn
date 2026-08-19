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

/** Persistent chrome layout — same rules Sửa nhanh uses, kept on the live shop. */
export const PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID = 'pw-shop-chrome-layout'

/** Clamp leftover logo coords so the box stays inside the device width. */
export const PARTNER_SHOP_LOGO_HOST_SCRIPT_ID = 'pw-shop-logo-host'
export const PARTNER_SHOP_LOGO_HOST_SCRIPT = `(function(){
  function clamp(){
    var viewW=document.documentElement.clientWidth||window.innerWidth||0;
    var logos=document.querySelectorAll('[data-pw-logo-float="1"]');
    for(var i=0;i<logos.length;i++){
      var el=logos[i];
      if(!el||!el.style)continue;
      var left=parseFloat(el.style.left);
      var top=parseFloat(el.style.top);
      var w=parseFloat(el.style.width)||0;
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

/** Mobile header: search is its own box — width does not follow logo/buttons. */
export const PARTNER_SHOP_MOBILE_HEADER_SEARCH_LOCK_CSS = `@media (max-width:899px){
.pw-header-main,.pw-shop-header-inner{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;column-gap:6px!important;padding:8px 10px!important}
.pw-header-main,.pw-shop-header-inner{overflow:visible!important;min-width:0!important;max-width:100%!important}
.pw-brand-cluster,.pw-shop-brand-cluster{flex:0 0 auto!important;width:auto!important;max-width:200px!important;overflow:visible!important}
.pw-header a.pw-brand:not([data-pw-logo-float]),.pw-shop-header a.pw-shop-brand:not([data-pw-logo-float]),.pw-header a[data-pw-logo-home]:not([data-pw-logo-float]),.pw-shop-header a[data-pw-logo-home]:not([data-pw-logo-float]){max-width:none!important;overflow:visible!important}
.pw-header a.pw-brand:has(img) .pw-wordmark,.pw-shop-header a.pw-shop-brand:has(img) .pw-wordmark,.pw-header a[data-pw-logo-home]:has(img) .pw-wordmark{display:none!important}
.pw-header-search:not([data-pw-user-move]),.pw-shop-search-wrap:not([data-pw-user-move]){flex:1 1 0%!important;width:auto!important;min-width:96px!important;max-width:100%!important;margin:0!important;min-height:36px!important;transform:none!important;position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;opacity:1!important;visibility:visible!important;z-index:170!important;display:flex!important}
.pw-header-search[data-pw-search-width]:not([data-pw-user-move]),.pw-shop-search-wrap[data-pw-search-width]:not([data-pw-user-move]){flex:1 1 0%!important;width:auto!important;min-width:96px!important;max-width:100%!important}
.pw-header-search[data-pw-user-move],.pw-shop-search-wrap[data-pw-user-move]{flex:0 0 auto!important;max-width:none!important;z-index:170!important;display:flex!important}
.pw-header-actions,.pw-shop-header-actions{flex:0 0 auto!important;display:flex!important;flex-wrap:nowrap!important;width:auto!important;max-width:42%!important;margin-left:auto!important}
}`

/** Beat leftover inline transform/width that would push chrome outside the device frame. */
export const PARTNER_SHOP_SEARCH_CLAMP_SCRIPT_ID = 'pw-shop-chrome-inset'
export const PARTNER_SHOP_SEARCH_CLAMP_SCRIPT = `(function(){
  function isCompact(){
    var stamped=document.documentElement&&document.documentElement.getAttribute('data-pw-edit-device');
    if(stamped==='desktop')return false;
    if(stamped==='mobile'||stamped==='tablet')return true;
    var w=window.innerWidth||document.documentElement.clientWidth||0;
    return w>0&&w<900;
  }
  function isFloatChrome(el){
    if(!el||!el.getAttribute)return false;
    if(el.getAttribute('data-pw-chrome-float')==='1')return true;
    var k=el.getAttribute('data-pw-chrome-btn')||'';
    return k==='chat'||k==='chat-zalo'||k==='chat-facebook'||k==='topup';
  }
  function pinFlow(el){
    if(!el||!el.style)return;
    if(el.classList&&el.classList.contains('pw-stick-header-on'))return;
    if(el.getAttribute&&el.getAttribute('data-pw-user-move'))return;
    if(isFloatChrome(el))return;
    el.style.setProperty('transform','none','important');
    el.style.setProperty('left','auto','important');
    el.style.setProperty('top','auto','important');
    el.style.setProperty('right','auto','important');
    el.style.setProperty('bottom','auto','important');
    el.style.setProperty('position','relative','important');
  }
  function pinSearch(el){
    if(!el||!el.style)return;
    if(el.getAttribute&&el.getAttribute('data-pw-user-move'))return;
    if(!isCompact()){
      pinFlow(el);
      var saved=parseFloat(el.getAttribute('data-pw-search-width')||'');
      if(saved>0){
        var w=Math.max(72,Math.min(360,Math.round(saved)));
        el.style.setProperty('flex','0 0 auto','important');
        el.style.setProperty('width',w+'px','important');
        el.style.setProperty('max-width','none','important');
        el.style.setProperty('min-width','72px','important');
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
    var search=document.querySelectorAll('.pw-header-search,.pw-shop-search-wrap,[data-pw-el="search"]');
    var i;
    for(i=0;i<search.length;i++)pinSearch(search[i]);
    var icons=document.querySelectorAll(
      'header .pw-icon-btn,header .pw-shop-icon-btn,.pw-header .pw-icon-btn,.pw-shop-header .pw-icon-btn,'+
      '.pw-header-actions [data-pw-chrome-btn],.pw-shop-header-actions [data-pw-chrome-btn],'+
      '.pw-header-actions [data-pw-chrome-added],.pw-shop-header-actions [data-pw-chrome-added],'+
      '.pw-cat-btn,.pw-shop-cat-btn,.pw-account-btn,'+
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

export const PARTNER_SHOP_CHROME_LAYOUT_CSS = `
html,body{overflow-x:hidden!important;max-width:100%}
.pw-header .pw-icon-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-shop-header .pw-icon-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-header .pw-shop-icon-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-shop-header .pw-shop-icon-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-header-actions [data-pw-chrome-btn]:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-shop-header-actions [data-pw-chrome-btn]:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-header .pw-account-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-shop-header .pw-account-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-header .pw-cat-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-shop-header .pw-cat-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-bottom-nav>a:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-shop-bottom-nav>a:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-bottom-nav>button:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-shop-bottom-nav>button:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]){transform:none!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important}
[data-pw-chrome-added],[data-pw-chrome-btn],[data-pw-el="cat-toggle"]{--pw-chrome-size:22px;--pw-chrome-label:calc(var(--pw-chrome-size,22px)*13/22);--pw-chrome-pad-y:calc(var(--pw-chrome-size,22px)*4/22);--pw-chrome-pad-x:calc(var(--pw-chrome-size,22px)*12/22);--pw-chrome-gap:calc(var(--pw-chrome-size,22px)*6/22)}
.pw-chrome-icon-wrap{position:relative!important;display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;width:var(--pw-chrome-size,22px)!important;height:var(--pw-chrome-size,22px)!important;flex-shrink:0!important;overflow:visible!important}
.pw-chrome-icon-wrap svg,.pw-chrome-icon-wrap .pw-shop-nav-icon{width:var(--pw-chrome-size,22px)!important;height:var(--pw-chrome-size,22px)!important;max-width:var(--pw-chrome-size,22px)!important;max-height:var(--pw-chrome-size,22px)!important;display:block!important;opacity:1!important;visibility:visible!important;stroke:currentColor!important;fill:none!important;flex-shrink:0}
.pw-chrome-icon-wrap svg.pw-chrome-brand-logo{stroke:none!important;fill:none!important}
.pw-chrome-icon-wrap .pw-chrome-chat-logo{width:var(--pw-chrome-size,22px)!important;height:var(--pw-chrome-size,22px)!important;max-width:var(--pw-chrome-size,22px)!important;max-height:var(--pw-chrome-size,22px)!important;object-fit:cover!important;border-radius:999px!important;display:block!important;pointer-events:none!important;flex-shrink:0}
[data-pw-chrome-btn="chat"] .pw-chrome-icon-wrap,[data-pw-chrome-btn="chat-zalo"] .pw-chrome-icon-wrap,[data-pw-chrome-btn="chat-facebook"] .pw-chrome-icon-wrap{overflow:hidden!important;border-radius:999px!important}
[data-pw-chrome-btn="chat"] .pw-chrome-chat-logo{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:cover!important;border-radius:999px!important}
[data-pw-chrome-btn="chat"][data-pw-chat-icon-logo="1"] .pw-chrome-icon-wrap,[data-pw-chrome-btn="chat"][data-pw-chat-icon-logo="1"] .pw-chrome-chat-logo{border-radius:999px!important;object-fit:cover!important}
.pw-chrome-icon-wrap .pw-cart-badge,.pw-chrome-icon-wrap .pw-shop-cart-badge{position:absolute!important;top:-5px!important;right:-9px!important;left:auto!important;bottom:auto!important;min-width:16px;height:16px;margin:0!important;z-index:5}
${PW_CHROME_COUNT_BADGE_HIDE_CSS}
.pw-header-actions .pw-icon-btn,.pw-shop-header-actions .pw-icon-btn,.pw-header-actions .pw-shop-icon-btn,.pw-shop-header-actions .pw-shop-icon-btn,.pw-header-actions [data-pw-chrome-btn],.pw-shop-header-actions [data-pw-chrome-btn]{overflow:visible!important}
.pw-bottom-nav,.pw-shop-bottom-nav{display:flex!important;flex-wrap:nowrap!important;grid-template-columns:none!important;justify-content:space-around;align-items:stretch;overflow:visible;z-index:180!important;isolation:isolate;background:#fff}
.pw-bottom-nav>a,.pw-shop-bottom-nav>a,.pw-bottom-nav .pw-icon-btn,.pw-shop-bottom-nav .pw-icon-btn,.pw-bottom-nav .pw-shop-icon-btn,.pw-shop-bottom-nav .pw-shop-icon-btn{
  flex:1 1 0!important;min-width:0!important;min-height:0!important;width:auto!important;height:auto!important;
  display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
  gap:2px!important;padding:6px 2px!important;background:transparent!important;position:relative!important;color:#6b7280!important;overflow:visible!important
}
.pw-bottom-nav>a.is-active,.pw-shop-bottom-nav>a.is-active{color:var(--pw-primary)!important}
.pw-bottom-nav>a:not([data-pw-chrome-added]),.pw-shop-bottom-nav>a:not([data-pw-chrome-added]){
  transform:none;left:auto;top:auto;right:auto;bottom:auto
}
.pw-bottom-nav svg,.pw-shop-bottom-nav svg{width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;flex-shrink:0;stroke:currentColor!important;fill:none!important}
.pw-bottom-nav .pw-shop-icon-label,.pw-shop-bottom-nav .pw-shop-icon-label,.pw-bottom-nav .pw-chrome-btn-label,.pw-shop-bottom-nav .pw-chrome-btn-label,.pw-bottom-nav .pw-shop-nav-label,.pw-shop-bottom-nav .pw-shop-nav-label,.pw-bottom-nav>a>span:not(.pw-chrome-icon-wrap):not(.pw-cart-badge):not(.pw-shop-cart-badge),.pw-shop-bottom-nav>a>span:not(.pw-chrome-icon-wrap):not(.pw-cart-badge):not(.pw-shop-cart-badge){
  display:block!important;max-width:100%!important;white-space:normal!important;overflow:visible!important;text-overflow:unset!important;text-align:center;line-height:1.15;overflow-wrap:break-word;word-break:break-word
}
.pw-header-actions .pw-chrome-icon-only,.pw-shop-header-actions .pw-chrome-icon-only,
.pw-nav-main .pw-chrome-icon-only,.pw-shop-nav-row .pw-chrome-icon-only,
[data-pw-chrome-added].pw-chrome-icon-only,
[data-pw-chrome-btn="chat"].pw-chrome-icon-only,[data-pw-chrome-btn="chat-zalo"].pw-chrome-icon-only,[data-pw-chrome-btn="chat-facebook"].pw-chrome-icon-only,
.pw-cat-btn.pw-chrome-icon-only,.pw-shop-cat-btn.pw-chrome-icon-only{
  width:calc(var(--pw-chrome-size,22px) + 14px)!important;height:calc(var(--pw-chrome-size,22px) + 14px)!important;
  min-width:calc(var(--pw-chrome-size,22px) + 14px)!important;min-height:calc(var(--pw-chrome-size,22px) + 14px)!important;
  padding:0!important;border-radius:999px!important;flex-direction:row!important
}
.pw-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only),
.pw-header-actions .pw-chrome-has-label,.pw-shop-header-actions .pw-chrome-has-label,
.pw-header-actions .pw-chrome-link,.pw-shop-header-actions .pw-chrome-link,
[data-pw-chrome-added].pw-chrome-has-label,[data-pw-chrome-added].pw-chrome-link{
  display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;
  gap:var(--pw-chrome-gap,6px)!important;width:auto!important;height:auto!important;min-width:0!important;
  min-height:calc(var(--pw-chrome-size,22px) + 14px)!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px)!important;border-radius:999px!important;background:transparent!important;font-size:var(--pw-chrome-label,13px)!important;font-weight:700!important
}
.pw-header-actions .pw-chrome-icon-only,.pw-shop-header-actions .pw-chrome-icon-only,
[data-pw-chrome-added].pw-chrome-icon-only,
.pw-cat-btn.pw-chrome-icon-only,.pw-shop-cat-btn.pw-chrome-icon-only{
  padding:0!important
}
[data-pw-el="cat-toggle"]:not(.pw-chrome-icon-only),.pw-cat-btn:not(.pw-chrome-icon-only),.pw-shop-cat-btn:not(.pw-chrome-icon-only){
  height:auto!important;min-height:calc(var(--pw-chrome-size,22px) + 14px)!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px)!important;
  font-size:var(--pw-chrome-label,13px)!important;gap:var(--pw-chrome-gap,6px)!important
}
.pw-header-actions .pw-chrome-icon-square,.pw-shop-header-actions .pw-chrome-icon-square,
.pw-nav-main .pw-chrome-icon-square,.pw-shop-nav-row .pw-chrome-icon-square,
[data-pw-chrome-added].pw-chrome-icon-square,
[data-pw-chrome-btn="chat"].pw-chrome-icon-square,[data-pw-chrome-btn="chat-zalo"].pw-chrome-icon-square,[data-pw-chrome-btn="chat-facebook"].pw-chrome-icon-square,
.pw-bottom-nav [data-pw-chrome-added].pw-chrome-icon-square,.pw-shop-bottom-nav [data-pw-chrome-added].pw-chrome-icon-square{
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
.pw-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only) .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only) .pw-chrome-btn-label,
.pw-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only) .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only) .pw-shop-nav-label{
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
  display:block!important;text-align:center!important;white-space:normal!important;max-width:4.8rem!important
}
.pw-header-actions [data-pw-chrome-added].pw-chrome-label-left:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-left:not(.pw-chrome-icon-only),
.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"]:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"]:not(.pw-chrome-icon-only){
  flex-direction:row-reverse!important;align-items:center!important;justify-content:center!important
}
.pw-header-actions [data-pw-chrome-added].pw-chrome-label-left .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-left .pw-chrome-btn-label,
.pw-header-actions [data-pw-chrome-added].pw-chrome-label-left .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-left .pw-shop-nav-label,
.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"] .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"] .pw-chrome-btn-label,
.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"] .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"] .pw-shop-nav-label{
  display:inline!important;white-space:nowrap!important;text-align:left!important;max-width:none!important
}
.pw-chrome-icon-only .pw-chrome-btn-label,.pw-chrome-icon-only .pw-shop-nav-label,.pw-chrome-icon-only .pw-shop-icon-label{display:none!important}
.pw-nav-main [data-pw-chrome-added]:not(.pw-chrome-icon-only),.pw-shop-nav-row [data-pw-chrome-added]:not(.pw-chrome-icon-only){
  display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:var(--pw-chrome-gap,6px)!important;
  width:auto!important;height:auto!important;min-width:0!important;background:transparent!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px)!important;border-radius:999px!important;font-size:var(--pw-chrome-label,13px)!important
}
.pw-bottom-nav [data-pw-chrome-added].pw-chrome-icon-only,.pw-shop-bottom-nav [data-pw-chrome-added].pw-chrome-icon-only{
  flex:0 0 auto!important;width:calc(var(--pw-chrome-size,22px) + 14px)!important;height:calc(var(--pw-chrome-size,22px) + 14px)!important;
  min-width:calc(var(--pw-chrome-size,22px) + 14px)!important;min-height:calc(var(--pw-chrome-size,22px) + 14px)!important;
  padding:0!important;border-radius:999px!important;flex-direction:row!important
}
.pw-bottom-nav [data-pw-chrome-added].pw-chrome-has-label,.pw-shop-bottom-nav [data-pw-chrome-added].pw-chrome-has-label,
.pw-bottom-nav [data-pw-chrome-added].pw-chrome-link,.pw-shop-bottom-nav [data-pw-chrome-added].pw-chrome-link{
  flex:0 0 auto!important;width:auto!important;height:auto!important;min-width:0!important;
  min-height:calc(var(--pw-chrome-size,22px) + 14px)!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px)!important;border-radius:999px!important;flex-direction:row!important;gap:var(--pw-chrome-gap,6px)!important;font-size:var(--pw-chrome-label,13px)!important
}
.pw-chrome-label-below,[data-pw-chrome-style="icon-label-below"],
.pw-header-actions .pw-chrome-label-below,.pw-shop-header-actions .pw-chrome-label-below,
.pw-nav-main .pw-chrome-label-below,.pw-shop-nav-row .pw-chrome-label-below,
.pw-bottom-nav .pw-chrome-label-below,.pw-shop-bottom-nav .pw-chrome-label-below,
[data-pw-chrome-added].pw-chrome-label-below,
.pw-bottom-nav [data-pw-chrome-added].pw-chrome-label-below,.pw-shop-bottom-nav [data-pw-chrome-added].pw-chrome-label-below{
  flex-direction:column!important;align-items:center!important;justify-content:center!important;
  padding:var(--pw-chrome-pad-y,4px) 6px!important;border-radius:10px!important
}
.pw-chrome-label-below .pw-chrome-btn-label,.pw-chrome-label-below .pw-shop-nav-label,.pw-chrome-label-below .pw-shop-icon-label,
[data-pw-chrome-style="icon-label-below"] .pw-chrome-btn-label,[data-pw-chrome-style="icon-label-below"] .pw-shop-nav-label{
  display:block!important;text-align:center!important;white-space:normal!important;max-width:4.8rem!important
}
.pw-chrome-label-left,[data-pw-chrome-style="icon-label-left"],
.pw-header-actions .pw-chrome-label-left,.pw-shop-header-actions .pw-chrome-label-left,
.pw-nav-main .pw-chrome-label-left,.pw-shop-nav-row .pw-chrome-label-left,
.pw-bottom-nav .pw-chrome-label-left,.pw-shop-bottom-nav .pw-chrome-label-left,
[data-pw-chrome-added].pw-chrome-label-left,
.pw-bottom-nav [data-pw-chrome-added].pw-chrome-label-left,.pw-shop-bottom-nav [data-pw-chrome-added].pw-chrome-label-left{
  flex-direction:row-reverse!important;align-items:center!important;justify-content:center!important
}
.pw-chrome-label-left .pw-chrome-btn-label,.pw-chrome-label-left .pw-shop-nav-label,.pw-chrome-label-left .pw-shop-icon-label,
[data-pw-chrome-style="icon-label-left"] .pw-chrome-btn-label,[data-pw-chrome-style="icon-label-left"] .pw-shop-nav-label{
  display:inline!important;white-space:nowrap!important;text-align:left!important;max-width:none!important
}
.pw-bottom-nav [data-pw-chrome-added] svg,.pw-shop-bottom-nav [data-pw-chrome-added] svg{
  width:var(--pw-chrome-size,22px)!important;height:var(--pw-chrome-size,22px)!important;
  max-width:var(--pw-chrome-size,22px)!important;max-height:var(--pw-chrome-size,22px)!important
}
.pw-nav-main>a,.pw-nav-main>a.pw-nav-sale,.pw-nav-main>a.is-sale,.pw-nav-main>button,
.pw-shop-nav-row>a,.pw-shop-nav-row>a.pw-nav-sale,.pw-shop-nav-row>a.is-sale,.pw-shop-nav-row>button,
.pw-cat-panel a,.pw-cat-panel a.pw-nav-sale,.pw-cat-panel a.is-sale,
.pw-shop-cat-panel a,.pw-shop-cat-panel a.pw-nav-sale,.pw-shop-cat-panel a.is-sale{color:#374151!important}
.pw-header,.pw-shop-header{position:sticky!important;top:0!important;z-index:200!important;isolation:isolate;display:flex!important;flex-direction:column!important}
.pw-nav-main,.pw-shop-nav-row{width:100%!important;max-width:100%!important;flex:0 0 auto!important;box-sizing:border-box}
@media (min-width:900px){
.pw-nav-main,.pw-shop-nav-row{display:flex!important;flex-wrap:nowrap!important;justify-content:center!important;align-items:center!important;gap:12px!important;overflow-x:auto!important;padding-left:16px!important;padding-right:16px!important}
.pw-nav-main>a,.pw-nav-main>button,.pw-shop-nav-row>a,.pw-shop-nav-row>button{white-space:nowrap!important;flex:0 0 auto!important}
}
@media (max-width:899px){
.pw-nav-main,.pw-shop-nav-row{display:none!important}
}
@media (min-width:900px) and (max-width:1439px){
.pw-nav-main,.pw-shop-nav-row{gap:8px!important;padding-left:12px!important;padding-right:12px!important}
.pw-nav-main>a,.pw-nav-main>button,.pw-shop-nav-row>a,.pw-shop-nav-row>button{font-size:11px!important;letter-spacing:.04em!important}
.pw-header-main,.pw-shop-header-inner{gap:8px!important;align-items:center!important}
.pw-brand-cluster,.pw-shop-brand-cluster,.pw-header-actions,.pw-shop-header-actions{align-self:center!important;align-items:center!important}
}
.pw-topbar,.pw-shop-topbar{position:relative!important;z-index:3!important;isolation:isolate}
.pw-header,.pw-shop-header,.pw-header-main,.pw-shop-header-inner,.pw-brand-cluster,.pw-shop-brand-cluster{overflow:visible!important}
.pw-header-main,.pw-shop-header-inner{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;min-width:0;position:relative!important;max-width:none!important;width:100%!important;margin-left:0!important;margin-right:0!important}
.pw-brand-cluster,.pw-shop-brand-cluster,.pw-brand:not([data-pw-logo-float]),.pw-shop-brand:not([data-pw-logo-float]),a[data-pw-logo-home]:not([data-pw-logo-float]){position:relative!important;z-index:120!important;flex:0 0 auto!important;overflow:visible!important}
.pw-brand-cluster,.pw-shop-brand-cluster{pointer-events:none!important}
.pw-brand-cluster > *,.pw-shop-brand-cluster > *,.pw-brand-cluster a,.pw-shop-brand-cluster a,.pw-brand-cluster button,.pw-shop-brand-cluster button,.pw-brand-cluster img,.pw-shop-brand-cluster img,.pw-brand-cluster [data-pw-el],.pw-shop-brand-cluster [data-pw-el],.pw-brand-cluster .pw-logo-frame,.pw-shop-brand-cluster .pw-logo-frame,.pw-brand-cluster [data-pw-logo-frame],.pw-shop-brand-cluster [data-pw-logo-frame]{pointer-events:auto!important}
header [data-pw-logo-float="1"],.pw-header [data-pw-logo-float="1"],.pw-shop-header [data-pw-logo-float="1"]{
  position:absolute!important;margin:0!important;max-width:none!important;max-height:none!important;overflow:visible!important
}
header [data-pw-logo-float="1"]:not([data-pw-z]),.pw-header [data-pw-logo-float="1"]:not([data-pw-z]),.pw-shop-header [data-pw-logo-float="1"]:not([data-pw-z]){z-index:160!important}
header img.pw-logo,header img.pw-shop-logo,.pw-header img.pw-logo,.pw-shop-header img.pw-shop-logo,header [data-pw-logo-added],.pw-header [data-pw-logo-added],.pw-shop-header [data-pw-logo-added]{
  z-index:160!important;overflow:visible!important;object-fit:contain!important;object-position:left center!important;max-width:none!important;max-height:none!important
}
header .pw-logo-frame img,header [data-pw-logo-frame="1"] img,.pw-header .pw-logo-frame img,.pw-shop-header .pw-logo-frame img,header img[data-pw-logo-float],.pw-header img[data-pw-logo-float],.pw-shop-header img[data-pw-logo-float]{
  max-width:none!important;max-height:none!important
}
header,.pw-header,.pw-shop-header,.pw-header-main,.pw-shop-header-inner,.pw-brand-cluster,.pw-shop-brand-cluster,a.pw-brand,a.pw-shop-brand{background-repeat:no-repeat!important}
body:not(.nanoai-ve-active) [data-pw-logo-empty="1"],body:not(.nanoai-ve-active) .pw-logo-frame:has([data-pw-logo-empty="1"]),body:not(.nanoai-ve-active) [data-pw-logo-frame="1"]:has([data-pw-logo-empty="1"]){display:none!important}
header [data-pw-logo-added],.pw-header [data-pw-logo-added],.pw-shop-header [data-pw-logo-added],header .pw-logo-frame img,header [data-pw-logo-frame="1"] img{
  max-width:none!important;max-height:none!important;opacity:1!important;visibility:visible!important
}
.pw-logo-frame,[data-pw-logo-frame="1"]{display:inline-flex!important;align-items:center;justify-content:center;overflow:hidden!important;flex-shrink:0;position:relative;z-index:160!important;vertical-align:middle;max-width:none!important;max-height:none!important}
.pw-logo-frame img,[data-pw-logo-frame="1"] img{max-width:none!important;max-height:none!important;width:100%!important;height:100%!important;object-fit:contain!important}
header .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),header [data-pw-logo-frame="1"]:not([data-pw-logo-float="1"]) ~ [data-pw-logo-frame="1"]:not([data-pw-logo-float="1"]),.pw-header .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),.pw-shop-header .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),.pw-brand-cluster > .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),.pw-shop-brand-cluster > .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]){display:none!important}
header a.pw-brand img.pw-logo ~ img.pw-logo,header a.pw-shop-brand img.pw-logo ~ img.pw-logo,.pw-header a.pw-brand img.pw-shop-logo ~ img.pw-shop-logo{display:none!important}
.pw-header-search,.pw-shop-search-wrap{flex:1 1 0%!important;min-width:72px!important;min-height:36px!important;max-width:100%!important;width:auto!important;margin:0!important;position:relative;z-index:1;opacity:1;visibility:visible}
@media (min-width:900px){
.pw-header-search:not([data-pw-user-move]),.pw-shop-search-wrap:not([data-pw-user-move]){flex:0 0 auto!important;width:auto!important;max-width:360px!important}
.pw-header-search[data-pw-search-width]:not([data-pw-user-move]),.pw-shop-search-wrap[data-pw-search-width]:not([data-pw-user-move]){flex:0 0 auto!important;max-width:none!important}
}
.pw-search-form,.pw-shop-search-form,form[data-pw-search-form]{display:flex!important;align-items:stretch!important;width:100%!important;min-width:0!important;box-sizing:border-box}
.pw-search-form input[type="search"],.pw-shop-search-form input[type="search"],input[data-pw-search]{flex:1 1 auto!important;min-width:0!important;width:auto!important;max-width:none!important}
[data-pw-ph]::placeholder,input[style*="--pw-ph"]::placeholder,textarea[style*="--pw-ph"]::placeholder{color:var(--pw-ph)!important}
.pw-shop-search-submit-icon{display:none;width:18px;height:18px;flex-shrink:0}
@media (max-width:899px){
.pw-shop-search-submit-label{display:none}
.pw-shop-search-submit-icon{display:block;width:16px;height:16px}
.pw-search-submit::before,.pw-shop-search-submit::before{content:""!important;display:block!important;width:16px;height:16px;flex-shrink:0;background-color:currentColor!important;background-image:none!important;-webkit-mask:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");mask:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")}
.pw-search-submit:has(.pw-shop-search-submit-icon)::before,.pw-shop-search-submit:has(.pw-shop-search-submit-icon)::before{content:none!important;display:none!important}
}
.pw-header-actions,.pw-shop-header-actions{flex:0 0 auto!important;margin-left:0!important;z-index:2}
@media (min-width:768px){
[data-pw-chrome-added][data-pw-device="mobile"]:not([data-pw-chrome-count]):not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
}
@media (max-width:767px){
[data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-chrome-count]):not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
[data-pw-chrome-added][data-pw-device="laptop"]:not([data-pw-chrome-count]):not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-chrome-count]):not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
}
@media (min-width:1280px){
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-chrome-count]):not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
.pw-bottom-nav,.pw-shop-bottom-nav{display:none!important}
body{padding-bottom:0}
}
@media (max-width:1279px){
.pw-bottom-nav,.pw-shop-bottom-nav{display:flex!important;position:fixed!important;left:0;right:0;bottom:0;z-index:180!important;isolation:isolate;background:#fff}
body{padding-bottom:72px}
}
${PARTNER_SHOP_MOBILE_HEADER_SEARCH_LOCK_CSS}
${PARTNER_SHOP_STICK_HEADER_CSS}
${PARTNER_SHOP_CHROME_FLOAT_CSS}
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

export function injectPartnerShopChromeLayoutCss(html: string): string {
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
  if (!out.includes(PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID)) {
    const scriptTag = `<script id="${PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID}">${PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT}</script>`
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${scriptTag}\n</body>`)
    else out = `${out}\n${scriptTag}`
  }
  out = injectNamedScript(out, PARTNER_SHOP_STICK_HEADER_SCRIPT_ID, PARTNER_SHOP_STICK_HEADER_SCRIPT)
  out = injectNamedScript(out, PW_CHROME_FLOAT_SCRIPT_ID, PARTNER_SHOP_CHROME_FLOAT_SCRIPT)
  out = injectNamedScript(out, PARTNER_SHOP_LOGO_HOST_SCRIPT_ID, PARTNER_SHOP_LOGO_HOST_SCRIPT)
  out = injectNamedScript(out, PARTNER_SHOP_SEARCH_CLAMP_SCRIPT_ID, PARTNER_SHOP_SEARCH_CLAMP_SCRIPT)
  return out
}

function injectNamedScript(html: string, id: string, body: string): string {
  const tag = `<script id="${id}">${body}</script>`
  let replaced = false
  let out = html.replace(new RegExp(`<script id="${id}">[\\s\\S]*?<\\/script>`, 'gi'), () => {
    if (replaced) return ''
    replaced = true
    return tag
  })
  if (!replaced) {
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${tag}\n</body>`)
    else out = `${out}\n${tag}`
  }
  return out
}
