/**
 * Mobile header logo — hàng riêng giữa, ẩn khi vuốt xuống (hysteresis 72 / 28).
 * UX 188 MobileHeader; engine dùng chung mọi shop. Không hex cam, không slug 188.
 */

export const PW_HEAD_LOGO_COLLAPSED_ATTR = 'data-pw-head-logo-collapsed'
export const PW_MOBILE_LOGO_SCROLL_COLLAPSE_Y = 72
export const PW_MOBILE_LOGO_SCROLL_EXPAND_Y = 28
export const PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT_ID = 'pw-shop-mobile-header-logo'

const HEADER_SEL = 'header.pw-header,header.pw-shop-header,[data-pw-region="header"]'

/** Hàng logo giữa + thu khi `data-pw-head-logo-collapsed`. Chỉ máy mobile. */
export const PW_MOBILE_HEADER_STACK_RULES = `
.pw-header-main,.pw-shop-header-inner{display:flex!important;flex-wrap:wrap!important;align-items:center!important;row-gap:4px!important;column-gap:6px!important;padding:6px 8px 8px!important}
.pw-brand-cluster,.pw-shop-brand-cluster,.pw-chrome-cat-wrap{display:contents!important;max-width:none!important;width:auto!important}
.pw-header a.pw-brand:not([data-pw-logo-float]),.pw-shop-header a.pw-shop-brand:not([data-pw-logo-float]),.pw-header a[data-pw-logo-home]:not([data-pw-logo-float]),.pw-shop-header a[data-pw-logo-home]:not([data-pw-logo-float]){order:-1!important;flex:1 1 100%!important;width:100%!important;max-width:100%!important;justify-content:center!important;align-items:center!important;position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;transform:none!important;display:flex!important;min-height:0!important;max-height:44px!important;overflow:hidden!important;margin:0!important;transition:max-height .2s ease-out,opacity .2s ease-out,min-height .2s ease-out,margin .2s ease-out!important}
.pw-header a.pw-brand:has(img):not([data-pw-logo-float]),.pw-shop-header a.pw-shop-brand:has(img):not([data-pw-logo-float]),.pw-header a[data-pw-logo-home]:has(img):not([data-pw-logo-float]),.pw-shop-header a[data-pw-logo-home]:has(img):not([data-pw-logo-float]){min-height:40px!important}
.pw-header a.pw-brand:not(:has(img)) .pw-wordmark,.pw-shop-header a.pw-shop-brand:not(:has(img)) .pw-wordmark,.pw-header a[data-pw-logo-home]:not(:has(img)) .pw-wordmark{display:inline-block!important;color:#fff!important;font-weight:800!important;font-size:18px!important;line-height:40px!important;min-height:40px!important}
.pw-logo,.pw-shop-logo,.pw-brand .pw-logo-frame img,.pw-shop-brand .pw-logo-frame img,.pw-brand [data-pw-logo-frame="1"] img,.pw-shop-brand [data-pw-logo-frame="1"] img{height:40px!important;width:auto!important;max-height:40px!important;max-width:min(200px,72vw)!important;object-fit:contain!important}
.pw-cat-btn:not([data-pw-chrome-added]),.pw-shop-cat-btn:not([data-pw-chrome-added]),.pw-brand-cluster [data-pw-chrome-btn="categories"]:not([data-pw-chrome-added]),.pw-shop-brand-cluster [data-pw-chrome-btn="categories"]:not([data-pw-chrome-added]){order:1!important}
.pw-header-search,.pw-shop-search-wrap{order:2!important;flex:1 1 0%!important;min-width:96px!important}
.pw-header-actions,.pw-shop-header-actions{order:3!important;max-width:none!important;overflow:visible!important;margin-left:0!important}
`.trim()

/** Ẩn chữ head trên mobile — thắng leftover `icon-label-below` (`display:block!important`). Dock vẫn có chữ. */
export const PW_MOBILE_HEADER_ICON_ONLY_RULES = `
.pw-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"] .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"] .pw-chrome-btn-label,.pw-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"] .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"] .pw-shop-nav-label,.pw-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"] .pw-shop-icon-label,.pw-shop-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"] .pw-shop-icon-label,.pw-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"] .pw-account-btn-label,.pw-shop-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"] .pw-account-btn-label,.pw-header-actions [data-pw-chrome-btn][data-pw-chrome-style="icon-label-below"]>span:not(.pw-chrome-icon-wrap):not(.pw-cart-badge):not(.pw-shop-cart-badge):not([data-pw-chrome-badge]):not(.pw-chrome-chat-logo),.pw-shop-header-actions [data-pw-chrome-btn][data-pw-chrome-style="icon-label-below"]>span:not(.pw-chrome-icon-wrap):not(.pw-cart-badge):not(.pw-shop-cart-badge):not([data-pw-chrome-badge]):not(.pw-chrome-chat-logo),.pw-header-actions .pw-chrome-label-below .pw-chrome-btn-label,.pw-shop-header-actions .pw-chrome-label-below .pw-chrome-btn-label,.pw-header-actions [data-pw-chrome-btn] .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-btn] .pw-chrome-btn-label,.pw-header-actions .pw-shop-icon-label,.pw-shop-header-actions .pw-shop-icon-label{display:none!important;font-size:0!important;height:0!important;max-height:0!important;overflow:hidden!important;margin:0!important;padding:0!important}
.pw-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"],.pw-shop-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"],.pw-header-actions .pw-chrome-label-below,.pw-shop-header-actions .pw-chrome-label-below,.pw-header-actions .pw-shop-icon-btn,.pw-shop-header-actions .pw-shop-icon-btn{flex-direction:row!important;min-width:40px!important;max-width:44px!important;padding:4px!important;gap:0!important}
`.trim()

const LOGO_ROW_SEL = [
  '.pw-header a.pw-brand:not([data-pw-logo-float])',
  '.pw-shop-header a.pw-shop-brand:not([data-pw-logo-float])',
  '.pw-header a[data-pw-logo-home]:not([data-pw-logo-float])',
  '.pw-shop-header a[data-pw-logo-home]:not([data-pw-logo-float])',
].join(',')

/** Thắng `html .pw-header-main{flex-wrap:nowrap}` và CSS kéo từ HTML visual. */
export const PW_MOBILE_HEADER_STACK_WIN_CSS = `
html[data-pw-edit-device="mobile"] .pw-container.pw-header-main,html[data-pw-scene-lock="mobile"] .pw-container.pw-header-main,html[data-pw-edit-device="mobile"] .pw-shop-header-inner,html[data-pw-scene-lock="mobile"] .pw-shop-header-inner{display:flex!important;flex-wrap:wrap!important}
@media (max-width:767px){html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-container.pw-header-main,html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-shop-header-inner{display:flex!important;flex-wrap:wrap!important}}
`.trim()

export const PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS = `
html[data-pw-edit-device="mobile"][${PW_HEAD_LOGO_COLLAPSED_ATTR}="1"] ${LOGO_ROW_SEL},
html[data-pw-scene-lock="mobile"][${PW_HEAD_LOGO_COLLAPSED_ATTR}="1"] ${LOGO_ROW_SEL},
html:not([data-pw-edit-device]):not([data-pw-scene-lock])[${PW_HEAD_LOGO_COLLAPSED_ATTR}="1"] ${LOGO_ROW_SEL}{max-height:0!important;min-height:0!important;opacity:0!important;margin:0!important;pointer-events:none!important}
html[data-pw-edit-device="mobile"][${PW_HEAD_LOGO_COLLAPSED_ATTR}="1"] .pw-header-main,
html[data-pw-edit-device="mobile"][${PW_HEAD_LOGO_COLLAPSED_ATTR}="1"] .pw-shop-header-inner,
html[data-pw-scene-lock="mobile"][${PW_HEAD_LOGO_COLLAPSED_ATTR}="1"] .pw-header-main,
html[data-pw-scene-lock="mobile"][${PW_HEAD_LOGO_COLLAPSED_ATTR}="1"] .pw-shop-header-inner,
html:not([data-pw-edit-device]):not([data-pw-scene-lock])[${PW_HEAD_LOGO_COLLAPSED_ATTR}="1"] .pw-header-main,
html:not([data-pw-edit-device]):not([data-pw-scene-lock])[${PW_HEAD_LOGO_COLLAPSED_ATTR}="1"] .pw-shop-header-inner{padding-top:4px!important;padding-bottom:6px!important;row-gap:0!important}
`.trim()

export const PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT = `(function(){
  var ATTR='${PW_HEAD_LOGO_COLLAPSED_ATTR}';
  var COLLAPSE=${PW_MOBILE_LOGO_SCROLL_COLLAPSE_Y};
  var EXPAND=${PW_MOBILE_LOGO_SCROLL_EXPAND_Y};
  var collapsed=false;
  var ro=null;
  function html(){return document.documentElement;}
  function isEditor(){
    return !!(document.body&&document.body.classList&&document.body.classList.contains('nanoai-ve-active'));
  }
  function isMobileHead(){
    var el=html();
    var d=(el.getAttribute('data-pw-edit-device')||el.getAttribute('data-pw-scene-lock')||'');
    if(d==='mobile')return true;
    if(d==='desktop'||d==='laptop'||d==='tablet')return false;
    return (window.innerWidth||el.clientWidth||0)<768;
  }
  function scrollY(){return window.scrollY||html().scrollTop||0;}
  function visibleHeader(){
    var nodes=document.querySelectorAll('${HEADER_SEL}');
    var i;
    for(i=0;i<nodes.length;i++){
      var el=nodes[i];
      var wrap=el.closest?el.closest('.pw-visual-desktop,.pw-visual-laptop,.pw-visual-tablet,.pw-visual-mobile'):null;
      if(wrap){
        try{if(window.getComputedStyle(wrap).display==='none')continue;}catch(eWrap){}
      }
      try{
        var cs=window.getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden')continue;
        if(el.getBoundingClientRect().height<=0)continue;
      }catch(eCs){}
      return el;
    }
    return null;
  }
  function measure(){
    var header=visibleHeader();
    var h=header?Math.round(header.getBoundingClientRect().height):0;
    html().style.setProperty('--pw-sticky-head',h+'px');
    var shop=document.querySelector('.pw-shop');
    if(shop&&shop.style)shop.style.setProperty('--pw-sticky-head',h+'px');
  }
  function watchHeader(){
    var header=visibleHeader();
    if(typeof ResizeObserver==='undefined')return;
    if(ro){try{ro.disconnect();}catch(eRo){}}
    if(!header)return;
    ro=new ResizeObserver(function(){measure();});
    try{ro.observe(header);}catch(eObs){}
  }
  function setCollapsed(next){
    collapsed=next;
    if(next)html().setAttribute(ATTR,'1');
    else html().removeAttribute(ATTR);
    measure();
  }
  function sync(){
    if(isEditor()||!isMobileHead()){
      if(collapsed)setCollapsed(false);
      else measure();
      return;
    }
    var y=scrollY();
    if(collapsed){
      if(y<=EXPAND)setCollapsed(false);
    }else if(y>COLLAPSE){
      setCollapsed(true);
    }
  }
  function onScroll(){sync();}
  function boot(){
    watchHeader();
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',function(){watchHeader();sync();});
})();`
