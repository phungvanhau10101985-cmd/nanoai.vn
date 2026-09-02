/**
 * Listing `/c` `/search` — bộ lọc dính head; cuộn thì head mỏng.
 * Một engine mọi shop. Không hoist trong Sửa nhanh.
 */

export const PW_HEAD_COMPACT_ATTR = 'data-pw-head-compact'
export const PW_LISTING_FILTER_SLOT_ATTR = 'data-pw-listing-filter-slot'
export const PARTNER_SHOP_LISTING_HEAD_SCRIPT_ID = 'pw-shop-listing-head'
export const PW_LISTING_HEAD_COLLAPSE_Y = 72
export const PW_LISTING_HEAD_EXPAND_Y = 28

export const PW_LISTING_HEAD_CSS = `
[${PW_LISTING_FILTER_SLOT_ATTR}]:empty{display:none!important;height:0!important;border:0!important;padding:0!important;margin:0!important}
[${PW_LISTING_FILTER_SLOT_ATTR}]{position:sticky;top:var(--pw-sticky-head,56px);z-index:499;display:block;width:100%;box-sizing:border-box;background:var(--pw-bg,#fff);border-bottom:1px solid var(--pw-border,#e5e7eb)}
[${PW_LISTING_FILTER_SLOT_ATTR}] .pw-shop-filters,[${PW_LISTING_FILTER_SLOT_ATTR}] .pw-page-filters,[${PW_LISTING_FILTER_SLOT_ATTR}] [data-pw-region="filters"]{position:static!important;top:auto!important;z-index:auto!important;margin:0 auto!important;padding:6px var(--pw-page-gutter,20px)!important;max-width:var(--pw-content,1200px);box-shadow:none!important;border-bottom:none!important;background:transparent!important}
html[data-pw-page="listing"][data-pw-head-compact="1"] .pw-nav-main,html[data-pw-page="listing"][data-pw-head-compact="1"] .pw-shop-nav-row,html[data-pw-page="listing"][data-pw-head-compact="1"] [data-pw-seo-row],html[data-pw-page="listing"][data-pw-head-compact="1"] .pw-topbar,html[data-pw-page="listing"][data-pw-head-compact="1"] .pw-shop-topbar{display:none!important;min-height:0!important;height:0!important;max-height:0!important;overflow:hidden!important;padding:0!important;margin:0!important;border:0!important}
html[data-pw-page="listing"][data-pw-head-compact="1"] .pw-header-main,html[data-pw-page="listing"][data-pw-head-compact="1"] .pw-shop-header-inner{padding-top:4px!important;padding-bottom:4px!important;min-height:48px!important}
html[data-pw-page="listing"][data-pw-head-compact="1"] .pw-logo,html[data-pw-page="listing"][data-pw-head-compact="1"] .pw-shop-logo{height:28px!important;max-height:28px!important}
html[data-pw-page="listing"][data-pw-head-compact="1"] [${PW_LISTING_FILTER_SLOT_ATTR}] .pw-shop-filters,html[data-pw-page="listing"][data-pw-head-compact="1"] [${PW_LISTING_FILTER_SLOT_ATTR}] .pw-page-filters{padding-top:4px!important;padding-bottom:4px!important}
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
  function measure(){
    var header=visibleHeader();
    var h=header?Math.round(header.getBoundingClientRect().height):0;
    html().style.setProperty('--pw-sticky-head',h+'px');
    var shop=document.querySelector('.pw-shop');
    if(shop&&shop.style)shop.style.setProperty('--pw-sticky-head',h+'px');
  }
  function ensureSlot(){
    var slot=document.querySelector(SLOT);
    if(slot)return slot;
    if(editor()||!isListing())return null;
    var header=visibleHeader();
    if(!header||!header.parentNode)return null;
    slot=document.createElement('div');
    slot.setAttribute('${PW_LISTING_FILTER_SLOT_ATTR}','1');
    header.insertAdjacentElement('afterend',slot);
    return slot;
  }
  function hoistFilters(){
    if(editor())return;
    var slot=ensureSlot();
    if(!slot)return;
    var bars=document.querySelectorAll('.pw-shop-filters,.pw-page-filters,[data-pw-region="filters"]');
    var i,bar;
    for(i=0;i<bars.length;i++){
      bar=bars[i];
      if(!bar||slot.contains(bar))continue;
      if(bar.getAttribute&&bar.getAttribute('data-pw-react-filters')==='1')continue;
      if(bar.closest&&(bar.closest('header')||bar.closest('[data-pw-region="header"]')))continue;
      slot.appendChild(bar);
      break;
    }
  }
  function setCompact(next){
    compact=next;
    if(next)html().setAttribute(ATTR,'1');
    else html().removeAttribute(ATTR);
    measure();
    try{if(typeof window.__pwMobileHeadLogoSync==='function')window.__pwMobileHeadLogoSync();}catch(eSync){}
  }
  function sync(){
    hoistFilters();
    if(!isListing()||editor()){
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
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
  window.addEventListener('scroll',sync,{passive:true,capture:true});
  document.addEventListener('scroll',sync,{passive:true,capture:true});
  document.addEventListener('touchmove',sync,{passive:true,capture:true});
  window.addEventListener('resize',sync);
})();`
