import type { WebLocale } from '@/lib/i18n/config'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import { PW_SHOP_CARD_IMG_JS } from '@/lib/partner-website/shop/inventory-shop-detail'
import { PW_PRODUCT_GRID_PAGE_JS } from '@/lib/partner-website/shop/pw-product-grid-page'
import {
  partnerSiteProductsPath,
  partnerSiteRecentlyViewedPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

const EMPTY: Record<WebLocale, string> = {
  vi: 'Chưa có sản phẩm phù hợp.',
  en: 'No matching products yet.',
  zh: '暂无匹配商品。',
  ja: '該当する商品はまだありません。',
  ko: '아직 맞는 상품이 없습니다.',
}

const GREETING: Record<WebLocale, string> = {
  vi: 'Xin chào',
  en: 'Hello',
  zh: '你好',
  ja: 'こんにちは',
  ko: '안녕하세요',
}

const VIEW_CTA: Record<WebLocale, string> = {
  vi: 'Xem chi tiết',
  en: 'View details',
  zh: '查看详情',
  ja: '詳細を見る',
  ko: '자세히 보기',
}

const ADD_CART: Record<WebLocale, string> = {
  vi: 'Thêm vào giỏ',
  en: 'Add to cart',
  zh: '加入购物车',
  ja: 'カートに追加',
  ko: '장바구니',
}

const LOAD_MORE: Record<WebLocale, string> = {
  vi: 'Xem thêm',
  en: 'See more',
  zh: '查看更多',
  ja: 'もっと見る',
  ko: '더 보기',
}

const SEE_ALL: Record<WebLocale, string> = {
  vi: 'Xem tất cả các nhóm',
  en: 'See all groups',
  zh: '查看全部分组',
  ja: 'すべてのグループを見る',
  ko: '모든 그룹 보기',
}

const FEATURED_EMPTY: Record<WebLocale, string> = {
  vi: 'Chưa có danh mục phù hợp.',
  en: 'No matching categories yet.',
  zh: '暂无匹配分类。',
  ja: '該当するカテゴリはまだありません。',
  ko: '맞는 카테고리가 아직 없습니다.',
}

const FEATURED_SEE_ALL: Record<WebLocale, string> = {
  vi: 'Xem tất cả danh mục',
  en: 'View all categories',
  zh: '查看全部分类',
  ja: 'すべてのカテゴリを見る',
  ko: '모든 카테고리 보기',
}

const FOR_YOU: Record<WebLocale, string> = {
  vi: 'Dành cho bạn',
  en: 'For you',
  zh: '为你',
  ja: 'おすすめ',
  ko: '추천',
}

const FAVORITE: Record<WebLocale, string> = {
  vi: 'Thích',
  en: 'Favorite',
  zh: '收藏',
  ja: 'お気に入り',
  ko: '찜',
}

/** Inline script: UTM hero, profile greeting, hydrate personalized product grids on /site landing. */
export function buildPartnerSitePersonalizationBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const locale = input.locale in EMPTY ? input.locale : 'en'
  const apiBase = `/api/site/${encodeURIComponent(slug)}/personalization`
  const productsPath = partnerSiteProductsPath(slug)
  const viewedPath = partnerSiteRecentlyViewedPath(slug)
  const copy = {
    empty: EMPTY[locale],
    greeting: GREETING[locale],
    viewCta: VIEW_CTA[locale],
    addToCart: ADD_CART[locale],
    favorite: FAVORITE[locale],
    forYou: FOR_YOU[locale],
    loadMore: LOAD_MORE[locale],
    seeAll: SEE_ALL[locale],
    featuredEmpty: FEATURED_EMPTY[locale],
    featuredSeeAll: FEATURED_SEE_ALL[locale],
  }

  return `<script data-pw-personalization-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var API=${JSON.stringify(apiBase)};
var PRODUCTS_PATH=${JSON.stringify(productsPath)};
var VIEWED_PATH=${JSON.stringify(viewedPath)};
var COPY=${JSON.stringify(copy)};
var SESSION_KEY='app_guest_session_id';
var SESSION_KEY_LEGACY='nanoai_guest_session_id';
var SESSION_HDR='x-guest-session-id';
function readCookie(n){var p=document.cookie.split(';');for(var i=0;i<p.length;i++){var x=p[i].trim().split('=');if(x[0]===n)return decodeURIComponent(x.slice(1).join('=')||'');}return '';}
function sessionId(){try{var ls=localStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY_LEGACY)||'';if(ls)return ls;}catch(e){}return readCookie('app_guest_session_sync');}
function authHeaders(){var h={};var s=sessionId();if(s)h[SESSION_HDR]=s;return h;}
function captureSession(res){var sid=res.headers.get(SESSION_HDR);if(sid){try{localStorage.setItem(SESSION_KEY,sid);localStorage.setItem(SESSION_KEY_LEGACY,sid);}catch(e){}}}
function apiFetch(path,opts){
  opts=opts||{};opts.credentials='same-origin';
  opts.headers=Object.assign({},authHeaders(),opts.headers||{});
  return fetch(API+path,opts).then(function(r){captureSession(r);return r.json().then(function(j){return {ok:r.ok,j:j};});});
}
function parseUtm(){
  var q=new URLSearchParams(location.search);
  var u={utm_source:q.get('utm_source')||'',utm_medium:q.get('utm_medium')||'',utm_campaign:q.get('utm_campaign')||'',utm_content:q.get('utm_content')||'',utm_term:q.get('utm_term')||''};
  if(!u.utm_source&&!u.utm_medium&&!u.utm_campaign&&!u.utm_content&&!u.utm_term)return null;
  return u;
}
function matchUtmVariant(variants,utm){
  if(!variants||!utm)return null;
  for(var i=0;i<variants.length;i++){
    var v=variants[i];if(!v||!v.match)continue;var m=v.match,ok=true;
    if(m.source&&m.source.toLowerCase()!==(utm.utm_source||'').toLowerCase())ok=false;
    if(m.medium&&m.medium.toLowerCase()!==(utm.utm_medium||'').toLowerCase())ok=false;
    if(m.campaign&&m.campaign.toLowerCase()!==(utm.utm_campaign||'').toLowerCase())ok=false;
    if(ok)return v;
  }
  return null;
}
function applyHeroVariant(){
  var hero=document.querySelector('[data-pw-hero-variants]');if(!hero)return;
  var utm=parseUtm();if(!utm)return;
  var raw=hero.getAttribute('data-pw-hero-variants');if(!raw)return;
  try{var variants=JSON.parse(raw);}catch(e){return;}
  var hit=matchUtmVariant(variants,utm);if(!hit)return;
  if(hit.title){var h1=hero.querySelector('h1');if(h1)h1.textContent=hit.title;}
  if(hit.subtitle){var sub=hero.querySelector('.pw-hero-sub');if(sub)sub.textContent=hit.subtitle;}
  if(hit.ctaText){var btn=hero.querySelector('.pw-btn');if(btn)btn.textContent=hit.ctaText;}
  if(hit.backgroundImage){hero.style.backgroundImage="linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url('"+hit.backgroundImage+"')";}
}
${PW_SHOP_CARD_IMG_JS}
${PW_PRODUCT_GRID_PAGE_JS}
function renderCard(p,cta,badge){
  var href=p.detail_path||p.product_url||'#';
  var name=(p.name||'').replace(/"/g,'&quot;');
  var id=(p.inventory_id||'').replace(/"/g,'');
  var img=shopImg(p).replace(/"/g,'&quot;');
  var mark=badge?'<span class="pw-for-you-badge">'+COPY.forYou+'</span>':'';
  var cart=id
    ? '<button type="button" class="pw-btn pw-btn-cart" data-pw-el="card-cart" data-pw-add-cart data-inventory-id="'+id+'">'+COPY.addToCart+'</button>'
    : '<a class="pw-btn pw-btn-cart" data-pw-el="card-cart" href="'+href+'">'+(cta||COPY.viewCta)+'</a>';
  return '<article class="pw-product-card" data-pw-el="card" data-inventory-id="'+id+'" data-pw-actions-ready="1"><a class="pw-product-card-media" data-pw-el="card-media" href="'+href+'">'+mark+'<img src="'+img+'" alt="'+name+'" loading="lazy"/></a><div class="pw-product-card-body"><h3 data-pw-el="card-name"><a href="'+href+'">'+name+'</a></h3>'+(p.price_hint?'<p class="pw-price" data-pw-el="card-price">'+p.price_hint+'</p>':'')+'<div class="pw-shop-action-bar">'+cart+'</div></div></article>';
}
function ensureGridMore(el){
  var actions=el.querySelector('[data-pw-grid-actions],.pw-grid-actions');
  if(!actions){
    actions=document.createElement('div');
    actions.className='pw-grid-actions';
    actions.setAttribute('data-pw-grid-actions','1');
    var grid=el.querySelector('[data-pw-grid]');
    if(grid&&grid.parentNode)grid.parentNode.insertBefore(actions,grid.nextSibling);
    else el.appendChild(actions);
  }
  var more=actions.querySelector('[data-pw-grid-more]');
  if(!more){
    more=document.createElement('button');
    more.type='button';
    more.className='pw-grid-more';
    more.setAttribute('data-pw-grid-more','1');
    more.innerHTML='<span class="pw-grid-more-icon" aria-hidden="true">↻</span> '+COPY.loadMore;
    actions.appendChild(more);
  }
  var see=actions.querySelector('[data-pw-el="section-more"],.pw-grid-all');
  if(!see){
    see=document.createElement('a');
    see.className='pw-grid-all';
    see.setAttribute('data-pw-el','section-more');
    see.textContent=COPY.seeAll;
    var kind=el.getAttribute('data-pw-personalize');
    see.setAttribute('href',kind==='recently-viewed'?VIEWED_PATH:PRODUCTS_PATH);
    actions.appendChild(see);
  }
  see.hidden=false;
  return more;
}
function paintMore(el){
  var more=ensureGridMore(el);
  var st=el._pwGrid;
  more.hidden=!st||!st.hasMore;
}
function personalizePath(el,offset,limit){
  var kind=el.getAttribute('data-pw-personalize');
  var base=kind==='recommended'?'/recommendations':kind==='favorites'?'/favorites':'/recently-viewed';
  return base+'?limit='+limit+'&offset='+offset;
}
function escapeFeat(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function renderFeaturedTile(t,circles){
  var href=escapeFeat(t.href||'#');
  var name=escapeFeat(t.short_name||t.name||'');
  var img=escapeFeat(t.image_url||'');
  var media=img?'<img src="'+img+'" alt="'+name+'" loading="lazy"/>':'';
  if(circles){
    return '<a class="pw-cat-card" data-pw-el="card" href="'+href+'"><span class="pw-cat-media" data-pw-el="card-media">'+media+'</span><span class="pw-cat-label" data-pw-el="card-name">'+name+'</span></a>';
  }
  return '<a class="pw-featured-cat-card" data-pw-el="card" href="'+href+'"><span class="pw-featured-cat-media" data-pw-el="card-media">'+media+'</span><span data-pw-el="card-name">'+name+'</span></a>';
}
function featuredCards(el){
  var names=el.querySelectorAll('[data-pw-edit^="categoryName"],[data-pw-el="card-name"]');
  var cards=[],seen={},i,card;
  for(i=0;i<names.length;i++){
    card=names[i].closest('[data-pw-el="card"],a,article');
    if(!card||seen[card])continue;
    seen[card]=1;
    cards.push(card);
  }
  if(cards.length)return cards;
  var nodes=el.querySelectorAll('[data-pw-el="card"],.pw-cat-card,.pw-featured-cat-card');
  for(i=0;i<nodes.length;i++)cards.push(nodes[i]);
  return cards;
}
function seedFeaturedCard(card){
  if(card.getAttribute('data-pw-seed-name')!=null)return;
  var nameEl=card.querySelector('[data-pw-el="card-name"],[data-pw-edit^="categoryName"]');
  var img=card.querySelector('img');
  card.setAttribute('data-pw-seed-name',nameEl?String(nameEl.textContent||'').replace(/\\s+/g,' ').trim():'');
  card.setAttribute('data-pw-seed-href',card.getAttribute('href')||'');
  if(img)card.setAttribute('data-pw-seed-src',img.getAttribute('src')||'');
}
function paintFeaturedCard(card,tile){
  seedFeaturedCard(card);
  var name=String((tile&&(tile.short_name||tile.name))||'').trim();
  var href=String((tile&&tile.href)||'').trim()||'#';
  var imgUrl=String((tile&&tile.image_url)||'').trim();
  if(card.tagName==='A')card.setAttribute('href',href);
  var nameEl=card.querySelector('[data-pw-el="card-name"],[data-pw-edit^="categoryName"]');
  if(nameEl)nameEl.textContent=name;
  var img=card.querySelector('[data-pw-el="card-media"] img, img');
  if(img&&imgUrl){img.setAttribute('src',imgUrl);img.setAttribute('alt',name);}
  card.hidden=false;
}
function paintFeaturedCards(el,tiles){
  var cards=featuredCards(el);
  var i;
  for(i=0;i<cards.length;i++){
    if(i<tiles.length)paintFeaturedCard(cards[i],tiles[i]);
    else cards[i].hidden=true;
  }
  return cards.length>0;
}
function hydrateFeatured(el){
  var grid=el.querySelector('[data-pw-grid],.pw-cat-grid,.pw-featured-cat-grid');
  var empty=el.querySelector('.pw-featured-cat-empty,.pw-personalize-empty');
  var see=el.querySelector('[data-pw-el="section-more"]');
  var circles=el.classList.contains('pw-categories')||!!el.querySelector('.pw-cat-grid,.pw-cat-card,[data-pw-edit^="categoryName"]');
  var keepCards=featuredCards(el).length>0;
  var limit=typeof pwGridPageSize==='function'?pwGridPageSize(el):(keepCards?featuredCards(el).length:10);
  apiFetch('/featured-categories?limit='+limit).then(function(res){
    var tiles=(res.j&&res.j.tiles)||[];
    if(res.j&&res.j.hub_href&&see)see.setAttribute('href',res.j.hub_href);
    if(see&&!see.textContent)see.textContent=COPY.featuredSeeAll;
    if(!tiles.length){
      if(empty){empty.hidden=false;empty.textContent=COPY.featuredEmpty;}
      el.hidden=false;return;
    }
    if(keepCards)paintFeaturedCards(el,tiles);
    else if(grid)grid.innerHTML=tiles.map(function(t){return renderFeaturedTile(t,circles);}).join('');
    if(empty)empty.hidden=true;
    el.hidden=false;
  }).catch(function(){
    if(empty){empty.hidden=false;empty.textContent=COPY.featuredEmpty;}
    el.hidden=false;
  });
}
function loadPersonalizePage(el,append){
  var kind=el.getAttribute('data-pw-personalize');if(!kind||kind==='featured-categories')return;
  var st=el._pwGrid;if(!st||st.loading)return;
  var cta=el.getAttribute('data-cta')||COPY.viewCta;
  var grid=el.querySelector('[data-pw-grid]');var empty=el.querySelector('.pw-personalize-empty');
  st.loading=true;
  apiFetch(personalizePath(el,st.offset,st.pageSize)).then(function(res){
    st.loading=false;
    var products=(res.j&&res.j.products)||[];
    var badges={};
    (res.j&&res.j.cohort_badge_product_ids||[]).forEach(function(id){badges[String(id).toLowerCase()]=1;});
    if(!products.length){
      if(!append){
        if(empty){empty.hidden=false;empty.textContent=COPY.empty;}
        if(grid&&!grid.querySelector('[data-pw-grid-placeholder]'))grid.innerHTML='';
      }
      st.hasMore=false;paintMore(el);el.hidden=false;return;
    }
    var html=products.map(function(p){return renderCard(p,cta,!!badges[String(p.inventory_id||'').toLowerCase()]);}).join('');
    if(grid){
      if(!append)grid.innerHTML=html;
      else{
        var tmp=document.createElement('div');
        tmp.innerHTML=html;
        while(tmp.firstChild)grid.appendChild(tmp.firstChild);
      }
    }
    if(empty)empty.hidden=true;
    st.offset+=products.length;
    st.hasMore=res.j&&res.j.hasMore===true;
    paintMore(el);
    el.hidden=false;
  }).catch(function(){
    st.loading=false;
    if(empty){empty.hidden=false;empty.textContent=COPY.empty;}
    st.hasMore=false;paintMore(el);el.hidden=false;
  });
}
function hydrateBlock(el){
  el._pwGrid={offset:0,pageSize:pwGridPageSize(el),hasMore:true,loading:false};
  loadPersonalizePage(el,false);
}
function applyGreeting(){
  var el=document.querySelector('[data-pw-greeting]');if(!el)return;
  apiFetch('/profile').then(function(res){
    var name=res.j&&res.j.profile&&res.j.profile.greeting_name;
    if(name)el.textContent=COPY.greeting+', '+name;
  }).catch(function(){});
}
function featuredHosts(){
  return document.querySelectorAll('[data-pw-featured-categories],section.pw-categories,.pw-categories,[data-pw-region="categories"]');
}
function run(){
  var editor=pwShopLiveUiOff();
  if(!editor){
    var utm=parseUtm();
    if(utm){apiFetch('/events',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(utm)}).catch(function(){});}
    applyHeroVariant();
    applyGreeting();
    document.querySelectorAll('[data-pw-personalize]').forEach(function(el){
      if(el.getAttribute('data-pw-featured-categories')==='1')return;
      if(el.getAttribute('data-pw-personalize')==='featured-categories')return;
      var grid=el.querySelector('[data-pw-grid]');
      if(!(grid&&grid.children.length)) el.hidden=true;
      hydrateBlock(el);
    });
  }
  featuredHosts().forEach(function(el){
    if(
      el.getAttribute('data-pw-featured-categories')==='1'||
      el.classList.contains('pw-categories')||
      el.classList.contains('pw-featured-cat')||
      el.querySelector('[data-pw-edit^="categoryName"]')
    ){
      hydrateFeatured(el);
    }
  });
  if(!document.documentElement.getAttribute('data-pw-personalize-more-bound')){
    document.documentElement.setAttribute('data-pw-personalize-more-bound','1');
    document.addEventListener('click',function(ev){
      var t=ev.target;if(!t||!t.closest)return;
      var more=t.closest('[data-pw-grid-more]');
      if(!more)return;
      var host=more.closest('[data-pw-personalize]');
      if(!host||!host._pwGrid)return;
      ev.preventDefault();
      loadPersonalizePage(host,true);
    });
  }
  apiFetch('/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'page_view'})}).catch(function(){});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();</script>`
}
