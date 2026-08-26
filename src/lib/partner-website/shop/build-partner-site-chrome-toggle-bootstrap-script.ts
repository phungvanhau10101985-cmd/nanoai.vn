import type { WebLocale } from '@/lib/i18n/config'
import {
  getPartnerSiteAccountMenuItems,
  getPartnerSiteCategoryNavLabels,
  partnerSiteAccountMenuIconSvg,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteShopSkipAuthSyncKey } from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
import {
  partnerSiteCategoriesApiPath,
  partnerSiteCategoryPath,
  partnerSiteInfoPath,
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
  const productsPath = partnerSiteProductsPath(slug)
  const salePath = partnerSiteInfoPath(slug, 'sale')
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
var PRODUCTS_PATH=${JSON.stringify(productsPath)};
var SALE_PATH=${JSON.stringify(salePath)};
var CAT_PREFIX=${JSON.stringify(catPrefix)};
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
function catHref(path){
  var segs=String(path||'').split('/').map(function(s){return s.trim()}).filter(Boolean).map(encodeURIComponent);
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
  var props=['position','left','top','right','bottom','z-index','transform'];
  for(var i=0;i<props.length;i++){
    var p=props[i];
    var v=from.style.getPropertyValue(p);
    if(!v)continue;
    to.style.setProperty(p,v,from.style.getPropertyPriority(p)||'');
    from.style.removeProperty(p);
  }
  if(from.getAttribute('data-pw-user-move'))to.setAttribute('data-pw-user-move','1');
  to.setAttribute('data-pw-cat-placed','1');
}
function ensureCatWrap(btn){
  if(!btn)return null;
  var existing=btn.closest('.pw-chrome-cat-wrap');
  if(existing)return existing;
  var cluster=btn.closest('.pw-brand-cluster,.pw-shop-brand-cluster');
  if(cluster&&!isPlacedCatBtn(btn))return cluster;
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
    l1+='<a href="'+esc(catHref(n.path||n.slug||''))+'" data-pw-el="nav-link" data-pw-cat-l1="'+esc(id)+'" class="'+active.trim()+'">'+esc(label)+'</a>';
    var kids=n.children||[];
    var inner='';
    if(!kids.length){
      inner='<p class="pw-cat-mega-hint">'+esc(COPY.megaHint)+'</p>';
    }else{
      inner='<div class="pw-cat-mega-l2-grid">';
      for(var j=0;j<kids.length;j++){
        var c2=kids[j];
        inner+='<div class="pw-cat-mega-l2-col"><a href="'+esc(catHref(c2.path||''))+'" data-pw-el="nav-link" class="pw-cat-mega-l2">'+esc(catName(c2))+'</a>';
        var kids3=c2.children||[];
        for(var k=0;k<kids3.length;k++){
          inner+='<a href="'+esc(catHref(kids3[k].path||''))+'" data-pw-el="nav-link" class="pw-cat-mega-l3">'+esc(catName(kids3[k]))+'</a>';
        }
        inner+='</div>';
      }
      inner+='</div>';
    }
    panes+='<div data-pw-cat-pane="'+esc(id)+'"'+(id===first?'':' hidden')+'>'+inner+'</div>';
  }
  panel.innerHTML='<div class="pw-cat-mega-cols" data-pw-cat-mega="1"><div class="pw-cat-mega-l1">'+l1+'</div><div class="pw-cat-mega-l23">'+panes+'</div></div><a href="'+esc(SALE_PATH)+'" class="is-sale pw-nav-sale pw-cat-mega-sale" data-pw-el="nav-link">'+esc(COPY.sale)+'</a>';
  panel.setAttribute('data-pw-cat-filled','1');
  bindMega(panel);
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
function ensureCatPanel(btn){
  var wrap=ensureCatWrap(btn);
  var local=wrap?wrap.querySelector(panelSel()):null;
  if(local)return local;
  var root=deviceRoot(btn);
  local=qs(root,panelSel());
  if(local&&(!wrap||wrap.contains(local)))return local;
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
function placePanelFixed(btn,panel){
  if(!btn||!panel)return;
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
function repositionOpenPanels(){
  var panels=document.querySelectorAll('[data-pw-panel-fixed].is-open');
  for(var i=0;i<panels.length;i++){
    var p=panels[i];
    var b=p.__pwOwnerBtn;
    if(b&&b.getBoundingClientRect)placePanelFixed(b,p);
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
    btn.addEventListener('click',function(e){
      if(pwShopLiveUiOff())return;
      e.preventDefault();
      e.stopPropagation();
      var cur=e.currentTarget;
      var livePanel=ensureCatPanel(cur);
      var root=deviceRoot(cur);
      var liveAccBtn=qs(root,accBtnSel());
      var liveAcc=liveAccBtn?qs(root,accPanelSel()):qs(root,accPanelSel());
      if(livePanel&&!livePanel.querySelector('a'))hydrateCats();
      togglePair(cur,livePanel,liveAccBtn,liveAcc);
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
        if(livePanel&&!livePanel.querySelector('a'))hydrateCats();
        togglePair(hit,livePanel,liveAccBtn,liveAcc);
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
  if(!panels.length)return;
  fetch(CAT_API,{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(j){
    var tree=(j&&Array.isArray(j.tree))?j.tree:[];
    for(i=0;i<panels.length;i++){
      panels[i].removeAttribute('data-pw-cat-filled');
      fillCatPanel(panels[i],tree);
    }
  }).catch(function(){
    for(i=0;i<panels.length;i++){
      if(!panels[i].querySelector('a'))fillCatPanel(panels[i],[]);
    }
  });
}
function boot(){
  applyLocalAuth();
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
  display:block!important;min-width:min(720px,calc(100vw - 1.5rem));max-width:calc(100vw - 1.5rem);padding:0;overflow:hidden;
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)
}
.pw-cat-mega-cols{display:grid;grid-template-columns:220px 1fr;min-height:200px}
.pw-cat-mega-l1{background:var(--pw-surface,#f9fafb);border-right:1px solid #e5e7eb;padding:10px;max-height:min(70vh,420px);overflow:auto;display:grid;gap:4px;align-content:start}
.pw-cat-mega-l23{padding:12px;max-height:min(70vh,420px);overflow:auto}
.pw-cat-mega-l2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.pw-cat-mega-l2{display:block;font-size:12px;font-weight:700;margin-bottom:4px}
.pw-cat-mega-l3{display:block;font-size:11px;font-weight:500;padding:2px 0;color:#6b7280}
.pw-cat-mega-hint{margin:0;font-size:12px;color:#6b7280}
.pw-cat-mega-sale{display:block;padding:10px 12px;border-top:1px solid #e5e7eb}
.pw-cat-mega-l1 a.is-active{background:color-mix(in srgb,var(--pw-primary) 12%,#fff);color:var(--pw-primary)}
@media (max-width:899px){
  .pw-cat-mega-cols{grid-template-columns:1fr;min-height:0}
  .pw-cat-mega-l1{max-height:36vh;border-right:none;border-bottom:1px solid #e5e7eb}
}
.pw-cat-panel.is-open:not([data-pw-panel-fixed]),.pw-shop-cat-panel.is-open:not([data-pw-panel-fixed]),
[data-pw-cat-panel].is-open:not([data-pw-panel-fixed]),
.pw-account-panel.is-open:not([data-pw-panel-fixed]),.pw-shop-account-panel.is-open:not([data-pw-panel-fixed]),
[data-pw-account-panel].is-open:not([data-pw-panel-fixed]){
  position:absolute;right:0;left:auto;top:calc(100% + 8px);z-index:120
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
.pw-cat-panel.is-open a:hover,.pw-shop-cat-panel.is-open a:hover,[data-pw-cat-panel].is-open a:hover{
  background:var(--pw-surface,#f3f4f6);color:var(--pw-primary,#2563eb)
}
.pw-account-panel.is-open a.is-header,.pw-shop-account-panel.is-open a.is-header{background:#eff6ff;color:#2563eb;border-left:3px solid #2563eb;font-weight:700}
.pw-account-panel.is-open a.is-accent,.pw-shop-account-panel.is-open a.is-accent{background:var(--pw-surface,#f3f4f6);color:var(--pw-accent,#ea580c);border-left:3px solid var(--pw-primary,#2563eb);font-weight:700}
[data-pw-chrome-btn="account"][role="button"],[data-pw-account-toggle]{cursor:pointer}
</style>`
}
