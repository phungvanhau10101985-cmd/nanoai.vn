import type { WebLocale } from '@/lib/i18n/config'
import { FEATURED_CATEGORY_TILE_DEFAULT } from '@/lib/partner-website/shop/featured-categories-constants'
import { PW_FEATURED_MARQUEE_JS } from '@/lib/partner-website/shop/featured-category-marquee-js'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import { PW_SHOP_CARD_IMG_JS } from '@/lib/partner-website/shop/inventory-shop-detail'
import { PW_PRODUCT_GRID_PAGE_JS } from '@/lib/partner-website/shop/pw-product-grid-page'
import {
  partnerSiteAccountEditPath,
  partnerSiteCategoryHubPath,
  partnerSiteInfoPath,
  partnerSiteLoginPath,
  partnerSiteProductsPath,
  partnerSiteRecentlyViewedPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  PW_SITE_SALE_CARD_CSS,
  PW_SITE_SALE_TICK_CHIPS_JS,
  PW_SITE_SALE_VIEW_JS,
  partnerSiteSaleCopy,
} from '@/lib/partner-website/promotions/partner-site-sale-display'

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

const REC_BADGE: Record<WebLocale, string> = {
  vi: 'Đề xuất',
  en: 'For you',
  zh: '推荐',
  ja: 'おすすめ',
  ko: '추천',
}

const REC_PERSONALIZE: Record<WebLocale, string> = {
  vi: 'Cá nhân hóa',
  en: 'Personalized',
  zh: '个性化',
  ja: 'パーソナライズ',
  ko: '맞춤 추천',
}

const REC_HELP_TIP: Record<WebLocale, string> = {
  vi: 'Để nhận ưu đãi sinh nhật và sản phẩm hợp tuổi, hợp gu — cập nhật trong Hồ sơ; thông tin không hiển thị công khai.',
  en: 'Add your profile to get birthday offers and products that match your age and style. This stays private.',
  zh: '填写资料即可获得生日优惠和符合年龄、风格的推荐。信息不会公开显示。',
  ja: 'プロフィールを登録すると誕生日特典と年齢・好みに合うおすすめが表示されます。公開されません。',
  ko: '프로필을 입력하면 생일 혜택과 나이·취향에 맞는 상품을 받을 수 있습니다. 공개되지 않습니다.',
}

const REC_HELP_ARIA: Record<WebLocale, string> = {
  vi: 'Tại sao cần cập nhật tuổi và giới tính?',
  en: 'Why update age and gender?',
  zh: '为什么需要年龄和性别？',
  ja: '年齢と性別が必要な理由',
  ko: '나이와 성별이 필요한 이유',
}

const REC_PICKER_LEAD: Record<WebLocale, string> = {
  vi: 'Hôm nay bạn muốn xem gì?',
  en: 'What do you want to see today?',
  zh: '今天想看什么？',
  ja: '今日は何を見ますか？',
  ko: '오늘은 무엇을 볼까요?',
}

const REC_PICKER_ALL: Record<WebLocale, string> = {
  vi: 'Xem tất cả →',
  en: 'See all →',
  zh: '查看全部 →',
  ja: 'すべて見る →',
  ko: '모두 보기 →',
}

const REC_PICKER_ERROR: Record<WebLocale, string> = {
  vi: 'Không tải được danh mục gợi ý.',
  en: 'Could not load suggested categories.',
  zh: '无法加载推荐分类。',
  ja: 'おすすめカテゴリを読み込めませんでした。',
  ko: '추천 카테고리를 불러오지 못했습니다.',
}

const REC_SOLD: Record<WebLocale, string> = {
  vi: 'Đã bán',
  en: 'Sold',
  zh: '已售',
  ja: '販売',
  ko: '판매',
}

const FAVORITE: Record<WebLocale, string> = {
  vi: 'Thích',
  en: 'Favorite',
  zh: '收藏',
  ja: 'お気に入り',
  ko: '찜',
}

const COHORT_LOGIN: Record<WebLocale, string> = {
  vi: 'Điền hồ sơ để nhận ưu đãi sinh nhật & sản phẩm có thể bạn thích.',
  en: 'Add your profile to get birthday offers and products you may like.',
  zh: '填写资料即可获得生日优惠和个性化推荐。',
  ja: 'プロフィールを登録すると誕生日特典とおすすめが表示されます。',
  ko: '프로필을 입력하면 생일 혜택과 추천 상품을 받을 수 있습니다.',
}

const COHORT_LOGIN_CTA: Record<WebLocale, string> = {
  vi: 'Đăng nhập nhận ưu đãi',
  en: 'Sign in for offers',
  zh: '登录领取优惠',
  ja: 'ログインして特典を受け取る',
  ko: '로그인하고 혜택 받기',
}

const COHORT_PROFILE_LINK: Record<WebLocale, string> = {
  vi: 'Cập nhật ngày sinh & giới tính',
  en: 'Add date of birth & gender',
  zh: '更新生日和性别',
  ja: '生年月日と性別を更新',
  ko: '생년월일과 성별 업데이트',
}

const COHORT_PROFILE_LEAD: Record<WebLocale, string> = {
  vi: 'để nhận ưu đãi sinh nhật & sản phẩm hợp tuổi, hợp gu.',
  en: 'to get birthday offers and products that match your age and style.',
  zh: '即可获得生日优惠和符合年龄、风格的推荐。',
  ja: 'と誕生日特典・年齢に合うおすすめが届きます。',
  ko: '하면 생일 혜택과 나이·취향에 맞는 상품을 받을 수 있습니다.',
}

const COHORT_POPULAR: Record<WebLocale, string> = {
  vi: 'Sản phẩm nổi bật hôm nay — đăng nhập để cá nhân hoá theo gu của bạn.',
  en: 'Today’s highlights — sign in to personalize by your taste.',
  zh: '今日精选 — 登录即可按你的偏好个性化。',
  ja: '今日のおすすめ — ログインすると好みに合わせて表示されます。',
  ko: '오늘의 인기 상품 — 로그인하면 취향에 맞게 보여 줍니다.',
}

const COHORT_EDIT: Record<WebLocale, string> = {
  vi: 'Sửa tuổi / giới tính',
  en: 'Edit age / gender',
  zh: '修改年龄 / 性别',
  ja: '年齢 / 性別を編集',
  ko: '나이 / 성별 수정',
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
  const loginPath = partnerSiteLoginPath(slug)
  const profilePath = partnerSiteAccountEditPath(slug)
  const helpPath = partnerSiteInfoPath(slug, 'goi-y-tuoi-gioi')
  const hubPath = partnerSiteCategoryHubPath(slug)
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
    cohortLogin: COHORT_LOGIN[locale],
    cohortLoginCta: COHORT_LOGIN_CTA[locale],
    cohortProfileLink: COHORT_PROFILE_LINK[locale],
    cohortProfileLead: COHORT_PROFILE_LEAD[locale],
    cohortPopular: COHORT_POPULAR[locale],
    cohortEdit: COHORT_EDIT[locale],
    recBadge: REC_BADGE[locale],
    recPersonalize: REC_PERSONALIZE[locale],
    recHelpTip: REC_HELP_TIP[locale],
    recHelpAria: REC_HELP_ARIA[locale],
    recPickerLead: REC_PICKER_LEAD[locale],
    recPickerAll: REC_PICKER_ALL[locale],
    recPickerError: REC_PICKER_ERROR[locale],
    recSold: REC_SOLD[locale],
    expectedSave: partnerSiteSaleCopy(locale).expectedSave,
    save: partnerSiteSaleCopy(locale).save,
    startsAfter: partnerSiteSaleCopy(locale).startsAfter,
    remaining: partnerSiteSaleCopy(locale).remaining,
  }

  return `<script data-pw-personalization-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var API=${JSON.stringify(apiBase)};
var SITE_SLUG=${JSON.stringify(slug)};
var PRODUCTS_PATH=${JSON.stringify(productsPath)};
var VIEWED_PATH=${JSON.stringify(viewedPath)};
var LOGIN_PATH=${JSON.stringify(loginPath)};
var PROFILE_PATH=${JSON.stringify(profilePath)};
var HELP_PATH=${JSON.stringify(helpPath)};
var HUB_PATH=${JSON.stringify(hubPath)};
var COPY=${JSON.stringify(copy)};
var FEATURED_LIMIT=${FEATURED_CATEGORY_TILE_DEFAULT};
${PW_FEATURED_MARQUEE_JS}
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
function money(n){var v=Math.max(0,Math.round(Number(n)||0));try{return new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(v);}catch(e){return v.toLocaleString()+'₫';}}
${PW_SITE_SALE_VIEW_JS}
function priceHtml(p){
  var sale=saleView(p);
  if(!sale)return (p.price_hint||p.priceHint||'').replace(/</g,'&lt;');
  if(sale.kind==='teaser'){
    return '<span class="pw-price-sale">'+sale.price+'</span> <span class="pw-price-expected">→ '+sale.expected+'</span><small class="pw-price-teaser">'+(COPY.expectedSave||'').replace('{pct}',String(sale.percent)).replace('{amount}',sale.savings)+'</small>';
  }
  return '<span class="pw-price-sale">'+sale.price+'</span> <del class="pw-price-compare">'+sale.compare+'</del>'+(sale.savings?'<small class="pw-price-save">'+(COPY.save||'').replace('{amount}',sale.savings)+'</small>':'');
}
function saleBadgeHtml(sale,badge){
  if(sale&&sale.badge){
    var chip=sale.countdown?'<span class="pw-sale-chip pw-sale-chip-'+sale.kind+'" data-pw-sale-countdown="'+String(sale.countdown).replace(/"/g,'')+'" data-pw-sale-phase="'+sale.kind+'">'+(sale.kind==='active'?COPY.remaining:COPY.startsAfter)+' <span data-pw-sale-hms></span></span>':'';
    return '<span class="pw-badge-sale pw-badge-sale-'+sale.kind+'">'+sale.badge+'</span>'+chip;
  }
  return badge?'<span class="pw-for-you-badge">'+COPY.forYou+'</span>':'';
}
function recHeartSvg(){
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
}
function renderRecommendedCard(p,badge){
  var href=p.detail_path||p.product_url||'#';
  var name=(p.name||'').replace(/"/g,'&quot;');
  var id=(p.inventory_id||'').replace(/"/g,'');
  var img=shopImg(p).replace(/"/g,'&quot;');
  var sale=saleView(p);
  var mark=saleBadgeHtml(sale,false);
  if(badge)mark='<span class="pw-rec-badge">'+COPY.recBadge+'</span>'+mark;
  var price=priceHtml(p);
  var rating=Number(p.ratingScore!=null?p.ratingScore:p.rating_score);
  if(!isFinite(rating))rating=0;
  var sold=Math.max(0,Math.round(Number(p.purchasesCount!=null?p.purchasesCount:p.purchases_count)||0));
  var fav='<button type="button" class="pw-rec-fav" data-pw-favorite data-inventory-id="'+id+'" aria-pressed="false" aria-label="'+COPY.favorite+'">'+recHeartSvg()+'</button>';
  return '<article class="pw-product-card pw-rec-card" data-pw-el="card" data-inventory-id="'+id+'" data-pw-actions-ready="1"><a class="pw-product-card-media" data-pw-el="card-media" href="'+href+'">'+mark+'<img src="'+img+'" alt="'+name+'" loading="lazy"/></a>'+fav+'<div class="pw-product-card-body"><h3 data-pw-el="card-name"><a href="'+href+'">'+name+'</a></h3>'+(price?'<p class="pw-price" data-pw-el="card-price">'+price+'</p>':'')+'<div class="pw-rec-stats"><span>★ '+rating.toFixed(1)+'</span><span>'+COPY.recSold+': '+sold+'</span></div></div></article>';
}
function renderCard(p,cta,badge,recommended){
  if(recommended)return renderRecommendedCard(p,badge);
  var href=p.detail_path||p.product_url||'#';
  var name=(p.name||'').replace(/"/g,'&quot;');
  var id=(p.inventory_id||'').replace(/"/g,'');
  var img=shopImg(p).replace(/"/g,'&quot;');
  var sale=saleView(p);
  var mark=saleBadgeHtml(sale,badge);
  var price=priceHtml(p);
  var cart=id
    ? '<button type="button" class="pw-btn pw-btn-cart" data-pw-el="card-cart" data-pw-add-cart data-inventory-id="'+id+'">'+COPY.addToCart+'</button>'
    : '<a class="pw-btn pw-btn-cart" data-pw-el="card-cart" href="'+href+'">'+(cta||COPY.viewCta)+'</a>';
  return '<article class="pw-product-card" data-pw-el="card" data-inventory-id="'+id+'" data-pw-actions-ready="1"><a class="pw-product-card-media" data-pw-el="card-media" href="'+href+'">'+mark+'<img src="'+img+'" alt="'+name+'" loading="lazy"/></a><div class="pw-product-card-body"><h3 data-pw-el="card-name"><a href="'+href+'">'+name+'</a></h3>'+(price?'<p class="pw-price" data-pw-el="card-price">'+price+'</p>':'')+'<div class="pw-shop-action-bar">'+cart+'</div></div></article>';
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
  if(el.getAttribute('data-pw-personalize')==='recommended'){
    if(see)see.hidden=true;
    return more;
  }
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
  var q='?limit='+limit+'&offset='+offset;
  if(kind==='recommended'){
    var st=el._pwGrid;
    if(st&&st.seed!=null)q+='&seed='+st.seed;
    if(offset>0)q+='&sameShopOnly=1';
  }
  return base+q;
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
  var scope=featuredSourceGrid(el)||el;
  var names=scope.querySelectorAll('[data-pw-edit^="categoryName"],[data-pw-el="card-name"]');
  var cards=[],i,card;
  for(i=0;i<names.length;i++){
    card=names[i].closest('[data-pw-el="card"],a,article');
    if(!card||cards.indexOf(card)>=0)continue;
    if(card.closest&&card.closest('[data-pw-featured-clone]'))continue;
    cards.push(card);
  }
  if(cards.length)return cards;
  var nodes=scope.querySelectorAll('[data-pw-el="card"],.pw-cat-card,.pw-featured-cat-card');
  for(i=0;i<nodes.length;i++){
    if(nodes[i].closest&&nodes[i].closest('[data-pw-featured-clone]'))continue;
    cards.push(nodes[i]);
  }
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
function featuredLiveSignature(el){
  var cards=featuredCards(el),out=[],i;
  for(i=0;i<cards.length;i++){
    if(cards[i].hidden)continue;
    var nameEl=cards[i].querySelector('[data-pw-el="card-name"],[data-pw-edit^="categoryName"]');
    out.push(String(nameEl?nameEl.textContent:'').replace(/\\s+/g,' ').trim()+'|'+(cards[i].getAttribute('href')||''));
  }
  return out.join('\\n');
}
function tilesSignature(tiles){
  var out=[],i;
  for(i=0;i<(tiles||[]).length;i++){
    var t=tiles[i];
    out.push(String((t&&(t.short_name||t.name))||'').trim()+'|'+String((t&&t.href)||''));
  }
  return out.join('\\n');
}
function hydrateFeatured(el){
  var featuredCat=el.classList.contains('pw-featured-cat');
  var grid=featuredSourceGrid(el);
  var empty=el.querySelector('.pw-featured-cat-empty,.pw-personalize-empty');
  var see=el.querySelector('[data-pw-el="section-more"]');
  var circles=!featuredCat&&(el.classList.contains('pw-categories')||!!el.querySelector('.pw-cat-grid,.pw-cat-card,[data-pw-edit^="categoryName"]'));
  var cardsNow=featuredCards(el);
  var keepCards=!featuredCat&&cardsNow.length>0;
  var limit=keepCards?cardsNow.length:(typeof pwGridPageSize==='function'?pwGridPageSize(el):FEATURED_LIMIT);
  if(featuredCat){
    var attrLimit=parseInt(el.getAttribute('data-limit')||'',10);
    limit=Math.max(FEATURED_LIMIT,attrLimit>0?attrLimit:0,cardsNow.length);
  }
  if(limit<4)limit=4;
  if(featuredCat)ensureFeaturedMarquee(el);
  apiFetch('/featured-categories?limit='+limit).then(function(res){
    var tiles=(res.j&&res.j.tiles)||[];
    if(res.j&&res.j.hub_href&&see)see.setAttribute('href',res.j.hub_href);
    if(see&&!see.textContent)see.textContent=COPY.featuredSeeAll;
    if(!tiles.length){
      if(empty){empty.hidden=false;empty.textContent=COPY.featuredEmpty;}
      el.hidden=false;return;
    }
    if(el.getAttribute('data-pw-featured-live')==='1'&&featuredLiveSignature(el)===tilesSignature(tiles)){
      if(empty)empty.hidden=true;
      el.hidden=false;
      return;
    }
    if(featuredCat&&grid)grid.innerHTML=tiles.map(function(t){return renderFeaturedTile(t,false);}).join('');
    else if(keepCards)paintFeaturedCards(el,tiles);
    else if(grid)grid.innerHTML=tiles.map(function(t){return renderFeaturedTile(t,circles);}).join('');
    if(empty)empty.hidden=true;
    el.setAttribute('data-pw-featured-live','1');
    el.hidden=false;
    if(featuredCat)ensureFeaturedMarquee(el,true);
  }).catch(function(){
    if(empty){empty.hidden=false;empty.textContent=COPY.featuredEmpty;}
    el.hidden=false;
    if(featuredCat)ensureFeaturedMarquee(el);
  });
}
function recInterestKey(){return 'pw-guest-category-interest:'+SITE_SLUG;}
function readRecInterest(){
  try{var raw=localStorage.getItem(recInterestKey());if(!raw)return null;var j=JSON.parse(raw);return j&&j.path?j:null;}catch(e){return null;}
}
function saveRecInterest(path,name){
  try{localStorage.setItem(recInterestKey(),JSON.stringify({path:path,name:name||'',savedAt:Date.now()}));}catch(e){}
}
function ensureRecHead(el){
  var host=el.querySelector('.pw-container')||el;
  var title=host.querySelector('[data-pw-el="section-title"],h2');
  if(title)title.classList.add('pw-rec-title');
  var head=host.querySelector('[data-pw-rec-head]');
  if(!head){
    head=document.createElement('div');
    head.className='pw-rec-head';
    head.setAttribute('data-pw-rec-head','1');
    if(title&&title.parentNode){
      title.parentNode.insertBefore(head,title);
      var row=document.createElement('div');
      row.className='pw-rec-head-row';
      row.appendChild(title);
      head.appendChild(row);
    }else host.insertBefore(head,host.firstChild);
  }
  var rowEl=head.querySelector('.pw-rec-head-row');
  if(!rowEl){
    rowEl=document.createElement('div');
    rowEl.className='pw-rec-head-row';
    if(title)rowEl.appendChild(title);
    head.appendChild(rowEl);
  }
  return {host:host,head:head,row:rowEl,title:title};
}
function paintCohortHint(el,mode,loggedIn,hasProducts,guestWithoutSignal){
  if(el.getAttribute('data-pw-personalize')!=='recommended')return;
  var parts=ensureRecHead(el);
  var row=parts.row;
  var host=parts.host;
  var actions=row.querySelector('[data-pw-rec-actions]');
  if(!actions){
    actions=document.createElement('div');
    actions.className='pw-rec-actions';
    actions.setAttribute('data-pw-rec-actions','1');
    row.appendChild(actions);
  }
  var showHelp=mode!=null;
  var showEdit=!!loggedIn&&!!hasProducts&&mode!=='profile_incomplete'&&mode!=='requires_login';
  actions.hidden=!(showHelp||showEdit);
  if(showHelp||showEdit){
    var helpHtml='<span class="pw-rec-help-sep" aria-hidden="true"></span><span class="pw-rec-help-wrap"><a class="pw-rec-help" href="'+HELP_PATH+'" aria-label="'+COPY.recHelpAria+'">?</a><span class="pw-rec-help-tip" role="tooltip">'+COPY.recHelpTip+'</span></span>';
    actions.innerHTML=(showEdit
      ? '<a class="pw-rec-edit" href="'+PROFILE_PATH+'">'+COPY.cohortEdit+'</a>'
      : '<span class="pw-rec-personalize-label">'+COPY.recPersonalize+'</span>')+helpHtml;
  }
  var hint=host.querySelector('[data-pw-cohort-hint]');
  if(!hint){
    hint=document.createElement('p');
    hint.className='pw-cohort-hint';
    hint.setAttribute('data-pw-cohort-hint','1');
    if(parts.head&&parts.head.parentNode)parts.head.parentNode.insertBefore(hint,parts.head.nextSibling);
    else host.insertBefore(hint,host.firstChild);
  }
  hint.hidden=true;
  hint.innerHTML='';
  if(guestWithoutSignal)return;
  if(mode==='requires_login'){
    hint.innerHTML='<span class="pw-cohort-hint-row"><span>'+COPY.cohortLogin+'</span> <a class="pw-cohort-hint-cta" href="'+LOGIN_PATH+'">'+COPY.cohortLoginCta+'</a></span>';
    hint.hidden=false;
  }else if(mode==='profile_incomplete'){
    hint.innerHTML='<a class="pw-cohort-hint-link" href="'+PROFILE_PATH+'">'+COPY.cohortProfileLink+'</a> '+COPY.cohortProfileLead;
    hint.hidden=false;
  }else if(mode==='popular_fallback'&&!loggedIn){
    hint.innerHTML='<span class="pw-cohort-hint-row"><span>'+COPY.cohortPopular+'</span> <a class="pw-cohort-hint-cta" href="'+LOGIN_PATH+'">'+COPY.cohortLoginCta+'</a></span>';
    hint.hidden=false;
  }
}
function paintGuestPicker(el,show){
  var host=el.querySelector('.pw-container')||el;
  var grid=el.querySelector('[data-pw-grid]');
  var empty=el.querySelector('.pw-personalize-empty');
  var picker=host.querySelector('[data-pw-rec-picker]');
  if(!show){
    if(picker)picker.hidden=true;
    if(grid)grid.hidden=false;
    return;
  }
  if(grid)grid.hidden=true;
  if(empty)empty.hidden=true;
  if(!picker){
    picker=document.createElement('div');
    picker.className='pw-rec-picker';
    picker.setAttribute('data-pw-rec-picker','1');
    if(grid&&grid.parentNode)grid.parentNode.insertBefore(picker,grid);
    else host.appendChild(picker);
  }
  picker.hidden=false;
  picker.innerHTML='<p class="pw-rec-picker-lead">'+COPY.recPickerLead+'</p><div class="pw-rec-picker-chips" data-pw-rec-picker-chips="1"></div>';
  apiFetch('/featured-categories?limit=80').then(function(res){
    var tiles=(res.j&&res.j.tiles)||[];
    var hub=(res.j&&res.j.hub_href)||HUB_PATH;
    var level2=[];
    var i;
    for(i=0;i<tiles.length;i++){
      if(Number(tiles[i].level)===2&&Number(tiles[i].product_count)>0)level2.push(tiles[i]);
    }
    level2.sort(function(a,b){return (b.product_count||0)-(a.product_count||0);});
    var pick=level2.slice(0,10);
    if(!pick.length){
      pick=tiles.filter(function(t){return Number(t.product_count)>0;}).slice(0,10);
    }
    var chips=picker.querySelector('[data-pw-rec-picker-chips]');
    if(!chips)return;
    if(!pick.length){
      chips.innerHTML='<a class="pw-rec-picker-chip" href="'+hub+'">'+COPY.featuredSeeAll+'</a>';
      return;
    }
    var html='';
    for(i=0;i<pick.length;i++){
      var t=pick[i];
      var href=t.href||'#';
      var name=t.short_name||t.name||'';
      var count=Number(t.product_count)||0;
      html+='<a class="pw-rec-picker-chip" data-pw-rec-pick="1" href="'+href+'" data-name="'+(name||'').replace(/"/g,'&quot;')+'">'+name+(count?'<span class="pw-rec-picker-count">'+count+'</span>':'')+'</a>';
    }
    html+='<a class="pw-rec-picker-all" href="'+hub+'">'+COPY.recPickerAll+'</a>';
    chips.innerHTML=html;
  }).catch(function(){
    var chips=picker.querySelector('[data-pw-rec-picker-chips]');
    if(chips)chips.innerHTML='<span>'+COPY.recPickerError+'</span> <a class="pw-rec-picker-all" href="'+HUB_PATH+'">'+COPY.featuredSeeAll+'</a>';
  });
}
function loadPersonalizePage(el,append){
  var kind=el.getAttribute('data-pw-personalize');if(!kind||kind==='featured-categories')return;
  var st=el._pwGrid;if(!st||st.loading)return;
  var cta=el.getAttribute('data-cta')||COPY.viewCta;
  var grid=el.querySelector('[data-pw-grid]');var empty=el.querySelector('.pw-personalize-empty');
  var recommended=kind==='recommended';
  var reqOffset=recommended&&append?(st.shopOffset||st.offset):st.offset;
  st.loading=true;
  apiFetch(personalizePath(el,reqOffset,st.pageSize)).then(function(res){
    st.loading=false;
    var products=(res.j&&res.j.products)||[];
    var badges={};
    (res.j&&res.j.cohort_badge_product_ids||[]).forEach(function(id){badges[String(id).toLowerCase()]=1;});
    var loggedIn=!!(res.j&&res.j.logged_in);
    var mode=res.j&&res.j.cohort_mode;
    var guestWithoutSignal=recommended&&!loggedIn&&mode==='popular_fallback';
    if(!append)paintCohortHint(el,mode,loggedIn,products.length>0,guestWithoutSignal);
    if(guestWithoutSignal&&!append){
      var interest=readRecInterest();
      if(interest&&interest.path){
        location.replace(interest.path);
        return;
      }
      paintGuestPicker(el,true);
      st.hasMore=false;paintMore(el);el.hidden=false;return;
    }
    if(!append)paintGuestPicker(el,false);
    if(!products.length){
      if(!append){
        if(empty){empty.hidden=false;empty.textContent=COPY.empty;}
        if(grid&&!grid.querySelector('[data-pw-grid-placeholder]'))grid.innerHTML='';
      }
      st.hasMore=false;paintMore(el);el.hidden=false;return;
    }
    var html=products.map(function(p){return renderCard(p,cta,!!badges[String(p.inventory_id||'').toLowerCase()],recommended);}).join('');
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
    if(recommended){
      if(res.j&&res.j.same_shop_seed!=null)st.seed=res.j.same_shop_seed;
      var used=Number(res.j&&res.j.same_shop_used);
      if(!Number.isFinite(used)||used<0)used=products.length;
      st.shopOffset=append?(st.shopOffset||0)+used:used;
    }
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
${PW_SITE_SALE_TICK_CHIPS_JS}
function tickSaleChips(){
  pwSaleTickChips(COPY.remaining,COPY.startsAfter);
}
function run(){
  if(!document.getElementById('pw-site-sale-css')){var st=document.createElement('style');st.id='pw-site-sale-css';st.textContent=${JSON.stringify(PW_SITE_SALE_CARD_CSS)};document.head.appendChild(st);}
  tickSaleChips();
  if(!window.__pwSaleChipTimer)window.__pwSaleChipTimer=setInterval(tickSaleChips,1000);
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
      if(!editor&&el.getAttribute('data-pw-featured-live')==='1'){
        if(el.classList.contains('pw-featured-cat'))ensureFeaturedMarquee(el);
        return;
      }
      hydrateFeatured(el);
    }
  });
  try{pwEnsureFeaturedMarquees();}catch(eFeatMqRun){}
  if(!document.documentElement.getAttribute('data-pw-personalize-more-bound')){
    document.documentElement.setAttribute('data-pw-personalize-more-bound','1');
    document.addEventListener('click',function(ev){
      var t=ev.target;if(!t||!t.closest)return;
      var pick=t.closest('[data-pw-rec-pick]');
      if(pick){
        saveRecInterest(pick.getAttribute('href')||'',pick.getAttribute('data-name')||'');
        return;
      }
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
