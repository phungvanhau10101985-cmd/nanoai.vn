import { normalizePartnerSitePathname } from '@/lib/partner-website/shop/partner-site-account-nav'

/** Shop dock kinds that map to a real page (not PDP CTA / Chat / Thử đồ). */
export type PartnerSiteDockNavKind =
  | 'home'
  | 'products'
  | 'sale'
  | 'cart'
  | 'account'
  | 'wishlist'
  | 'recently-viewed'
  | 'notifications'
  | 'orders'
  | 'contact'
  | 'categories'

const PAGE_KIND: Record<string, PartnerSiteDockNavKind | null> = {
  home: 'home',
  cart: 'cart',
  listing: 'products',
  account: 'account',
  info: 'contact',
  product: null,
  landing: 'home',
}

export const PARTNER_SHOP_DOCK_NAV_SCRIPT_ID = 'pw-shop-dock-nav-active'

/** Inactive dock stays grey; current page uses `--pw-primary` (every look / theme). */
export const PW_DOCK_NAV_ACTIVE_CSS = `
html[data-pw-page="home"] .pw-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="home"]:not([data-pw-pdp-home]):not([data-pw-dock-show="pdp"]):not([data-pw-hidden="1"]),
html[data-pw-page="home"] .pw-shop-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="home"]:not([data-pw-pdp-home]):not([data-pw-dock-show="pdp"]):not([data-pw-hidden="1"]),
.pw-shop[data-pw-page="home"] .pw-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="home"]:not([data-pw-pdp-home]):not([data-pw-dock-show="pdp"]):not([data-pw-hidden="1"]),
.pw-shop[data-pw-page="home"] .pw-shop-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="home"]:not([data-pw-pdp-home]):not([data-pw-dock-show="pdp"]):not([data-pw-hidden="1"]),
html[data-pw-page="cart"] .pw-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="cart"]:not([data-pw-hidden="1"]),
html[data-pw-page="cart"] .pw-shop-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="cart"]:not([data-pw-hidden="1"]),
.pw-shop[data-pw-page="cart"] .pw-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="cart"]:not([data-pw-hidden="1"]),
.pw-shop[data-pw-page="cart"] .pw-shop-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="cart"]:not([data-pw-hidden="1"]),
html[data-pw-page="listing"] .pw-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="products"]:not([data-pw-hidden="1"]),
html[data-pw-page="listing"] .pw-shop-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="products"]:not([data-pw-hidden="1"]),
.pw-shop[data-pw-page="listing"] .pw-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="products"]:not([data-pw-hidden="1"]),
.pw-shop[data-pw-page="listing"] .pw-shop-bottom-nav[data-pw-chrome-kit="dock"]:not(:has([aria-current="page"])) > [data-pw-chrome-btn="products"]:not([data-pw-hidden="1"]),
.pw-bottom-nav > a.is-active,.pw-shop-bottom-nav > a.is-active,
.pw-bottom-nav > button.is-active,.pw-shop-bottom-nav > button.is-active,
.pw-bottom-nav > a[aria-current="page"],.pw-shop-bottom-nav > a[aria-current="page"],
.pw-bottom-nav > button[aria-current="page"],.pw-shop-bottom-nav > button[aria-current="page"],
.pw-bottom-nav .pw-account-btn.is-active,.pw-shop-bottom-nav .pw-account-btn.is-active,
.pw-bottom-nav .pw-account-btn[aria-current="page"],.pw-shop-bottom-nav .pw-account-btn[aria-current="page"],
[data-pw-chrome-kit="dock"] > .is-active,[data-pw-chrome-kit="dock"] > [aria-current="page"],
[data-pw-live-dock] .pw-bottom-nav > a.is-active,[data-pw-live-dock] .pw-shop-bottom-nav > a.is-active,
[data-pw-live-dock] .pw-bottom-nav > a[aria-current="page"],[data-pw-live-dock] .pw-shop-bottom-nav > a[aria-current="page"]{
  color:var(--pw-primary)!important
}
html[data-pw-page="home"] .pw-bottom-nav[data-pw-chrome-kit="dock"] > [data-pw-chrome-btn="home"]:not([data-pw-pdp-home]):not([data-pw-dock-show="pdp"]) svg,
html[data-pw-page="cart"] .pw-bottom-nav[data-pw-chrome-kit="dock"] > [data-pw-chrome-btn="cart"] svg,
html[data-pw-page="listing"] .pw-bottom-nav[data-pw-chrome-kit="dock"] > [data-pw-chrome-btn="products"] svg,
.pw-bottom-nav > a.is-active svg,.pw-shop-bottom-nav > a.is-active svg,
.pw-bottom-nav > button.is-active svg,.pw-shop-bottom-nav > button.is-active svg,
.pw-bottom-nav > a[aria-current="page"] svg,.pw-shop-bottom-nav > a[aria-current="page"] svg,
.pw-bottom-nav > button[aria-current="page"] svg,.pw-shop-bottom-nav > button[aria-current="page"] svg,
[data-pw-chrome-kit="dock"] > .is-active svg,[data-pw-chrome-kit="dock"] > [aria-current="page"] svg{
  stroke:currentColor!important
}
`.trim()

export function partnerSiteDockNavKindFromPage(pageKind: string | null | undefined): PartnerSiteDockNavKind | null {
  const key = String(pageKind || '').trim()
  if (!key) return null
  return Object.prototype.hasOwnProperty.call(PAGE_KIND, key) ? PAGE_KIND[key] : null
}

/** Live URL → dock kind. PDP (`/products/{id}`) has no shop-dock current page. */
export function partnerSiteDockNavKindFromPathname(pathname: string): PartnerSiteDockNavKind | null {
  const path = normalizePartnerSitePathname(pathname)
  if (path === '/' || path === '') return 'home'
  if (path === '/cart' || path.startsWith('/cart/') || path === '/account/cart') return 'cart'
  if (path === '/wishlist' || path === '/account/wishlist') return 'wishlist'
  if (path === '/recently-viewed' || path === '/account/recently-viewed') return 'recently-viewed'
  if (path === '/account/notifications') return 'notifications'
  if (path.startsWith('/orders') || path === '/account/orders') return 'orders'
  if (path === '/kho-sale' || path.startsWith('/kho-sale/') || path === '/sale') return 'sale'
  if (path === '/contact' || path === '/account/contact') return 'contact'
  if (path === '/products') return 'products'
  if (path.startsWith('/products/')) return null
  if (path === '/c' || path.startsWith('/c/') || path === '/search' || path.startsWith('/search/')) return 'products'
  if (path === '/tim-kiem' || path.startsWith('/tim-kiem/') || path === '/tim-theo-anh') return 'products'
  if (path === '/login' || path.startsWith('/login/')) return 'account'
  if (path === '/account' || path.startsWith('/account/')) return 'account'
  return null
}

export const PARTNER_SHOP_DOCK_NAV_SCRIPT = `(function(){
  var ATTR='aria-current';
  var SKIP={'try-on':1,'favorite-product':1,'add-cart':1,'buy-now':1,'chat':1,'chat-zalo':1,'chat-facebook':1,'chat-instagram':1,'chat-whatsapp':1,'phone':1,'topup':1,'share':1,'logout':1,'back':1,'search':1,'search-image':1};
  function html(){return document.documentElement}
  function editor(){return !!(document.body&&document.body.classList&&document.body.classList.contains('nanoai-ve-active'))}
  function pageKind(){
    var root=html();
    return (root.getAttribute('data-pw-page')||(document.body&&document.body.getAttribute('data-pw-page'))||'').trim();
  }
  function norm(p){
    var raw=String(p||'/').split(/[?#]/)[0]||'/';
    var stripped=raw.replace(/^\\/site\\/[^/]+(?=\\/|$)/,'');
    var path=stripped.charAt(0)==='/'?stripped:'/'+stripped;
    return path.replace(/\\/+$/,'')||'/';
  }
  function kindFromPage(page){
    if(page==='home'||page==='landing')return 'home';
    if(page==='cart')return 'cart';
    if(page==='listing')return 'products';
    if(page==='account')return 'account';
    if(page==='info')return 'contact';
    return null;
  }
  function kindFromPath(path){
    if(path==='/'||path==='')return 'home';
    if(path==='/cart'||path.indexOf('/cart/')===0||path==='/account/cart')return 'cart';
    if(path==='/wishlist'||path==='/account/wishlist')return 'wishlist';
    if(path==='/recently-viewed'||path==='/account/recently-viewed')return 'recently-viewed';
    if(path==='/account/notifications')return 'notifications';
    if(path.indexOf('/orders')===0||path==='/account/orders')return 'orders';
    if(path==='/kho-sale'||path.indexOf('/kho-sale/')===0||path==='/sale')return 'sale';
    if(path==='/contact'||path==='/account/contact')return 'contact';
    if(path==='/products')return 'products';
    if(path.indexOf('/products/')===0)return null;
    if(path==='/c'||path.indexOf('/c/')===0||path==='/search'||path.indexOf('/search/')===0)return 'products';
    if(path==='/tim-kiem'||path.indexOf('/tim-kiem/')===0||path==='/tim-theo-anh')return 'products';
    if(path==='/login'||path.indexOf('/login/')===0||path==='/account'||path.indexOf('/account/')===0)return 'account';
    return null;
  }
  function shopBtns(){
    var nodes=document.querySelectorAll('.pw-bottom-nav [data-pw-chrome-btn],.pw-shop-bottom-nav [data-pw-chrome-btn],[data-pw-chrome-kit="dock"] > [data-pw-chrome-btn],[data-pw-live-dock] [data-pw-chrome-btn]');
    var out=[],i,el,kind,show,nav;
    for(i=0;i<nodes.length;i++){
      el=nodes[i];
      kind=el.getAttribute('data-pw-chrome-btn')||'';
      if(!kind||SKIP[kind])continue;
      show=el.getAttribute('data-pw-dock-show')||'';
      if(show==='pdp'||el.getAttribute('data-pw-pdp-home')||el.getAttribute('data-pw-pdp-nav'))continue;
      if(el.getAttribute('data-pw-hidden')==='1')continue;
      nav=el.closest&&el.closest('.pw-bottom-nav,.pw-shop-bottom-nav,[data-pw-chrome-kit="dock"],[data-pw-live-dock]');
      if(!nav)continue;
      out.push(el);
    }
    return out;
  }
  function hrefPath(el){
    var href=el.getAttribute('href')||'';
    if(!href||href.charAt(0)==='#')return '';
    try{return norm(new URL(href,location.href).pathname);}catch(e){return norm(href);}
  }
  function matchHref(path,btns){
    var best=null,bestLen=-1,i,el,hp,kind;
    for(i=0;i<btns.length;i++){
      el=btns[i];
      hp=hrefPath(el);
      if(!hp)continue;
      kind=el.getAttribute('data-pw-chrome-btn')||'';
      if(hp==='/'){if(path==='/'&&kind==='home')return el;continue;}
      if(path===hp||path.indexOf(hp+'/')===0){
        if(hp.length>bestLen){best=el;bestLen=hp.length;}
      }
    }
    return best;
  }
  function findKind(btns,kind){
    var i,el;
    if(!kind)return null;
    for(i=0;i<btns.length;i++){
      el=btns[i];
      if((el.getAttribute('data-pw-chrome-btn')||'')===kind)return el;
    }
    return null;
  }
  function paint(){
    var btns=shopBtns();
    var kind=editor()?kindFromPage(pageKind()):kindFromPath(norm(location.pathname||'/'));
    if(!kind&&!editor())kind=kindFromPage(pageKind());
    var target=findKind(btns,kind);
    if(!target&&!editor())target=matchHref(norm(location.pathname||'/'),btns);
    var i,el,on;
    for(i=0;i<btns.length;i++){
      el=btns[i];
      on=el===target;
      if(el.classList)el.classList.toggle('is-active',on);
      if(on)el.setAttribute(ATTR,'page');
      else el.removeAttribute(ATTR);
    }
  }
  function wrapHist(name){
    var orig=history[name];
    if(typeof orig!=='function')return;
    history[name]=function(){
      var ret=orig.apply(this,arguments);
      paint();
      return ret;
    };
  }
  paint();
  window.addEventListener('popstate',paint);
  window.addEventListener('pageshow',paint);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')paint();});
  try{
    wrapHist('pushState');
    wrapHist('replaceState');
  }catch(eHist){}
  try{
    var mo=new MutationObserver(paint);
    mo.observe(html(),{attributes:true,attributeFilter:['data-pw-page']});
    if(document.body)mo.observe(document.body,{attributes:true,attributeFilter:['data-pw-page']});
  }catch(eMo){}
})();`
