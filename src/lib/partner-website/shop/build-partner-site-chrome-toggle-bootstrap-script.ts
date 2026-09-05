import type { WebLocale } from '@/lib/i18n/config'
import {
  getPartnerSiteAccountMenuItems,
  getPartnerSiteCategoryNavLabels,
  partnerSiteAccountMenuIconSvg,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteShopSkipAuthSyncKey } from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
import {
  partnerCategoryNavAllLabel,
  PARTNER_CATEGORY_MEGA_LAYOUT_CSS,
  PARTNER_CATEGORY_MEGA_WIDTH_PX,
  PARTNER_HORIZONTAL_NAV_L1_LIMIT,
} from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import {
  partnerSiteCategoriesApiPath,
  partnerSiteCategoryHubPath,
  partnerSiteCategoryPath,
  partnerSitePersonalizationApiPath,
  partnerSiteInfoPath,
  partnerSiteKhoSalePath,
  partnerSiteProductsPath,
  partnerSiteAccountPath,
  partnerSiteLoginPath,
  partnerSiteAuthSyncApiPath,
  partnerSiteSessionApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'

/**
 * Live HTML shop: open/close category chrome, fill mega menu from
 * GET /api/site/{slug}/categories. Also upgrades plain `data-pw-chrome-btn`
 * account/category widgets added in Sửa nhanh so they share the same APIs.
 *
 * Account/login: khách → /login?redirect=<trang hiện tại>; đã đăng nhập → /account.
 * Category panels are scoped per device chrome (desktop/laptop/tablet/mobile).
 */
export function buildPartnerSiteChromeToggleBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const locale = input.locale
  const shop = getPartnerSiteShopCopy(locale)
  const nav = getPartnerSiteCategoryNavLabels(locale)
  const catApi = partnerSiteCategoriesApiPath(slug)
  const featuredNavApi = `${partnerSitePersonalizationApiPath(slug, 'featured-categories')}?limit=8`
  const productsPath = partnerSiteProductsPath(slug)
  const salePath = partnerSiteInfoPath(slug, 'sale')
  const khoSalePath = partnerSiteKhoSalePath(slug)
  const catHubPath = partnerSiteCategoryHubPath(slug)
  const catPrefix = partnerSiteCategoryPath(slug, '__PATH__').replace('__PATH__', '')
  const accountMenu = getPartnerSiteAccountMenuItems({ siteSlug: slug, locale })
    .filter((item) => !item.isHeader)
    .map((item) => ({
      href: item.href,
      label: item.label,
      isAccent: Boolean(item.isAccent),
      isLogout: Boolean(item.isLogout),
      icon: partnerSiteAccountMenuIconSvg(item.id),
    }))
  const sessionApi = partnerSiteSessionApiPath(slug)
  const authSyncApi = partnerSiteAuthSyncApiPath(slug)
  const accountLoginPath = partnerSiteAccountPath(slug)
  const shopLoginPath = partnerSiteLoginPath(slug)
  const skipAuthSyncKey = partnerSiteShopSkipAuthSyncKey(slug)

  return `<script data-pw-chrome-toggle-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
window.__pwChromeToggleBoot=1;
var SITE_SLUG=${JSON.stringify(slug)};
var SKIP_AUTH_SYNC_KEY=${JSON.stringify(skipAuthSyncKey)};
var SKIP_AUTH_SYNC_HDR=${JSON.stringify('x-pw-shop-skip-auth-sync')};
var CAT_API=${JSON.stringify(catApi)};
var FEATURED_NAV_API=${JSON.stringify(featuredNavApi)};
var PRODUCTS_PATH=${JSON.stringify(productsPath)};
var SALE_PATH=${JSON.stringify(salePath)};
var KHO_SALE_PATH=${JSON.stringify(khoSalePath)};
var CAT_HUB_PATH=${JSON.stringify(catHubPath)};
var CAT_PREFIX=${JSON.stringify(catPrefix)};
var NAV_PILL_LIMIT=${JSON.stringify(PARTNER_HORIZONTAL_NAV_L1_LIMIT)};
var LOCALE=${JSON.stringify(locale)};
var ACCOUNT_MENU=${JSON.stringify(accountMenu)};
var SESSION_API=${JSON.stringify(sessionApi)};
var AUTH_SYNC_API=${JSON.stringify(authSyncApi)};
var ACCOUNT_LOGIN_PATH=${JSON.stringify(accountLoginPath)};
var SHOP_LOGIN_PATH=${JSON.stringify(shopLoginPath)};
var SESSION_HDR='x-guest-session-id';
var ACCOUNT_HDR='x-guest-account-id';
var SESSION_LS='app_guest_session_id';
var SESSION_LS_LEGACY='nanoai_guest_session_id';
var ACCOUNT_LS='app_guest_account_id';
var ACCOUNT_LS_LEGACY='nanoai_guest_account_id';
var SESSION_COOKIE='app_guest_session_sync';
var ACCOUNT_COOKIE='app_guest_account_sync';
var authReady=false;
var isLoggedIn=false;
var sessionId='';
var accountId='';
var COPY=${JSON.stringify({
    categories: shop.navCategories,
    account: shop.navAccount,
    newArrivals: nav.newArrivals,
    sale: nav.sale,
    megaHint: shop.categoryMegaHint,
    khoSale: shop.khoSaleNavLabel,
    khoSaleBlurb: shop.khoSaleNavBlurb,
    khoSaleViewAll: shop.khoSaleViewAll,
    seoRow: shop.categorySeoRowAria,
    expand: shop.categoryExpand,
    collapse: shop.categoryCollapse,
    navAll: partnerCategoryNavAllLabel(locale),
    hubTitle: shop.categoryHubTitle,
    close: shop.cartAddedClose,
  })};
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function readCookie(name){
  var parts=String(document.cookie||'').split(';');
  for(var i=0;i<parts.length;i++){
    var chunk=parts[i].trim().split('=');
    if(chunk[0]===name)return decodeURIComponent((chunk.slice(1).join('='))||'');
  }
  return '';
}
function readStoredAuth(){
  sessionId='';accountId='';
  try{
    sessionId=String(window.localStorage.getItem(SESSION_LS)||window.localStorage.getItem(SESSION_LS_LEGACY)||'').trim();
    accountId=String(window.localStorage.getItem(ACCOUNT_LS)||window.localStorage.getItem(ACCOUNT_LS_LEGACY)||'').trim();
  }catch(errLs){}
  if(!sessionId)sessionId=readCookie(SESSION_COOKIE).trim();
  if(!accountId)accountId=readCookie(ACCOUNT_COOKIE).trim();
  isLoggedIn=!!accountId;
}
function applyLocalAuth(){
  readStoredAuth();
  if(shouldSkipAuthSync()){
    accountId='';
    isLoggedIn=false;
  }
}
function authReqHeaders(){
  var h={};
  if(sessionId)h[SESSION_HDR]=sessionId;
  if(shouldSkipAuthSync()){
    h[SKIP_AUTH_SYNC_HDR]='1';
    return h;
  }
  if(accountId)h[ACCOUNT_HDR]=accountId;
  return h;
}
function persistAuthIds(){
  try{
    if(sessionId){
      window.localStorage.setItem(SESSION_LS,sessionId);
      window.localStorage.setItem(SESSION_LS_LEGACY,sessionId);
    }
    if(accountId){
      window.localStorage.setItem(ACCOUNT_LS,accountId);
      window.localStorage.setItem(ACCOUNT_LS_LEGACY,accountId);
    }
  }catch(errPersist){}
}
function shouldSkipAuthSync(){
  try{return window.sessionStorage.getItem(SKIP_AUTH_SYNC_KEY)==='1';}catch(errSkip){return false;}
}
function markSkipAuthSync(){
  try{window.sessionStorage.setItem(SKIP_AUTH_SYNC_KEY,'1');}catch(errMark){}
}
function clearSkipAuthSync(){
  try{window.sessionStorage.removeItem(SKIP_AUTH_SYNC_KEY);}catch(errClearSkip){}
}
function hydrateAuth(done){
  applyLocalAuth();
  if(shouldSkipAuthSync()){
    authReady=true;
    if(done)done();
    return;
  }
  fetch(SESSION_API,{method:'POST',credentials:'same-origin',headers:authReqHeaders()}).then(function(res){
    var sid=res.headers.get(SESSION_HDR);
    if(sid&&sid.trim())sessionId=sid.trim();
    return fetch(AUTH_SYNC_API,{method:'POST',credentials:'same-origin',headers:authReqHeaders()}).then(function(syncRes){
      var aid=syncRes.headers.get(ACCOUNT_HDR);
      return syncRes.json().catch(function(){return {};}).then(function(json){
        if(aid&&aid.trim())accountId=aid.trim();
        else if(json&&json.accountId)accountId=String(json.accountId).trim();
        else accountId='';
        isLoggedIn=!!accountId;
        if(isLoggedIn)clearSkipAuthSync();
        persistAuthIds();
        authReady=true;
        if(done)done();
      });
    });
  }).catch(function(){
    authReady=true;
    if(done)done();
  });
}
function expandAccountHref(href){
  var h=String(href||'').trim();
  if(!h)return '';
  // Bare /account… (custom-domain style) while ACCOUNT_LOGIN_PATH is /site/{slug}/account
  // — expand so platform + srcDoc iframe do not 404 on NanoAI /account.
  if(/^\\/account(\\/|$)/.test(h) && /^\\/site\\//.test(ACCOUNT_LOGIN_PATH)){
    return ACCOUNT_LOGIN_PATH.replace(/\\/account\\/?$/,'')+h;
  }
  return h;
}
function accountLoginHref(btn){
  var href=btn&&btn.getAttribute?btn.getAttribute('data-pw-account-fallback-href'):'';
  var expanded=expandAccountHref(href);
  if(expanded)return expanded;
  // Prefer baked path — srcDoc iframe pathname is about:srcdoc (not /site/…), so never
  // fall back to bare /account on the platform host.
  return ACCOUNT_LOGIN_PATH||'/account';
}
function currentReturnLocation(){
  var p=(window.location&&window.location.pathname)||'/';
  var s=(window.location&&window.location.search)||'';
  var h=(window.location&&window.location.hash)||'';
  if(!p||p.indexOf('srcdoc')>=0||p.charAt(0)!=='/')return ACCOUNT_LOGIN_PATH||'/account';
  if(/\\/login\\/?$/.test(String(p).split('?')[0]))return ACCOUNT_LOGIN_PATH||'/account';
  return p+s+h;
}
function shopLoginHref(){
  var dest=currentReturnLocation()||ACCOUNT_LOGIN_PATH||'/account';
  var base=SHOP_LOGIN_PATH||'/login';
  return base+(base.indexOf('?')>=0?'&':'?')+'redirect='+encodeURIComponent(dest);
}
function guestOrAccountHref(){
  return isLoggedIn?(ACCOUNT_LOGIN_PATH||'/account'):shopLoginHref();
}
function navigateAccountLogin(btn){
  var dest=isLoggedIn?accountLoginHref(btn):shopLoginHref();
  if(!dest)return;
  try{
    if(window.top&&window.top!==window){
      window.top.location.href=dest;
      return;
    }
  }catch(errTop){}
  window.location.href=dest;
}
function clearShopSession(){
  sessionId='';accountId='';isLoggedIn=false;
  markSkipAuthSync();
  try{
    window.localStorage.removeItem(SESSION_LS);
    window.localStorage.removeItem(SESSION_LS_LEGACY);
    window.localStorage.removeItem(ACCOUNT_LS);
    window.localStorage.removeItem(ACCOUNT_LS_LEGACY);
  }catch(errClear){}
  try{
    document.cookie=SESSION_COOKIE+'=; Max-Age=0; path=/';
    document.cookie=ACCOUNT_COOKIE+'=; Max-Age=0; path=/';
  }catch(errCookie){}
  fetch(SESSION_API,{method:'DELETE',credentials:'same-origin'}).finally(function(){
    window.location.reload();
  });
}
function catName(n){
  var i18n=n&&(n.nameI18n||n.name_i18n)||{};
  return String((i18n[LOCALE]||(n&&n.name)||'')).trim();
}
function isKhoSaleNode(n){
  var id=String((n&&n.id)||'');
  var slug=String((n&&n.slug)||'').toLowerCase();
  var name=String((n&&n.name)||'').toLowerCase();
  return id==='__kho-sale'||slug==='kho-sale'||slug==='sale-kho'||name==='sale kho'||name==='kho sale';
}
function catHref(pathOrNode){
  if(pathOrNode&&typeof pathOrNode==='object'){
    if(isKhoSaleNode(pathOrNode))return KHO_SALE_PATH;
    pathOrNode=pathOrNode.path||pathOrNode.slug||'';
  }
  var segs=String(pathOrNode||'').split('/').map(function(s){return s.trim()}).filter(Boolean).map(encodeURIComponent);
  return segs.length?CAT_PREFIX+segs.join('/'):PRODUCTS_PATH;
}
function catSel(){return '[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn,[data-pw-chrome-btn="categories"]'}
function panelSel(){return '[data-pw-cat-panel],.pw-shop-cat-panel,.pw-cat-panel,#pw-shop-cat-panel,#pw-cat-panel'}
function accBtnSel(){return '[data-pw-account-toggle],.pw-account-btn,[data-pw-chrome-btn="account"],.pw-bottom-nav a[href$="/account"],.pw-shop-bottom-nav a[href$="/account"]'}
function accPanelSel(){return '[data-pw-account-panel],.pw-shop-account-panel,.pw-account-panel,#pw-shop-account-panel,#pw-account-panel'}
function deviceRoot(el){
  return (el&&el.closest&&el.closest('[data-pw-visual-device],.pw-visual-desktop,.pw-visual-laptop,.pw-visual-tablet,.pw-visual-mobile'))||document;
}
function qs(root,sel){return (root||document).querySelector(sel)}
function isInsidePanel(el,sel){return !!(el&&el.closest&&el.closest(sel))}
function ensureAccountWrap(btn){
  if(!btn)return null;
  if(btn.closest&&btn.closest('.pw-bottom-nav,.pw-shop-bottom-nav'))return null;
  var wrap=btn.closest('.pw-account-wrap,.pw-shop-account-wrap,.pw-chrome-account-wrap');
  if(wrap)return wrap;
  wrap=document.createElement('div');
  wrap.className='pw-account-wrap pw-chrome-account-wrap';
  if(btn.parentNode){
    btn.parentNode.insertBefore(wrap,btn);
    wrap.appendChild(btn);
  }
  return wrap;
}
function isPlacedCatBtn(el){
  if(!el||!el.getAttribute)return false;
  if(el.getAttribute('data-pw-user-move')==='1')return true;
  if(el.getAttribute('data-pw-stay-scroll')==='1')return true;
  var st=el.style;
  if(!st)return false;
  var pos=st.position||'';
  if(pos==='absolute'||pos==='fixed')return true;
  var left=st.left||'';
  var top=st.top||'';
  return (left&&left!=='auto')||(top&&top!=='auto');
}
function transferCatBox(from,to){
  if(!from||!to||!from.style||!to.style)return;
  /* The wrapper becomes the positioned box. Leaving canonical placement on the
     child makes it absolute inside a zero-sized wrapper and shifts the button. */
  var props=['position','inset','left','top','right','bottom','z-index'];
  for(var i=0;i<props.length;i++){
    var p=props[i];
    var v=from.style.getPropertyValue(p);
    if(!v)continue;
    to.style.setProperty(p,v,from.style.getPropertyPriority(p)||'');
    from.style.removeProperty(p);
  }
  var attrs=['data-pw-placement','data-pw-coordinate-root','data-pw-box-x','data-pw-box-y','data-pw-box-w','data-pw-box-h'];
  for(var j=0;j<attrs.length;j++){
    var a=attrs[j],value=from.getAttribute(a);
    if(value==null)continue;
    to.setAttribute(a,value);
    from.removeAttribute(a);
  }
  if(from.getAttribute('data-pw-user-move'))to.setAttribute('data-pw-user-move','1');
  to.setAttribute('data-pw-cat-placed','1');
}
function hoverCapable(){
  try{return window.matchMedia('(hover: hover) and (pointer: fine)').matches;}catch(errHover){return false;}
}
function ensureCatWrap(btn){
  if(!btn)return null;
  var existing=btn.closest('.pw-chrome-cat-wrap');
  if(existing)return existing;
  var wrap=document.createElement('span');
  wrap.className='pw-chrome-cat-wrap';
  if(isPlacedCatBtn(btn))transferCatBox(btn,wrap);
  if(btn.parentNode){
    btn.parentNode.insertBefore(wrap,btn);
    wrap.appendChild(btn);
  }
  return wrap;
}
function bindMega(panel){
  var items=panel.querySelectorAll('[data-pw-cat-l1]');
  function show(id){
    if(!id)return;
    var panes=panel.querySelectorAll('[data-pw-cat-pane]');
    var i;
    for(i=0;i<panes.length;i++){
      if(panes[i].getAttribute('data-pw-cat-pane')===id)panes[i].removeAttribute('hidden');
      else panes[i].setAttribute('hidden','');
    }
    for(i=0;i<items.length;i++){
      if(items[i].getAttribute('data-pw-cat-l1')===id)items[i].classList.add('is-active');
      else items[i].classList.remove('is-active');
    }
  }
  for(var j=0;j<items.length;j++){
    items[j].addEventListener('mouseenter',function(){show(this.getAttribute('data-pw-cat-l1'));});
    items[j].addEventListener('focus',function(){show(this.getAttribute('data-pw-cat-l1'));});
    items[j].addEventListener('click',function(e){
      if(hoverCapable())return;
      var id=this.getAttribute('data-pw-cat-l1');
      var pane=panel.querySelector('[data-pw-cat-pane="'+id+'"]');
      var hasKids=pane&&pane.querySelector('a');
      if(hasKids&&!this.classList.contains('is-active')){
        e.preventDefault();
        show(id);
      }
    });
  }
  var first=items[0]&&items[0].getAttribute('data-pw-cat-l1');
  if(first==='__arrivals'&&items[1])first=items[1].getAttribute('data-pw-cat-l1');
  show(first);
}
function fillCatPanel(panel,tree){
  if(!panel)return;
  panel.classList.add('pw-cat-mega');
  var list=Array.isArray(tree)?tree:[];
  var first=list[0]&&list[0].id||'';
  var l1='<a href="'+esc(PRODUCTS_PATH)+'" data-pw-el="nav-link" data-pw-cat-l1="__arrivals">'+esc(COPY.newArrivals)+'</a>';
  var panes='<div data-pw-cat-pane="__arrivals" hidden><p class="pw-cat-mega-hint">'+esc(COPY.megaHint)+'</p></div>';
  for(var i=0;i<list.length;i++){
    var n=list[i];
    var label=catName(n);
    if(!label)continue;
    var id=String(n.id||'');
    var active=id===first?' is-active':'';
    if(isKhoSaleNode(n))label=COPY.khoSale||label;
    l1+='<a href="'+esc(catHref(n))+'" data-pw-el="nav-link" data-pw-cat-l1="'+esc(id)+'" class="'+active.trim()+'">'+esc(label)+'</a>';
    var kids=n.children||[];
    var inner='';
    if(isKhoSaleNode(n)){
      inner='<div class="pw-cat-mega-kho" data-pw-kho-sale="1"><p class="pw-cat-mega-kho-title">'+esc(COPY.khoSale||label)+'</p><p class="pw-cat-mega-kho-blurb">'+esc(COPY.khoSaleBlurb||'')+'</p><a href="'+esc(KHO_SALE_PATH)+'" class="pw-cat-mega-kho-more" data-pw-el="nav-link">'+esc(COPY.khoSaleViewAll||'')+'</a></div>';
    }else if(!kids.length){
      inner='<p class="pw-cat-mega-hint">'+esc(COPY.megaHint)+'</p>';
    }else{
      inner='<div class="pw-cat-mega-l2-grid">';
      for(var j=0;j<kids.length;j++){
        var c2=kids[j];
        inner+='<div class="pw-cat-mega-l2-col"><a href="'+esc(catHref(c2))+'" data-pw-el="nav-link" class="pw-cat-mega-l2">'+esc(catName(c2))+'</a>';
        var kids3=c2.children||[];
        for(var k=0;k<kids3.length;k++){
          inner+='<a href="'+esc(catHref(kids3[k]))+'" data-pw-el="nav-link" class="pw-cat-mega-l3">'+esc(catName(kids3[k]))+'</a>';
        }
        inner+='</div>';
      }
      inner+='</div>';
    }
    panes+='<div data-pw-cat-pane="'+esc(id)+'"'+(id===first?'':' hidden')+'>'+inner+'</div>';
  }
  var mega='<div class="pw-cat-mega-cols" data-pw-cat-mega="1"><div class="pw-cat-mega-l1">'+l1+'</div><div class="pw-cat-mega-l23">'+panes+'</div></div><a href="'+esc(SALE_PATH)+'" class="is-sale pw-nav-sale pw-cat-mega-sale" data-pw-el="nav-link">'+esc(COPY.sale)+'</a>';
  panel.innerHTML=mega+fillCatAccordionHtml(list);
  panel.setAttribute('data-pw-cat-filled','1');
  bindMega(panel);
  bindAcc(panel);
}
function accChevron(){
  return '<svg class="pw-cat-acc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>';
}
function fillCatAccordionHtml(list){
  var items='<div class="pw-cat-acc-item"><div class="pw-cat-acc-l1-row"><a href="'+esc(PRODUCTS_PATH)+'" class="pw-cat-acc-l1-link" data-pw-el="nav-link">'+esc(COPY.newArrivals)+'</a></div></div>';
  for(var i=0;i<list.length;i++){
    var n=list[i];
    var label=catName(n);
    if(!label)continue;
    if(isKhoSaleNode(n))label=COPY.khoSale||label;
    var kids=isKhoSaleNode(n)?[]:(n.children||[]);
    var chev=kids.length?'<button type="button" class="pw-cat-acc-toggle" data-pw-cat-acc-toggle="l1" aria-expanded="false" aria-label="'+esc(COPY.expand)+'">'+accChevron()+'</button>':'';
    var l2html='';
    if(kids.length){
      l2html='<div class="pw-cat-acc-l2-grid" hidden>';
      for(var j=0;j<kids.length;j++){
        var c2=kids[j];
        var kids3=c2.children||[];
        var chev2=kids3.length?'<button type="button" class="pw-cat-acc-toggle" data-pw-cat-acc-toggle="l2" aria-expanded="false" aria-label="'+esc(COPY.expand)+'">'+accChevron()+'</button>':'';
        var l3html='';
        if(kids3.length){
          l3html='<div class="pw-cat-acc-l3-list" hidden>';
          for(var k=0;k<kids3.length;k++){
            l3html+='<a href="'+esc(catHref(kids3[k]))+'" class="pw-cat-acc-l3" data-pw-el="nav-link">'+esc(catName(kids3[k]))+'</a>';
          }
          l3html+='</div>';
        }
        l2html+='<div class="pw-cat-acc-l2" data-pw-cat-acc-l2="'+esc(String(c2.id||''))+'"><div class="pw-cat-acc-l2-row"><a href="'+esc(catHref(c2))+'" class="pw-cat-acc-l2-link" data-pw-el="nav-link">'+esc(catName(c2))+'</a>'+chev2+'</div>'+l3html+'</div>';
      }
      l2html+='</div>';
    }
    items+='<div class="pw-cat-acc-item" data-pw-cat-acc-l1="'+esc(String(n.id||''))+'"><div class="pw-cat-acc-l1-row"><a href="'+esc(catHref(n))+'" class="pw-cat-acc-l1-link" data-pw-el="nav-link">'+esc(label)+'</a>'+chev+'</div>'+l2html+'</div>';
  }
  return '<div class="pw-cat-acc" data-pw-cat-acc="1"><div class="pw-cat-acc-bar"><span class="pw-cat-acc-title">'+esc(COPY.hubTitle)+'</span><button type="button" class="pw-cat-acc-close" data-pw-cat-acc-close><svg class="pw-cat-acc-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg><span>'+esc(COPY.close)+'</span></button></div><nav class="pw-cat-acc-list" aria-label="'+esc(COPY.hubTitle)+'">'+items+'</nav><a href="'+esc(SALE_PATH)+'" class="pw-cat-acc-sale is-sale" data-pw-el="nav-link">'+esc(COPY.sale)+'</a></div>';
}
function bindAcc(panel){
  if(!panel)return;
  var toggles=panel.querySelectorAll('[data-pw-cat-acc-toggle]');
  var t;
  for(t=0;t<toggles.length;t++){
    toggles[t].addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      var kind=this.getAttribute('data-pw-cat-acc-toggle');
      var row=this.closest('.pw-cat-acc-l1-row,.pw-cat-acc-l2-row');
      var item=kind==='l2'?this.closest('[data-pw-cat-acc-l2]'):this.closest('.pw-cat-acc-item');
      if(!item)return;
      var open=item.classList.toggle('is-open');
      this.setAttribute('aria-expanded',open?'true':'false');
      var box=row?row.nextElementSibling:null;
      if(box){
        if(open)box.removeAttribute('hidden');
        else box.setAttribute('hidden','');
      }
    });
  }
  var closes=panel.querySelectorAll('[data-pw-cat-acc-close]');
  for(t=0;t<closes.length;t++){
    closes[t].addEventListener('click',function(e){
      e.preventDefault();
      closeEl(panel.__pwOwnerBtn,panel);
    });
  }
}
function compactSizeSeo(name){
  var m=String(name||'').match(/ch[iỉ]\\s*size\\s*[:\\-]?\\s*(.*)$/i);
  var rest=m&&m[1]?String(m[1]).trim():String(name||'').trim();
  return rest?('Size '+rest):name;
}
function ensureSeoRow(){
  var existing=document.querySelector('[data-pw-seo-row]');
  if(existing)return existing;
  var header=document.querySelector('header.pw-header,header.pw-shop-header,.pw-header,.pw-shop-header');
  if(!header)return null;
  var nav=document.createElement('nav');
  nav.className='pw-seo-row';
  nav.setAttribute('data-pw-seo-row','1');
  nav.setAttribute('aria-label',COPY.seoRow||'');
  var navMain=header.querySelector('.pw-nav-main,.pw-shop-nav-row');
  if(navMain&&navMain.parentNode)navMain.parentNode.insertBefore(nav,navMain);
  else{
    var main=header.querySelector('.pw-header-main,.pw-shop-header-inner');
    if(main&&main.parentNode)main.parentNode.insertBefore(nav,main.nextSibling);
    else header.appendChild(nav);
  }
  return nav;
}
function fillSeoRow(nodes){
  var row=ensureSeoRow();
  if(!row)return;
  var list=Array.isArray(nodes)?nodes:[];
  if(!list.length){row.innerHTML='';row.setAttribute('hidden','');return;}
  row.removeAttribute('hidden');
  row.setAttribute('aria-label',COPY.seoRow||'');
  var html='';
  for(var i=0;i<list.length;i++){
    var n=list[i];
    var label=compactSizeSeo(catName(n));
    if(!label)continue;
    html+='<a href="'+esc(catHref(n))+'" data-pw-el="nav-link">'+esc(label)+'</a>';
  }
  row.innerHTML=html;
}
function flyoutHtml(kids){
  var html='';
  for(var j=0;j<(kids||[]).length;j++){
    var c2=kids[j];
    html+='<div class="pw-cat-mega-l2-col"><a href="'+esc(catHref(c2))+'" data-pw-el="nav-link" class="pw-cat-mega-l2">'+esc(catName(c2))+'</a>';
    var k3=c2.children||[];
    for(var t=0;t<k3.length;t++){
      html+='<a href="'+esc(catHref(k3[t]))+'" data-pw-el="nav-link" class="pw-cat-mega-l3">'+esc(catName(k3[t]))+'</a>';
    }
    html+='</div>';
  }
  return html;
}
function bindNavPills(nav,tree){
  var fly=nav.querySelector('.pw-nav-flyout-bar');
  var pills=nav.querySelectorAll('[data-pw-nav-l1]');
  var leaveT=null;
  function close(){
    if(fly){fly.innerHTML='';fly.setAttribute('hidden','');}
    for(var i=0;i<pills.length;i++)pills[i].classList.remove('is-open');
  }
  function open(id){
    var n=null;
    var list=Array.isArray(tree)?tree:[];
    for(var i=0;i<list.length;i++)if(String(list[i].id)===String(id))n=list[i];
    if(!n||!(n.children||[]).length||!fly){close();return;}
    fly.innerHTML=flyoutHtml(n.children);
    fly.removeAttribute('hidden');
    for(var p=0;p<pills.length;p++){
      if(pills[p].getAttribute('data-pw-nav-l1')===String(id))pills[p].classList.add('is-open');
      else pills[p].classList.remove('is-open');
    }
  }
  nav.addEventListener('mouseleave',function(){
    if(!hoverCapable())return;
    leaveT=setTimeout(close,150);
  });
  nav.addEventListener('mouseenter',function(){
    if(leaveT){clearTimeout(leaveT);leaveT=null;}
  });
  for(var i=0;i<pills.length;i++){
    (function(pill){
      var id=pill.getAttribute('data-pw-nav-l1');
      pill.addEventListener('mouseenter',function(){
        if(!hoverCapable())return;
        if(leaveT){clearTimeout(leaveT);leaveT=null;}
        open(id);
      });
      var chev=pill.querySelector('[data-pw-nav-chevron]');
      if(chev){
        chev.addEventListener('click',function(e){
          e.preventDefault();
          e.stopPropagation();
          if(pill.classList.contains('is-open'))close();else open(id);
        });
      }
    })(pills[i]);
  }
}
function takeHorizontalNav(tree){
  var kho=[],industry=[],i;
  var list=Array.isArray(tree)?tree:[];
  for(i=0;i<list.length;i++){
    if(isKhoSaleNode(list[i]))kho.push(list[i]);
    else industry.push(list[i]);
  }
  return kho.concat(industry.slice(0,Math.max(0,NAV_PILL_LIMIT-kho.length)));
}
function takeRecentViewNavPills(tree,tiles){
  var viewed=[],used={},i;
  if(Array.isArray(tiles)){
    for(i=0;i<tiles.length;i++){
      var t=tiles[i];
      var key=String((t&&(t.id||t.path))||'');
      if(!t||!key||used[key])continue;
      var name=String(t.short_name||t.name||'').trim();
      if(!name)continue;
      used[key]=1;
      viewed.push({id:t.id||key,name:name,path:t.path||'',href:t.href||'',children:[]});
      if(viewed.length>=NAV_PILL_LIMIT)break;
    }
  }
  if(viewed.length)return viewed;
  return takeHorizontalNav(tree);
}
function pillHref(n){
  return n&&n.href?n.href:catHref(n);
}
function navLiveSignature(nav){
  var links=nav.querySelectorAll('[data-pw-el="nav-link"],[data-pw-nav-l1] > a');
  var out=[],i;
  for(i=0;i<links.length;i++){
    out.push(String(links[i].textContent||'').replace(/\\s+/g,' ').trim()+'|'+(links[i].getAttribute('href')||''));
  }
  return out.join('\\n');
}
function rowSignature(list){
  var out=[],i;
  for(i=0;i<(list||[]).length;i++){
    var n=list[i];
    out.push(String((n&&(n.short_name||n.name))||'').trim()+'|'+(n&&n.href?n.href:pillHref(n)));
  }
  return COPY.newArrivals+'|'+PRODUCTS_PATH+'\\n'+out.join('\\n')+'\\n'+COPY.sale+'|'+SALE_PATH;
}
function fillNavRow(nav,tree,tiles,row,showAll){
  if(!nav)return;
  var kept=[];
  var added=nav.querySelectorAll('[data-pw-chrome-added]');
  for(var k=0;k<added.length;k++)kept.push(added[k]);
  var full=Array.isArray(tree)?tree:[];
  var list=Array.isArray(row)&&row.length?row:takeRecentViewNavPills(full,tiles);
  var nextSig=rowSignature(list);
  if(nav.getAttribute('data-pw-nav-live')==='1'&&navLiveSignature(nav)===nextSig){
    bindNavPills(nav,tree);
    return;
  }
  var html='<div class="pw-nav-row-scroll"><a href="'+esc(PRODUCTS_PATH)+'" data-pw-el="nav-link">'+esc(COPY.newArrivals)+'</a>';
  for(var i=0;i<list.length;i++){
    var n=list[i];
    var label=n&&n.short_name?n.short_name:catName(n);
    if(!label)continue;
    var kids=n.children||[];
    html+='<span class="pw-nav-pill" data-pw-nav-l1="'+esc(String(n.id||''))+'">';
    html+='<a href="'+esc(pillHref(n))+'" data-pw-el="nav-link">'+(isKhoSaleNode(n)?esc(COPY.khoSale||label):esc(label))+'</a>';
    if(kids.length){
      html+='<button type="button" class="pw-nav-chevron" data-pw-nav-chevron aria-label="'+esc(COPY.expand)+'">▾</button>';
    }
    html+='</span>';
  }
  if(showAll===true||((!row||!row.length)&&(!tiles||!tiles.length)&&full.length>list.length)){
    html+='<a href="'+esc(CAT_HUB_PATH)+'" data-pw-el="nav-link" data-pw-nav-all="1">'+esc(COPY.navAll||'')+'</a>';
  }
  html+='<a href="'+esc(SALE_PATH)+'" class="is-sale pw-nav-sale" data-pw-el="nav-link">'+esc(COPY.sale)+'</a></div>';
  html+='<div class="pw-nav-flyout-bar" hidden></div>';
  nav.innerHTML=html;
  nav.setAttribute('data-pw-personalize-nav','recent-categories');
  nav.setAttribute('data-pw-nav-live','1');
  var scroll=nav.querySelector('.pw-nav-row-scroll');
  for(var x=0;x<kept.length;x++)(scroll||nav).appendChild(kept[x]);
  bindNavPills(nav,tree);
}
function fillNavRows(tree,tiles,row,showAll){
  if(pwShopLiveUiOff())return;
  var navs=document.querySelectorAll('.pw-nav-main,.pw-shop-nav-row');
  for(var i=0;i<navs.length;i++)fillNavRow(navs[i],tree,tiles,row,showAll);
}
function applyFeaturedNav(tree,j){
  var tiles=(j&&Array.isArray(j.nav_pills))?j.nav_pills:[];
  var row=(j&&Array.isArray(j.nav_row))?j.nav_row:null;
  fillNavRows(tree,tiles,row,j&&j.show_nav_all===true);
}
function hydratePersonalizedNav(tree){
  if(pwShopLiveUiOff())return;
  fetch(FEATURED_NAV_API,{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(j){
    applyFeaturedNav(tree,j);
  }).catch(function(){fillNavRows(tree,[],null,false);});
}
function fillAccountPanel(panel){
  if(!panel)return;
  if(panel.getAttribute('data-pw-account-menu-v')==='4'&&panel.querySelector('button[data-pw-account-logout]'))return;
  var html='';
  for(var i=0;i<ACCOUNT_MENU.length;i++){
    var item=ACCOUNT_MENU[i];
    var cls=item.isAccent?' class="is-accent"':item.isLogout?' class="is-logout"':'';
    if(item.isLogout){
      html+='<button type="button"'+cls+' data-pw-account-logout="1" data-pw-el="menu-item">'+(item.icon||'')+'<span>'+esc(item.label)+'</span></button>';
    }else{
      html+='<a href="'+esc(item.href)+'"'+cls+' data-pw-el="menu-item">'+(item.icon||'')+'<span>'+esc(item.label)+'</span></a>';
    }
  }
  panel.innerHTML=html;
  panel.setAttribute('data-pw-account-filled','1');
  panel.setAttribute('data-pw-account-menu-v','4');
}
function existingMovedCatPanel(btn){
  var nodes=document.querySelectorAll(panelSel());
  var i;
  for(i=0;i<nodes.length;i++){
    if(nodes[i].__pwOwnerBtn===btn)return nodes[i];
  }
  for(i=0;i<nodes.length;i++){
    if(nodes[i].getAttribute('data-pw-panel-fixed')==='1')return nodes[i];
  }
  return null;
}
function ensureCatPanel(btn){
  var wrap=ensureCatWrap(btn);
  var local=wrap?wrap.querySelector(panelSel()):null;
  if(local)return local;
  var moved=existingMovedCatPanel(btn);
  if(moved)return moved;
  var root=deviceRoot(btn);
  local=qs(root,panelSel());
  if(local&&(!wrap||wrap.contains(local)))return local;
  if(document.querySelector(panelSel()))return document.querySelector(panelSel());
  var panel=document.createElement('nav');
  var suffix=(root!==document&&root.getAttribute&&root.getAttribute('data-pw-visual-device'))||'main';
  panel.id='pw-shop-cat-panel-'+suffix;
  panel.className='pw-shop-cat-panel pw-cat-panel';
  panel.setAttribute('data-pw-cat-panel','1');
  panel.setAttribute('aria-label',COPY.categories);
  if(wrap)wrap.appendChild(panel);
  else if(btn&&btn.parentNode)btn.parentNode.insertBefore(panel,btn.nextSibling);
  else document.body.appendChild(panel);
  return panel;
}
function ensureAccPanel(btn){
  var wrap=ensureAccountWrap(btn);
  var local=wrap?wrap.querySelector(accPanelSel()):null;
  if(local){fillAccountPanel(local);return local;}
  var panel=document.createElement('nav');
  var root=deviceRoot(btn);
  var suffix=(root!==document&&root.getAttribute&&root.getAttribute('data-pw-visual-device'))||'main';
  panel.id='pw-shop-account-panel-'+suffix;
  panel.className='pw-shop-account-panel pw-account-panel';
  panel.setAttribute('data-pw-account-panel','1');
  panel.setAttribute('aria-label',COPY.account);
  if(wrap)wrap.appendChild(panel);
  else if(btn&&btn.parentNode)btn.parentNode.insertBefore(panel,btn.nextSibling);
  else document.body.appendChild(panel);
  fillAccountPanel(panel);
  return panel;
}
function normalizeLoginLinks(){
  var nodes=document.querySelectorAll('[data-pw-chrome-btn="login"]');
  var dest=guestOrAccountHref();
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i];
    if(!el||el.tagName.toLowerCase()!=='a')continue;
    el.setAttribute('href',dest);
  }
}
function normalizeCatBtns(){
  var nodes=document.querySelectorAll(catSel());
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i];
    if(isInsidePanel(el,panelSel())||isInsidePanel(el,accPanelSel()))continue;
    if(!el.getAttribute('data-pw-cat-toggle'))el.setAttribute('data-pw-cat-toggle','1');
    if(!el.getAttribute('data-pw-el'))el.setAttribute('data-pw-el','cat-toggle');
    if(el.tagName&&el.tagName.toLowerCase()==='a'){
      var href=el.getAttribute('href');
      if(href)el.setAttribute('data-pw-cat-fallback-href',href);
      el.removeAttribute('href');
      el.setAttribute('role','button');
      el.setAttribute('aria-haspopup','true');
      el.setAttribute('tabindex','0');
    }
    ensureCatWrap(el);
  }
}
function isAccountSubpathLink(el){
  if(!el||!el.tagName||el.tagName.toLowerCase()!=='a')return false;
  var href=String(el.getAttribute('href')||el.getAttribute('data-pw-account-fallback-href')||'').split('#')[0].split('?')[0];
  // /account/orders, /site/{slug}/account/wishlist — not the main account entry
  return /\\/account\\/.+/.test(href);
}
function normalizeAccountBtns(){
  var nodes=document.querySelectorAll(accBtnSel());
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i];
    if(isInsidePanel(el,accPanelSel())||isInsidePanel(el,panelSel()))continue;
    // Mis-tagged topbar links (Liên hệ / Yêu thích / Đơn hàng) must stay normal links.
    if(isAccountSubpathLink(el)){
      if(el.getAttribute('data-pw-chrome-btn')==='account'&&el.getAttribute('data-pw-el')!=='account'){
        el.removeAttribute('data-pw-chrome-btn');
        el.removeAttribute('data-pw-account-toggle');
      }
      continue;
    }
    if(!el.getAttribute('data-pw-el'))el.setAttribute('data-pw-el','account');
    if(!el.getAttribute('data-pw-chrome-btn'))el.setAttribute('data-pw-chrome-btn','account');
    el.removeAttribute('data-pw-account-toggle');
    el.removeAttribute('aria-haspopup');
    el.removeAttribute('aria-expanded');
    el.removeAttribute('aria-controls');
    el.removeAttribute('role');
    var dest=guestOrAccountHref();
    if(el.tagName&&el.tagName.toLowerCase()==='a'){
      if(isLoggedIn){
        var href=el.getAttribute('href');
        if(href){
          var expanded=expandAccountHref(href);
          if(expanded)dest=expanded;
        }
        if(/^\\/account(\\/)?$/.test(String(dest).split('?')[0])||!dest)dest=ACCOUNT_LOGIN_PATH;
      }
      el.setAttribute('href',dest);
      el.setAttribute('data-pw-account-fallback-href',isLoggedIn?(ACCOUNT_LOGIN_PATH||dest):dest);
    }else{
      el.setAttribute('data-pw-account-fallback-href',dest);
    }
    // Drop legacy dropdown panels next to the account control.
    var wrap=el.closest('.pw-account-wrap,.pw-shop-account-wrap,.pw-chrome-account-wrap');
    if(wrap){
      var panels=wrap.querySelectorAll(accPanelSel());
      for(var p=0;p<panels.length;p++){try{panels[p].remove();}catch(errRm){}}
    }
  }
}
function clearPanelPos(panel){
  if(!panel||!panel.style)return;
  panel.style.position='';
  panel.style.left='';
  panel.style.top='';
  panel.style.right='';
  panel.style.bottom='';
  panel.style.zIndex='';
  panel.style.visibility='';
  panel.style.display='';
  panel.style.width='';
  panel.style.maxWidth='';
  panel.style.minWidth='';
  panel.style.borderRadius='';
  panel.removeAttribute('data-pw-panel-fixed');
}
function restorePanelHome(panel){
  if(!panel)return;
  var home=panel.__pwHomeParent;
  if(home&&panel.parentNode===document.body){
    try{home.appendChild(panel);}catch(errHome){}
  }
  panel.__pwHomeParent=null;
  panel.__pwOwnerBtn=null;
}
function isMegaPanel(panel){
  return !!(panel&&(panel.classList.contains('pw-cat-mega')||panel.querySelector('[data-pw-cat-mega]')));
}
function sceneWidth(){
  var w=window.innerWidth||0;
  try{
    var sw=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pw-scene-w'));
    if(sw>0)w=sw;
  }catch(errSw){}
  return w;
}
function isMobileCatFace(){
  var html=document.documentElement;
  var d=String((html&&html.getAttribute('data-pw-edit-device'))||(html&&html.getAttribute('data-pw-scene-lock'))||(html&&html.getAttribute('data-pw-cat-face'))||'').toLowerCase();
  if(d==='mobile')return true;
  if(d==='desktop'||d==='laptop'||d==='tablet')return false;
  try{
    var q=String(new URLSearchParams(location.search).get('pw-device')||'').toLowerCase();
    if(q==='mobile')return true;
    if(q==='desktop'||q==='laptop'||q==='tablet')return false;
  }catch(errQ){}
  return window.matchMedia('(max-width:639px)').matches;
}
function syncCatFace(){
  var html=document.documentElement;
  if(!html)return;
  html.setAttribute('data-pw-cat-face',isMobileCatFace()?'mobile':'desktop');
}
function ensureCatBackdrop(){
  var el=document.querySelector('[data-pw-cat-acc-backdrop]');
  if(!el){
    el=document.createElement('button');
    el.type='button';
    el.setAttribute('data-pw-cat-acc-backdrop','1');
    el.className='pw-cat-acc-backdrop';
    el.setAttribute('aria-label',COPY.close||'');
    el.hidden=true;
    document.body.appendChild(el);
    el.addEventListener('click',function(){
      var open=document.querySelector('.pw-cat-panel.is-open,.pw-shop-cat-panel.is-open,[data-pw-cat-panel].is-open');
      if(open)closeEl(open.__pwOwnerBtn,open);
    });
  }
  return el;
}
function showCatBackdrop(show){
  var el=ensureCatBackdrop();
  el.hidden=!show;
}
function clearCatLeave(btn){
  if(btn&&btn.__pwCatLeaveT){
    clearTimeout(btn.__pwCatLeaveT);
    btn.__pwCatLeaveT=null;
  }
}
function scheduleCatLeave(btn,panel){
  clearCatLeave(btn);
  if(!btn)return;
  btn.__pwCatLeaveT=setTimeout(function(){closeEl(btn,panel||ensureCatPanel(btn));},150);
}
function relatedInCatUi(related,btn,panel){
  if(!related||!related.closest)return false;
  if(panel&&panel.contains(related))return true;
  if(btn&&(related===btn||(btn.contains&&btn.contains(related))))return true;
  var wrap=btn&&btn.closest?btn.closest('.pw-chrome-cat-wrap'):null;
  return !!(wrap&&wrap.contains(related));
}
function bindCatPanelHover(btn,panel){
  if(!btn||!panel||panel.getAttribute('data-pw-cat-panel-hover'))return;
  panel.setAttribute('data-pw-cat-panel-hover','1');
  panel.addEventListener('mouseenter',function(){
    if(!hoverCapable())return;
    clearCatLeave(btn);
    if(!panel.classList.contains('is-open'))placeMegaPanel(btn,panel);
  });
  panel.addEventListener('mouseleave',function(e){
    if(!hoverCapable())return;
    if(relatedInCatUi(e.relatedTarget,btn,panel))return;
    scheduleCatLeave(btn,panel);
  });
}
function placeMegaPanel(btn,panel){
  if(!btn||!panel)return;
  syncCatFace();
  panel.__pwOwnerBtn=btn;
  if(panel.parentNode!==document.body){
    panel.__pwHomeParent=panel.parentNode;
    document.body.appendChild(panel);
  }
  bindCatPanelHover(btn,panel);
  panel.classList.add('is-open');
  panel.setAttribute('data-pw-panel-fixed','1');
  panel.style.position='fixed';
  panel.style.zIndex='99999';
  panel.style.right='auto';
  panel.style.bottom='auto';
  panel.style.display='block';
  panel.style.visibility='hidden';
  var header=btn.closest?btn.closest('header,.pw-header,.pw-shop-header'):null;
  var br=btn.getBoundingClientRect();
  var top=Math.round(br.bottom);
  if(top<8)top=Math.round(br.bottom);
  document.documentElement.style.setProperty('--pw-cat-sheet-top',top+'px');
  if(isMobileCatFace()){
    var sheetTop=Math.round((header?header.getBoundingClientRect().bottom:br.bottom));
    if(sheetTop<8)sheetTop=top;
    document.documentElement.style.setProperty('--pw-cat-sheet-top',sheetTop+'px');
    panel.style.left='0';
    panel.style.right='0';
    panel.style.top=sheetTop+'px';
    panel.style.width='100%';
    panel.style.maxWidth='100%';
    panel.style.minWidth='0';
    panel.style.borderRadius='0 0 12px 12px';
    panel.style.visibility='';
    showCatBackdrop(true);
  }else{
    showCatBackdrop(false);
    var maxW=Math.min(${PARTNER_CATEGORY_MEGA_WIDTH_PX},Math.max(280,sceneWidth()-24));
    var left=Math.max(8,Math.round(br.left));
    if(left+maxW>sceneWidth()-8)left=Math.max(8,sceneWidth()-maxW-8);
    panel.style.left=left+'px';
    panel.style.top=top+'px';
    panel.style.width=maxW+'px';
    panel.style.maxWidth=maxW+'px';
    panel.style.borderRadius='';
    panel.style.visibility='';
  }
  var extras=document.querySelectorAll(panelSel());
  var i;
  for(i=0;i<extras.length;i++){
    if(extras[i]===panel)continue;
    extras[i].classList.remove('is-open');
    extras[i].removeAttribute('data-pw-panel-fixed');
    try{extras[i].remove();}catch(errDup){}
  }
}
function placePanelFixed(btn,panel){
  if(!btn||!panel)return;
  if(isMegaPanel(panel)){placeMegaPanel(btn,panel);return;}
  panel.__pwOwnerBtn=btn;
  if(panel.parentNode!==document.body){
    panel.__pwHomeParent=panel.parentNode;
    document.body.appendChild(panel);
  }
  panel.classList.add('is-open');
  panel.setAttribute('data-pw-panel-fixed','1');
  panel.style.position='fixed';
  panel.style.zIndex='99999';
  panel.style.right='auto';
  panel.style.bottom='auto';
  panel.style.visibility='hidden';
  panel.style.display='grid';
  var pw=Math.max(panel.offsetWidth||0,220);
  var ph=panel.offsetHeight||0;
  var r=btn.getBoundingClientRect();
  var left=Math.round(r.right-pw);
  if(left<8)left=8;
  if(left+pw>window.innerWidth-8)left=Math.max(8,window.innerWidth-pw-8);
  var top=Math.round(r.bottom+8);
  if(top+Math.max(ph,40)>window.innerHeight-8&&r.top>ph+16)top=Math.round(r.top-Math.max(ph,40)-8);
  panel.style.left=left+'px';
  panel.style.top=top+'px';
  panel.style.visibility='';
}
function closeEl(btn,panel){
  if(panel){
    panel.classList.remove('is-open');
    clearPanelPos(panel);
    restorePanelHome(panel);
  }
  showCatBackdrop(false);
  if(btn)btn.setAttribute('aria-expanded','false');
}
function togglePair(btn,panel,otherBtn,otherPanel){
  if(!btn||!panel)return;
  var open=!panel.classList.contains('is-open');
  if(open){
    closeEl(otherBtn,otherPanel);
    placePanelFixed(btn,panel);
    btn.setAttribute('aria-expanded','true');
  }else{
    closeEl(btn,panel);
  }
}
function toggleCatPair(btn,panel,otherBtn,otherPanel){
  if(!btn||!panel)return;
  var open=!panel.classList.contains('is-open');
  if(open){
    closeEl(otherBtn,otherPanel);
    if(isMegaPanel(panel))placeMegaPanel(btn,panel);
    else panel.classList.add('is-open');
    btn.setAttribute('aria-expanded','true');
  }else{
    closeEl(btn,panel);
  }
}
function bindCatHover(btn){
  var wrap=ensureCatWrap(btn);
  if(!wrap||wrap.getAttribute('data-pw-cat-hover-bound'))return;
  wrap.setAttribute('data-pw-cat-hover-bound','1');
  wrap.addEventListener('mouseenter',function(){
    if(pwShopLiveUiOff()||!hoverCapable()||isMobileCatFace())return;
    clearCatLeave(btn);
    var livePanel=ensureCatPanel(btn);
    if(livePanel&&!livePanel.querySelector('[data-pw-cat-mega]'))hydrateCats();
    var root=deviceRoot(btn);
    var liveAccBtn=qs(root,accBtnSel());
    var liveAcc=liveAccBtn?qs(root,accPanelSel()):qs(root,accPanelSel());
    closeEl(liveAccBtn,liveAcc);
    if(livePanel){
      if(isMegaPanel(livePanel))placeMegaPanel(btn,livePanel);
      else livePanel.classList.add('is-open');
      btn.setAttribute('aria-expanded','true');
    }
  });
  wrap.addEventListener('mouseleave',function(e){
    if(!hoverCapable())return;
    var livePanel=ensureCatPanel(btn);
    if(relatedInCatUi(e.relatedTarget,btn,livePanel))return;
    scheduleCatLeave(btn,livePanel);
  });
}
function repositionOpenPanels(){
  var panels=document.querySelectorAll('[data-pw-panel-fixed].is-open');
  for(var i=0;i<panels.length;i++){
    var p=panels[i];
    var b=p.__pwOwnerBtn;
    if(b&&b.getBoundingClientRect){
      if(isMegaPanel(p))placeMegaPanel(b,p);
      else placePanelFixed(b,p);
    }
  }
}
function bindPanelLinks(panel){
  if(!panel)return;
  panel.querySelectorAll('a').forEach(function(link){
    if(link.getAttribute('data-pw-acc-link-bound'))return;
    link.setAttribute('data-pw-acc-link-bound','1');
    link.addEventListener('click',function(){
      var btn=panel.__pwOwnerBtn;
      if(!btn){
        var wrap=panel.closest('.pw-account-wrap,.pw-shop-account-wrap,.pw-chrome-account-wrap');
        btn=wrap?wrap.querySelector(accBtnSel()):null;
      }
      closeEl(btn,panel);
    });
  });
  panel.querySelectorAll('[data-pw-account-logout],button.is-logout,a.is-logout[href="#"],[data-pw-chrome-btn="logout"]').forEach(function(btn){
    if(btn.getAttribute('data-pw-acc-logout-bound'))return;
    btn.setAttribute('data-pw-acc-logout-bound','1');
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      var owner=panel.__pwOwnerBtn;
      if(!owner){
        var wrap=panel.closest('.pw-account-wrap,.pw-shop-account-wrap,.pw-chrome-account-wrap');
        owner=wrap?wrap.querySelector(accBtnSel()):null;
      }
      closeEl(owner,panel);
      clearShopSession();
    });
  });
}
function handleAccountClick(e){
  if(pwShopLiveUiOff())return;
  var cur=e.currentTarget;
  if(isAccountSubpathLink(cur))return;
  applyLocalAuth();
  // Logged-in: keep native <a href="/account"> so the browser starts navigation
  // immediately — do not wait for session/sync-session.
  if(isLoggedIn){
    var dest=accountLoginHref(cur);
    try{
      if(window.top&&window.top!==window){
        e.preventDefault();
        e.stopPropagation();
        if(dest)window.top.location.href=dest;
        return;
      }
    }catch(errTop){}
    if(cur&&cur.tagName&&cur.tagName.toLowerCase()==='a'&&cur.getAttribute('href'))return;
    e.preventDefault();
    e.stopPropagation();
    if(dest)window.location.href=dest;
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  navigateAccountLogin(cur);
}
function bindToggles(){
  normalizeCatBtns();
  normalizeAccountBtns();
  normalizeLoginLinks();
  document.querySelectorAll('[data-pw-chrome-btn="logout"],[data-pw-account-logout]').forEach(function(btn){
    if(btn.getAttribute('data-pw-acc-logout-bound'))return;
    btn.setAttribute('data-pw-acc-logout-bound','1');
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      clearShopSession();
    });
  });
  var catBtns=document.querySelectorAll(catSel());
  var accBtns=document.querySelectorAll(accBtnSel());
  var i;
  for(i=0;i<catBtns.length;i++){
    var btn=catBtns[i];
    if(isInsidePanel(btn,panelSel())||isInsidePanel(btn,accPanelSel()))continue;
    var panel=ensureCatPanel(btn);
    if(btn.getAttribute('data-pw-toggle-bound'))continue;
    btn.setAttribute('data-pw-toggle-bound','1');
    if(panel&&panel.id)btn.setAttribute('aria-controls',panel.id);
    bindCatHover(btn);
    bindCatPanelHover(btn,panel);
    btn.addEventListener('click',function(e){
      if(pwShopLiveUiOff())return;
      e.preventDefault();
      e.stopPropagation();
      var cur=e.currentTarget;
      var livePanel=ensureCatPanel(cur);
      var root=deviceRoot(cur);
      var liveAccBtn=qs(root,accBtnSel());
      var liveAcc=liveAccBtn?qs(root,accPanelSel()):qs(root,accPanelSel());
      if(livePanel&&!livePanel.querySelector('[data-pw-cat-mega]'))hydrateCats();
      if(hoverCapable()&&!isMobileCatFace()&&livePanel&&livePanel.classList.contains('is-open'))return;
      toggleCatPair(cur,livePanel,liveAccBtn,liveAcc);
    });
  }
  for(i=0;i<accBtns.length;i++){
    var ab=accBtns[i];
    if(isInsidePanel(ab,accPanelSel())||isInsidePanel(ab,panelSel()))continue;
    if(isAccountSubpathLink(ab))continue;
    if(ab.getAttribute('data-pw-toggle-bound'))continue;
    ab.setAttribute('data-pw-toggle-bound','1');
    ab.addEventListener('click',handleAccountClick);
  }
  if(!document.documentElement.getAttribute('data-pw-chrome-toggle-doc')){
    document.documentElement.setAttribute('data-pw-chrome-toggle-doc','1');
    window.addEventListener('scroll',repositionOpenPanels,true);
    window.addEventListener('resize',repositionOpenPanels);
    document.addEventListener('click',function(e){
      if(pwShopLiveUiOff())return;
      var t=e.target;
      if(!t||!t.closest)return;
      var hit=t.closest(catSel());
      if(hit&&!isInsidePanel(hit,panelSel())&&!isInsidePanel(hit,accPanelSel())){
        e.preventDefault();
        e.stopPropagation();
        var livePanel=ensureCatPanel(hit);
        var root=deviceRoot(hit);
        var liveAccBtn=qs(root,accBtnSel());
        var liveAcc=liveAccBtn?qs(root,accPanelSel()):qs(root,accPanelSel());
        if(livePanel&&!livePanel.querySelector('[data-pw-cat-mega]'))hydrateCats();
        if(hoverCapable()&&!isMobileCatFace()&&livePanel&&livePanel.classList.contains('is-open'))return;
        toggleCatPair(hit,livePanel,liveAccBtn,liveAcc);
        return;
      }
      if(t.closest(panelSel())||t.closest('.pw-chrome-cat-wrap'))return;
      var liveCatBtns=document.querySelectorAll(catSel());
      var j;
      for(j=0;j<liveCatBtns.length;j++){
        if(isInsidePanel(liveCatBtns[j],panelSel())||isInsidePanel(liveCatBtns[j],accPanelSel()))continue;
        var croot=deviceRoot(liveCatBtns[j]);
        closeEl(liveCatBtns[j],qs(croot,panelSel())||ensureCatPanel(liveCatBtns[j]));
      }
    },true);
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape')return;
      var liveCatBtns=document.querySelectorAll(catSel());
      var j;
      for(j=0;j<liveCatBtns.length;j++)closeEl(liveCatBtns[j],ensureCatPanel(liveCatBtns[j]));
    });
  }
}
function isSizeSeoNode(n){
  var name=catName(n);
  var slug=String((n&&n.slug)||'');
  return /ch[iỉ]\\s*size/i.test(name)||/(^|-)chi-size(-|$)/i.test(slug);
}
function sizeSeoRest(name){
  var m=String(name||'').match(/ch[iỉ]\\s*size\\s*[:\\-]?\\s*(.*)$/i);
  return m&&m[1]?String(m[1]).trim():'';
}
function isCleanSizeSeo(n){
  if(!isSizeSeoNode(n))return false;
  return /^(?:xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|\\d{1,3}(?:\\.\\d)?)$/i.test(sizeSeoRest(catName(n)));
}
function isWarehouseGroup(n){
  var name=String(catName(n)||'').trim();
  var compact=name.replace(/\\s+/g,'');
  var slug=String((n&&n.slug)||'').toLowerCase();
  return /(?:^|[\\s\\-])(?:nam|n[uữ]|nu)\\s*g\\d{1,3}$/i.test(name)||/^g\\d{1,3}(?:nam|n[uữ]|nu)$/i.test(compact)||/^(nam|nu)-g\\d{1,3}$/i.test(slug)||/^g\\d{1,3}(nam|nu)$/i.test(slug);
}
function sortIndustry(nodes){
  var list=(Array.isArray(nodes)?nodes.slice():[]).sort(function(a,b){
    var so=(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0);
    if(so)return so;
    return String(catName(a)||'').localeCompare(String(catName(b)||''),'vi',{sensitivity:'base'});
  });
  for(var i=0;i<list.length;i++){
    var copy={};
    for(var k in list[i])if(Object.prototype.hasOwnProperty.call(list[i],k))copy[k]=list[i][k];
    copy.children=sortIndustry(list[i].children||[]);
    list[i]=copy;
  }
  return list;
}
function isDirtySizeNav(n){
  var name=String(catName(n)||'').trim();
  if(isSizeSeoNode(n)&&!isCleanSizeSeo(n))return true;
  return /^size\\s+\\S+\\s+\\S+/i.test(name)||/\\bg\\d{2}(?:nam|n[uữ]|nu)\\b/i.test(name);
}
function isNavJunk(n){
  var name=String(catName(n)||'').trim();
  if(isSizeSeoNode(n)||isWarehouseGroup(n)||isDirtySizeNav(n))return true;
  return /^(?:xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|\\d{1,2}(?:\\.\\d)?|\\d{2,3})$/i.test(name)||/^size\\s+(?:xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|\\d+)\\s*$/i.test(name);
}
function splitNavTree(tree){
  var seo=[];
  var kho=null;
  var hidWh=false;
  function walk(nodes,topLevel){
    var kept=[];
    var list=Array.isArray(nodes)?nodes:[];
    for(var i=0;i<list.length;i++){
      var n=list[i];
      if(isKhoSaleNode(n)){if(!kho)kho=n;continue;}
      if(isCleanSizeSeo(n)&&!topLevel){seo.push(n);continue;}
      if(isNavJunk(n)){hidWh=true;continue;}
      var copy={};
      for(var k in n)if(Object.prototype.hasOwnProperty.call(n,k))copy[k]=n[k];
      copy.children=walk(n.children||[],false);
      kept.push(copy);
    }
    return kept;
  }
  var menu=sortIndustry(walk(tree,true));
  if(kho||hidWh){
    var sale={id:'__kho-sale',name:COPY.khoSale||'Sale kho',slug:'kho-sale',path:'kho-sale',children:[]};
    if(kho){sale.id=kho.id||sale.id;sale.name=kho.name||sale.name;sale.slug=kho.slug||sale.slug;sale.path=kho.path||sale.path;}
    menu.unshift(sale);
  }
  return {menu:menu,seo:seo};
}
function hydrateCats(){
  if(pwShopLiveUiOff())return;
  var btns=document.querySelectorAll(catSel());
  var panels=[];
  var i;
  for(i=0;i<btns.length;i++){
    if(isInsidePanel(btns[i],panelSel()))continue;
    panels.push(ensureCatPanel(btns[i]));
  }
  if(!panels.length){
    var orphan=document.querySelector(panelSel());
    if(orphan)panels.push(orphan);
  }
  var hasNav=!!document.querySelector('.pw-nav-main,.pw-shop-nav-row');
  if(!panels.length&&!hasNav)return;
  var catP=fetch(CAT_API,{credentials:'same-origin'}).then(function(r){return r.json()});
  var navP=hasNav?fetch(FEATURED_NAV_API,{credentials:'same-origin'}).then(function(r){return r.json()}).catch(function(){return null;}):Promise.resolve(null);
  Promise.all([catP,navP]).then(function(pair){
    var j=pair[0];
    var featured=pair[1];
    var raw=(j&&Array.isArray(j.tree))?j.tree:((j&&Array.isArray(j.menuTree))?j.menuTree:[]);
    var split=splitNavTree(raw);
    var tree=split.menu;
    var seo=split.seo;
    for(i=0;i<panels.length;i++){
      panels[i].removeAttribute('data-pw-cat-filled');
      fillCatPanel(panels[i],tree);
    }
    fillSeoRow(seo);
    if(featured)applyFeaturedNav(tree,featured);
    else hydratePersonalizedNav(tree);
  }).catch(function(){
    for(i=0;i<panels.length;i++){
      if(!panels[i].querySelector('a'))fillCatPanel(panels[i],[]);
    }
    hydratePersonalizedNav([]);
  });
}
function boot(){
  applyLocalAuth();
  syncCatFace();
  bindToggles();
  hydrateCats();
  hydrateAuth(function(){bindToggles();});
}
applyLocalAuth();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
var moTimer=null;
var mo=typeof MutationObserver!=='undefined'?new MutationObserver(function(){
  if(moTimer)clearTimeout(moTimer);
  moTimer=setTimeout(function(){
    bindToggles();
    var panels=document.querySelectorAll(panelSel());
    var need=false,i;
    for(i=0;i<panels.length;i++){if(!panels[i].querySelector('a')){need=true;break;}}
    if(need)hydrateCats();
  },100);
}):null;
if(mo)mo.observe(document.documentElement,{childList:true,subtree:true});
})();</script>
<style data-pw-chrome-toggle-css>
.pw-chrome-cat-wrap,.pw-account-wrap,.pw-shop-account-wrap,.pw-chrome-account-wrap{position:relative;display:inline-flex;align-items:center}
.pw-chrome-cat-wrap[data-pw-cat-placed="1"]{display:inline-flex;align-items:center}
.pw-cat-panel:not(.is-open),.pw-shop-cat-panel:not(.is-open),[data-pw-cat-panel]:not(.is-open),
.pw-account-panel:not(.is-open),.pw-shop-account-panel:not(.is-open),[data-pw-account-panel]:not(.is-open){display:none!important}
.pw-cat-panel.is-open:not(.pw-cat-mega),.pw-shop-cat-panel.is-open:not(.pw-cat-mega),[data-pw-cat-panel].is-open:not(.pw-cat-mega),
.pw-account-panel.is-open,.pw-shop-account-panel.is-open,[data-pw-account-panel].is-open{
  display:grid!important;gap:2px;min-width:220px;padding:6px;background:#fff;border:1px solid #e5e7eb;
  border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)
}
.pw-cat-panel.is-open.pw-cat-mega,.pw-shop-cat-panel.is-open.pw-cat-mega,[data-pw-cat-panel].is-open.pw-cat-mega{
  display:block!important;min-width:0;max-width:calc(var(--pw-scene-w,100vw) - 16px);padding:0;overflow:hidden;
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)
}
.pw-cat-mega-cols{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:200px;min-width:0}
.pw-cat-mega-l1{background:var(--pw-surface,#f9fafb);border-right:1px solid #e5e7eb;padding:10px;max-height:min(70vh,420px);overflow:auto;display:grid;gap:4px;align-content:start;min-width:220px;width:220px}
.pw-cat-mega-l23{padding:12px;max-height:min(70vh,420px);overflow-x:hidden;overflow-y:auto;min-width:0}
.pw-cat-mega-l2-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px 16px;min-width:0}
.pw-cat-mega-l2{display:block;font-size:12px;font-weight:700;margin-bottom:4px;white-space:normal;text-transform:none;letter-spacing:0;overflow-wrap:anywhere}
.pw-cat-mega-l3{display:block;font-size:11px;font-weight:500;padding:2px 0;color:#6b7280;white-space:normal;text-transform:lowercase;letter-spacing:0;overflow-wrap:anywhere}
.pw-cat-mega-hint{margin:0;font-size:12px;color:#6b7280}
.pw-cat-mega-sale{display:block;padding:10px 12px;border-top:1px solid #e5e7eb}
.pw-cat-mega-kho{max-width:28rem}
.pw-cat-mega-kho-title{margin:0 0 6px;font-size:13px;font-weight:700;color:var(--pw-text,#111827)}
.pw-cat-mega-kho-blurb{margin:0;font-size:12px;line-height:1.55;color:var(--pw-muted,#6b7280)}
.pw-cat-mega-kho-more{display:inline-block;margin-top:10px;font-size:12px;font-weight:600;color:var(--pw-primary);text-decoration:none}
.pw-cat-mega-kho-more:hover{color:var(--pw-accent);text-decoration:underline}
.pw-cat-mega-l1 a.is-active{background:color-mix(in srgb,var(--pw-primary) 12%,#fff);color:var(--pw-primary)}
.pw-cat-panel.is-open .pw-cat-mega-l1 a,.pw-shop-cat-panel.is-open .pw-cat-mega-l1 a,[data-pw-cat-panel].is-open .pw-cat-mega-l1 a{
  display:block!important;white-space:normal!important;overflow-wrap:anywhere;line-height:1.35
}
.pw-cat-panel.is-open:not(.pw-cat-mega):not([data-pw-panel-fixed]),.pw-shop-cat-panel.is-open:not(.pw-cat-mega):not([data-pw-panel-fixed]),
[data-pw-cat-panel].is-open:not(.pw-cat-mega):not([data-pw-panel-fixed]),
.pw-account-panel.is-open:not([data-pw-panel-fixed]),.pw-shop-account-panel.is-open:not([data-pw-panel-fixed]),
[data-pw-account-panel].is-open:not([data-pw-panel-fixed]){
  position:absolute;right:0;left:auto;top:calc(100% + 8px);z-index:120
}
.pw-cat-panel.is-open.pw-cat-mega:not([data-pw-panel-fixed]),.pw-shop-cat-panel.is-open.pw-cat-mega:not([data-pw-panel-fixed]),
[data-pw-cat-panel].is-open.pw-cat-mega:not([data-pw-panel-fixed]){
  position:absolute;left:0;right:auto;top:calc(100% + 8px);z-index:120
}
.pw-account-panel.is-open a,.pw-shop-account-panel.is-open a,[data-pw-account-panel].is-open a,
.pw-account-panel.is-open button[data-pw-account-logout],.pw-shop-account-panel.is-open button[data-pw-account-logout],[data-pw-account-panel].is-open button[data-pw-account-logout],
.pw-cat-panel.is-open a,.pw-shop-cat-panel.is-open a,[data-pw-cat-panel].is-open a{
  display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:600;
  color:#374151;text-decoration:none;white-space:nowrap
}
.pw-account-panel.is-open button[data-pw-account-logout],.pw-shop-account-panel.is-open button[data-pw-account-logout],[data-pw-account-panel].is-open button[data-pw-account-logout]{
  width:100%;border:none;background:transparent;font:inherit;cursor:pointer;text-align:left
}
.pw-account-panel.is-open button[data-pw-account-logout]:hover,.pw-shop-account-panel.is-open button[data-pw-account-logout]:hover,[data-pw-account-panel].is-open button[data-pw-account-logout]:hover{
  background:var(--pw-surface,#f3f4f6);color:var(--pw-primary,#2563eb)
}
.pw-account-panel.is-open a svg,.pw-shop-account-panel.is-open a svg,[data-pw-account-panel].is-open a svg,
.pw-account-panel.is-open .pw-shop-account-icon,.pw-shop-account-panel.is-open .pw-shop-account-icon{
  width:18px;height:18px;flex-shrink:0;stroke:currentColor;fill:none
}
.pw-account-panel.is-open a:hover,.pw-shop-account-panel.is-open a:hover,[data-pw-account-panel].is-open a:hover,
.pw-cat-panel.is-open a:hover,.pw-shop-cat-panel.is-open a:hover,[data-pw-cat-panel].is-open a:hover,
.pw-cat-mega-l2:hover,.pw-cat-mega-l3:hover{
  background:var(--pw-surface,#f3f4f6);color:var(--pw-primary)!important
}
.pw-cat-panel.is-open .pw-cat-mega-kho-more,.pw-shop-cat-panel.is-open .pw-cat-mega-kho-more,[data-pw-cat-panel].is-open .pw-cat-mega-kho-more{
  display:inline-block;padding:0;border-radius:0;font-size:12px;font-weight:600;color:var(--pw-primary);background:transparent;white-space:normal
}
.pw-cat-panel.is-open .pw-cat-mega-kho-more:hover,.pw-shop-cat-panel.is-open .pw-cat-mega-kho-more:hover,[data-pw-cat-panel].is-open .pw-cat-mega-kho-more:hover{
  background:transparent;color:var(--pw-accent)!important;text-decoration:underline
}
.pw-seo-row{display:flex;flex-wrap:nowrap;align-items:center;gap:14px;overflow-x:auto;overflow-y:hidden;max-width:var(--pw-block-w,var(--pw-content,1200px));width:100%;margin:0 auto;padding:4px 16px 8px;box-sizing:border-box;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.pw-seo-row::-webkit-scrollbar{display:none}
.pw-seo-row:empty,[data-pw-seo-row]:empty{display:none}
.pw-seo-row a{flex:0 0 auto;white-space:nowrap;font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--pw-muted,#6b7280);text-decoration:none}
.pw-seo-row a:hover{color:var(--pw-primary)}
.pw-nav-main,.pw-shop-nav-row{flex-wrap:nowrap!important;overflow:visible;position:relative}
.pw-nav-row-scroll{display:flex;flex-wrap:nowrap;align-items:center;gap:inherit;width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.pw-nav-row-scroll::-webkit-scrollbar{display:none}
.pw-nav-pill{position:relative;display:inline-flex;align-items:center;flex:0 0 auto;gap:2px}
.pw-nav-chevron{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:none;background:transparent;color:inherit;cursor:pointer;font-size:10px;line-height:1}
.pw-nav-flyout-bar{position:absolute;left:0;right:0;top:100%;z-index:80;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px 16px;max-height:min(60vh,420px);overflow-x:hidden;overflow-y:auto;padding:12px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;box-shadow:0 12px 32px rgba(15,23,42,.12);text-align:left;width:100%;max-width:100%;box-sizing:border-box}
${PARTNER_CATEGORY_MEGA_LAYOUT_CSS}
.pw-account-panel.is-open a.is-header,.pw-shop-account-panel.is-open a.is-header{background:#eff6ff;color:#2563eb;border-left:3px solid #2563eb;font-weight:700}
.pw-account-panel.is-open a.is-accent,.pw-shop-account-panel.is-open a.is-accent{background:var(--pw-surface,#f3f4f6);color:var(--pw-accent,#ea580c);border-left:3px solid var(--pw-primary,#2563eb);font-weight:700}
[data-pw-chrome-btn="account"][role="button"],[data-pw-account-toggle]{cursor:pointer}
</style>`
}
