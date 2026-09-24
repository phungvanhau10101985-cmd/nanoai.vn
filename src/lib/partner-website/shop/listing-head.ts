/**
 * Head rút gọn khi cuộn — mọi trang shop (home / listing / PDP / giỏ / tài khoản / info).
 * Ẩn topbar + pill + hàng SEO; giữ Danh mục, ô tìm, nút head. Listing thêm bộ lọc dính head.
 * Một engine mọi shop. Không compact trong Sửa nhanh.
 */

export const PW_HEAD_COMPACT_ATTR = 'data-pw-head-compact'
export const PW_LISTING_FILTER_SLOT_ATTR = 'data-pw-listing-filter-slot'
export const PARTNER_SHOP_LISTING_HEAD_SCRIPT_ID = 'pw-shop-listing-head'
export const PW_LISTING_HEAD_COLLAPSE_Y = 72
export const PW_LISTING_HEAD_EXPAND_Y = 28

const COMPACT_HOSTS = [
  `html[${PW_HEAD_COMPACT_ATTR}="1"]`,
  `html[${PW_HEAD_COMPACT_ATTR}="1"]:not([data-pw-edit-device]):not([data-pw-scene-lock])`,
  `html[data-pw-page][${PW_HEAD_COMPACT_ATTR}="1"]`,
  `html[data-pw-edit-device][${PW_HEAD_COMPACT_ATTR}="1"]`,
  `html[data-pw-scene-lock][${PW_HEAD_COMPACT_ATTR}="1"]`,
  `.pw-shop[${PW_HEAD_COMPACT_ATTR}="1"]`,
] as const

function compactSel(parts: string): string {
  return parts
    .split(',')
    .map((sel) => sel.trim())
    .filter(Boolean)
    .flatMap((sel) => COMPACT_HOSTS.map((host) => `${host} ${sel}`))
    .join(',')
}

const COMPACT_HIDE_SEL = compactSel(
  '.pw-nav-main,.pw-shop-nav-row,[data-pw-personalize-nav],[data-pw-seo-row],.pw-seo-row,.pw-topbar,.pw-shop-topbar,[data-pw-region="topbar"]',
)
const COMPACT_MAIN_SEL = compactSel('.pw-header-main,.pw-shop-header-inner')
const COMPACT_LOGO_SEL = compactSel('.pw-logo,.pw-shop-logo')
const COMPACT_FRAME_SEL = compactSel('.pw-logo-frame,[data-pw-logo-frame="1"]')
const COMPACT_FRAME_IMG_SEL = compactSel(
  '.pw-logo-frame .pw-logo,.pw-logo-frame .pw-shop-logo,[data-pw-logo-frame="1"] img',
)
const COMPACT_FILTER_SEL = compactSel(
  `[${PW_LISTING_FILTER_SLOT_ATTR}] .pw-shop-filters,[${PW_LISTING_FILTER_SLOT_ATTR}] .pw-page-filters`,
)

export const PW_LISTING_HEAD_CSS = `
[${PW_LISTING_FILTER_SLOT_ATTR}]:empty{display:none!important;height:0!important;border:0!important;padding:0!important;margin:0!important}
[${PW_LISTING_FILTER_SLOT_ATTR}]{position:sticky;top:var(--pw-sticky-head,56px);z-index:499;display:block;width:100%;box-sizing:border-box;background:var(--pw-bg,#fff);border-bottom:1px solid var(--pw-border,#e5e7eb)}
[data-pw-live-chrome] [${PW_LISTING_FILTER_SLOT_ATTR}]{position:static!important;top:auto!important;z-index:auto!important}
html:not([data-pw-listing-filters-ready="1"]) [data-pw-inline-visual-root] [data-pw-catalog][data-category-id] [data-pw-grid]{visibility:hidden!important}
body.nanoai-ve-active [data-pw-catalog] [data-pw-grid],html.nanoai-ve-active [data-pw-catalog] [data-pw-grid]{visibility:visible!important}
[data-pw-catalog][data-pw-listing-pending="1"] [data-pw-grid]{opacity:.45}
[${PW_LISTING_FILTER_SLOT_ATTR}] .pw-shop-filters,[${PW_LISTING_FILTER_SLOT_ATTR}] .pw-page-filters,[${PW_LISTING_FILTER_SLOT_ATTR}] [data-pw-region="filters"]{position:static!important;top:auto!important;z-index:auto!important;margin:0 auto!important;padding:6px var(--pw-page-gutter,20px)!important;max-width:var(--pw-content,1200px);box-shadow:none!important;border-bottom:none!important;background:transparent!important}
${COMPACT_HIDE_SEL}{display:none!important;min-height:0!important;height:0!important;max-height:0!important;overflow:hidden!important;padding:0!important;margin:0!important;border:0!important}
${COMPACT_MAIN_SEL}{padding-top:4px!important;padding-bottom:4px!important;min-height:48px!important}
${COMPACT_LOGO_SEL}{height:28px!important;max-height:28px!important}
${COMPACT_FRAME_SEL}{width:var(--pw-logo-box-w,140px)!important;height:var(--pw-logo-box-h,36px)!important;max-height:none!important}
${COMPACT_FRAME_IMG_SEL}{height:100%!important;width:100%!important;max-height:none!important}
${COMPACT_FILTER_SEL}{padding-top:4px!important;padding-bottom:4px!important}
`.trim()

const HEADER_SEL = 'header.pw-header,header.pw-shop-header,[data-pw-region="header"]'

export const PARTNER_SHOP_LISTING_HEAD_SCRIPT = `(function(){
  if(window.__pwListingHeadBoot)return;window.__pwListingHeadBoot=1;
  var ATTR='${PW_HEAD_COMPACT_ATTR}';
  var SLOT='[${PW_LISTING_FILTER_SLOT_ATTR}]';
  var COLLAPSE=${PW_LISTING_HEAD_COLLAPSE_Y};
  var EXPAND=${PW_LISTING_HEAD_EXPAND_Y};
  var compact=false;
  function html(){return document.documentElement;}
  function editor(){
    try{if(typeof window.pwShopLiveUiOff==='function'&&window.pwShopLiveUiOff())return true;}catch(eOff){}
    return html().classList.contains('nanoai-ve-active')||document.body.classList.contains('nanoai-ve-active');
  }
  function stampPage(){
    var el=document.querySelector('[data-pw-page]');
    var page=el&&el.getAttribute?el.getAttribute('data-pw-page'):'';
    if(page)html().setAttribute('data-pw-page',page);
  }
  function isListing(){
    stampPage();
    var p=html().getAttribute('data-pw-page')||'';
    return p==='listing'||!!document.querySelector('[data-pw-region="filters"]');
  }
  function addScroll(y,n){
    if(!n)return y;
    try{var t=n.scrollTop||0;if(t>y)y=t;}catch(eAdd){}
    return y;
  }
  function scrollY(){
    var y=Math.max(window.scrollY||0,window.pageYOffset||0);
    y=addScroll(y,document.scrollingElement);
    y=addScroll(y,html());
    y=addScroll(y,document.body);
    try{if(window.visualViewport&&window.visualViewport.pageTop>y)y=window.visualViewport.pageTop;}catch(eVv){}
    return y;
  }
  function visibleHeader(){
    var nodes=document.querySelectorAll('${HEADER_SEL}');
    var i;
    for(i=0;i<nodes.length;i++){
      var el=nodes[i];
      var wrap=el.closest?el.closest('.pw-visual-desktop,.pw-visual-laptop,.pw-visual-tablet,.pw-visual-mobile'):null;
      if(wrap){try{if(window.getComputedStyle(wrap).display==='none')continue;}catch(eWrap){}}
      try{
        var cs=window.getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden')continue;
        if(el.getBoundingClientRect().height<=0)continue;
      }catch(eCs){}
      return el;
    }
    return null;
  }
  function canCompact(){
    if(editor())return false;
    return !!visibleHeader();
  }
  function measure(){
    var header=visibleHeader();
    var h=header?Math.round(header.getBoundingClientRect().height):0;
    html().style.setProperty('--pw-sticky-head',h+'px');
    var shop=document.querySelector('.pw-shop');
    if(shop&&shop.style)shop.style.setProperty('--pw-sticky-head',h+'px');
  }
  function chromeInner(){
    var chrome=document.querySelector('[data-pw-live-chrome]');
    if(!chrome)return null;
    return chrome.querySelector('[data-pw-live-chrome-scale]')||chrome;
  }
  function domStable(){
    if(!document.querySelector('[data-pw-inline-visual-root]'))return true;
    return html().getAttribute('data-pw-visual-ready')==='1';
  }
  function ensureSlot(){
    var inner=chromeInner();
    var slot=document.querySelector(SLOT);
    if(inner){
      if(!slot){
        slot=document.createElement('div');
        slot.setAttribute('${PW_LISTING_FILTER_SLOT_ATTR}','1');
      }
      if(slot.parentNode!==inner){
        try{inner.appendChild(slot);}catch(eSlot){}
      }
      return slot;
    }
    if(slot)return slot;
    if(editor()||!isListing())return null;
    var header=visibleHeader();
    if(!header||!header.parentNode)return null;
    slot=document.createElement('div');
    slot.setAttribute('${PW_LISTING_FILTER_SLOT_ATTR}','1');
    header.insertAdjacentElement('afterend',slot);
    return slot;
  }
  function shouldDropListingChrome(el){
    if(!el||!el.getAttribute)return false;
    if(el.closest&&(el.closest('header.pw-header')||el.closest('header.pw-shop-header')||el.closest('.pw-header')||el.closest('.pw-shop-header')||el.closest('[data-pw-region="header"]')||el.closest('[data-pw-chrome-kit="dock"]')||el.closest('[data-pw-chrome-kit="float"]')||el.closest('[data-pw-chrome-kit="actions"]')))return false;
    var kind=String(el.getAttribute('data-pw-chrome-btn')||'');
    if(kind==='favorites-link')return true;
    if(kind==='cart'||kind==='wishlist'||kind==='account'||kind==='recently-viewed'){
      return el.getAttribute('data-pw-chrome-kit')==='1' && !el.getAttribute('data-pw-chrome-added');
    }
    if(kind==='login'||kind==='contact'){
      var style=String(el.getAttribute('data-pw-chrome-style')||'');
      if(el.getAttribute('data-pw-chrome-added') && style==='icon-circle')return false;
      return el.getAttribute('data-pw-chrome-kit')==='1' || el.getAttribute('data-pw-el')==='link' || style==='text';
    }
    return false;
  }
  function stripEscapedChromeFromListing(host){
    if(!host||!host.querySelectorAll)return;
    var sel='[data-pw-chrome-btn="login"],[data-pw-chrome-btn="contact"],[data-pw-chrome-btn="favorites-link"],[data-pw-chrome-btn="cart"],[data-pw-chrome-btn="wishlist"],[data-pw-chrome-btn="account"],[data-pw-chrome-btn="recently-viewed"]';
    var nodes=host.querySelectorAll(sel);
    var i,el;
    for(i=0;i<nodes.length;i++){
      el=nodes[i];
      if(!shouldDropListingChrome(el))continue;
      try{el.remove();}catch(eRm){}
    }
    var bars=host.querySelectorAll('.pw-page-head .pw-topbar, .pw-page-head .pw-shop-topbar, .pw-page-head [data-pw-region="topbar"]');
    for(i=0;i<bars.length;i++){try{bars[i].remove();}catch(eT){}}
    var badges=host.querySelectorAll('.pw-cart-badge, .pw-shop-cart-badge, [data-pw-chrome-badge]');
    for(i=0;i<badges.length;i++){
      el=badges[i];
      if(!el)continue;
      if(el.closest&&(el.closest('header.pw-header')||el.closest('header.pw-shop-header')||el.closest('.pw-header')||el.closest('.pw-shop-header')||el.closest('[data-pw-region="header"]')||el.closest('[data-pw-chrome-kit="dock"]')||el.closest('[data-pw-chrome-kit="float"]')||el.closest('[data-pw-chrome-kit="actions"]')))continue;
      var parentBtn=el.closest&&el.closest('[data-pw-chrome-btn]');
      if(parentBtn&&!shouldDropListingChrome(parentBtn))continue;
      try{el.remove();}catch(eB){}
    }
  }
  function stripEscapedChromeFromPage(){
    var roots=document.querySelectorAll('main,.pw-shop-main,[data-pw-scene-root="1"],[data-pw-listing-filter-slot],.pw-page-head');
    var i;
    for(i=0;i<roots.length;i++)stripEscapedChromeFromListing(roots[i]);
  }
  function hoistFilters(){
    if(editor())return;
    stripEscapedChromeFromPage();
    var slot=ensureSlot();
    if(!slot)return;
    var bars=document.querySelectorAll('.pw-shop-filters,.pw-page-filters,[data-pw-region="filters"]');
    var i,bar;
    for(i=0;i<bars.length;i++){
      bar=bars[i];
      if(!bar||slot.contains(bar))continue;
      if(bar.getAttribute&&bar.getAttribute('data-pw-react-filters')==='1')continue;
      if(bar.closest&&(bar.closest('header')||bar.closest('[data-pw-region="header"]')))continue;
      stripEscapedChromeFromListing(bar);
      slot.appendChild(bar);
      break;
    }
    stripEscapedChromeFromListing(slot);
  }
  function setCompact(next){
    compact=next;
    var root=html();
    var shop=document.querySelector('.pw-shop');
    if(next){
      root.setAttribute(ATTR,'1');
      if(shop)shop.setAttribute(ATTR,'1');
    }else{
      root.removeAttribute(ATTR);
      if(shop)shop.removeAttribute(ATTR);
    }
    measure();
    try{if(typeof window.__pwMobileHeadLogoSync==='function')window.__pwMobileHeadLogoSync();}catch(eSync){}
  }
  function sync(){
    if(!domStable()){
      if(!canCompact()){
        if(compact)setCompact(false);
        else measure();
      }else{
        var y0=scrollY();
        if(compact){ if(y0<=EXPAND)setCompact(false); }
        else if(y0>COLLAPSE)setCompact(true);
        else measure();
      }
      return;
    }
    hoistFilters();
    try{ if(typeof window.__pwBindListingFilters==='function') window.__pwBindListingFilters(); }catch(eBind){}
    if(!canCompact()){
      if(compact)setCompact(false);
      else measure();
      return;
    }
    var y=scrollY();
    if(compact){
      if(y<=EXPAND)setCompact(false);
    }else if(y>COLLAPSE){
      setCompact(true);
    }else{
      measure();
    }
  }
  function boot(){stampPage();sync();}
  window.__pwListingHeadSync=sync;
  document.addEventListener('pw-shop-visual-ready',sync);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
  window.addEventListener('scroll',sync,{passive:true,capture:true});
  document.addEventListener('scroll',sync,{passive:true,capture:true});
  document.addEventListener('touchmove',sync,{passive:true,capture:true});
  window.addEventListener('resize',sync);
})();`
