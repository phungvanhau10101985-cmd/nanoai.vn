import type { WebLocale } from '@/lib/i18n/config'

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

/** Inline script: UTM hero, profile greeting, hydrate personalized product grids on /site landing. */
export function buildPartnerSitePersonalizationBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const locale = input.locale in EMPTY ? input.locale : 'en'
  const apiBase = `/api/site/${encodeURIComponent(slug)}/personalization`
  const copy = {
    empty: EMPTY[locale],
    greeting: GREETING[locale],
    viewCta: VIEW_CTA[locale],
  }

  return `<script>(function(){
var API=${JSON.stringify(apiBase)};
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
function renderCard(p,cta){
  var href=p.detail_path||p.product_url||'#';
  var name=(p.name||'').replace(/"/g,'&quot;');
  return '<article class="pw-product-card"><a href="'+href+'"><img src="'+p.image_url+'" alt="'+name+'" loading="lazy"/></a><h3>'+name+'</h3>'+(p.price_hint?'<p class="pw-price">'+p.price_hint+'</p>':'')+'<a class="pw-btn pw-btn-sm pw-btn-accent" href="'+href+'">'+(cta||COPY.viewCta)+'</a></article>';
}
function hydrateBlock(el){
  var kind=el.getAttribute('data-pw-personalize');if(!kind)return;
  var limit=Math.max(1,Math.min(24,parseInt(el.getAttribute('data-limit')||'8',10)||8));
  var cta=el.getAttribute('data-cta')||COPY.viewCta;
  var grid=el.querySelector('[data-pw-grid]');var empty=el.querySelector('.pw-personalize-empty');
  var path=kind==='recommended'?'/recommendations?limit='+limit:kind==='favorites'?'/favorites?limit='+limit:'/recently-viewed?limit='+limit;
  apiFetch(path).then(function(res){
    var products=(res.j&&res.j.products)||[];
    if(!products.length){if(empty){empty.hidden=false;empty.textContent=COPY.empty;}if(grid)grid.innerHTML='';el.hidden=false;return;}
    if(grid)grid.innerHTML=products.map(function(p){return renderCard(p,cta);}).join('');
    if(empty)empty.hidden=true;el.hidden=false;
  }).catch(function(){if(empty){empty.hidden=false;empty.textContent=COPY.empty;}});
}
function applyGreeting(){
  var el=document.querySelector('[data-pw-greeting]');if(!el)return;
  apiFetch('/profile').then(function(res){
    var name=res.j&&res.j.profile&&res.j.profile.greeting_name;
    if(name)el.textContent=COPY.greeting+', '+name;
  }).catch(function(){});
}
function run(){
  var utm=parseUtm();
  if(utm){apiFetch('/events',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(utm)}).catch(function(){});}
  applyHeroVariant();
  applyGreeting();
  document.querySelectorAll('[data-pw-personalize]').forEach(function(el){
    el.hidden=true;
    hydrateBlock(el);
  });
  apiFetch('/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'page_view'})}).catch(function(){});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();</script>`
}
