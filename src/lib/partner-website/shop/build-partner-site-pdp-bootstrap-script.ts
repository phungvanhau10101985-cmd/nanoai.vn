import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteLoginPath, partnerSiteProductApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  PW_SHOP_CARD_IMG_JS,
  PW_SHOP_HIDE_BROKEN_PDP_IMGS_JS,
  PW_SHOP_PDP_PAGE_SRC_JS,
} from '@/lib/partner-website/shop/inventory-shop-detail'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import { PW_SITE_SALE_CARD_CSS, PW_SITE_SALE_VIEW_JS, partnerSiteSaleCopy } from '@/lib/partner-website/promotions/partner-site-sale-display'

/**
 * Live PDP fields on the shared visual shell. Sửa nhanh strips this script;
 * public pages also get a server bind — this keeps inventory current after load.
 * Reviews / Q&A / size-color hydrate from `/api/site/{slug}/products/{id}/*`.
 */
export function buildPartnerSitePdpBootstrapScript(input: { siteSlug: string; locale?: WebLocale }): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const locale: WebLocale = input.locale || 'vi'
  const t = getPartnerSiteShopCopy(locale)
  const apiPrefix = partnerSiteProductApiPath(slug, '__ID__').replace('__ID__', '')
  const eventsApi = `/api/site/${encodeURIComponent(slug)}/personalization/events`
  const loginPath = partnerSiteLoginPath(slug)
  const saleCopy = partnerSiteSaleCopy(locale)
  const copy = {
    locale,
    expectedPrice: saleCopy.expectedPrice,
    expectedSave: saleCopy.expectedSave,
    teaserSave: saleCopy.teaserSave,
    save: saleCopy.save,
    flashName: saleCopy.flashName,
    clearanceName: saleCopy.clearanceName,
    currentPrice: saleCopy.currentPrice,
    countdownStarts: saleCopy.countdownStarts,
    countdownLeft: saleCopy.countdownLeft,
    flashRemaining: saleCopy.flashRemaining,
    teaserFallback: saleCopy.teaserFallback,
    activeFallback: saleCopy.activeFallback,
    birthdayCheckoutHint: saleCopy.birthdayCheckoutHint,
    birthdaySave: saleCopy.birthdaySave,
    birthdayEndsAfter: saleCopy.birthdayEndsAfter,
    sizeLabel: t.sizeLabel,
    colorLabel: t.colorLabel,
    pdpBrandLabel: t.pdpBrandLabel,
    pdpPurchasesLabel: t.pdpPurchasesLabel,
    pdpLikesLabel: t.pdpLikesLabel,
    pdpRatingLabel: t.pdpRatingLabel,
    pdpRatingCountSuffix: t.pdpRatingCountSuffix,
    pdpJumpReviews: t.pdpJumpReviews,
    pdpJumpQa: t.pdpJumpQa,
    reviewsTitle: t.reviewsTitle,
    reviewsTotalSuffix: t.reviewsTotalSuffix,
    reviewsWriteButton: t.reviewsWriteButton,
    reviewsFormRatingLabel: t.reviewsFormRatingLabel,
    reviewsFormContentPlaceholder: t.reviewsFormContentPlaceholder,
    reviewsFormSubmit: t.reviewsFormSubmit,
    reviewsSubmitSuccess: t.reviewsSubmitSuccess,
    reviewsSubmitLoginRequired: t.reviewsSubmitLoginRequired,
    reviewsSubmitAlreadyReviewed: t.reviewsSubmitAlreadyReviewed,
    reviewsSubmitNotEligible: t.reviewsSubmitNotEligible,
    reviewsEmpty: t.reviewsEmpty,
    reviewsLoadMore: t.reviewsLoadMore,
    reviewsUsefulLabel: t.reviewsUsefulLabel,
    reviewsMerchantReplyPrefix: t.reviewsMerchantReplyPrefix,
    qaTitle: t.qaTitle,
    qaAskButton: t.qaAskButton,
    qaFormPlaceholder: t.qaFormPlaceholder,
    qaFormSubmit: t.qaFormSubmit,
    qaSubmitSuccess: t.qaSubmitSuccess,
    qaSubmitLoginRequired: t.qaSubmitLoginRequired,
    qaEmpty: t.qaEmpty,
    qaLoadMore: t.qaLoadMore,
    qaAnswerButton: t.qaAnswerButton,
    qaAnswerFormPlaceholder: t.qaAnswerFormPlaceholder,
    qaAnswerSubmit: t.qaAnswerSubmit,
    qaAnswerNotEligible: t.qaAnswerNotEligible,
    qaAnswerSlotFull: t.qaAnswerSlotFull,
    qaVerifiedBadge: t.qaVerifiedBadge,
    qaAdminBadge: t.qaAdminBadge,
    qaNoAnswersYet: t.qaNoAnswersYet,
    reviewsFromCustomers: t.reviewsFromCustomers,
    reviewsSeeAll: t.reviewsSeeAll,
    reviewsSeeMore: t.reviewsSeeMore,
    reviewsHelpfulCount: t.reviewsHelpfulCount,
    qaSeeMore: t.qaSeeMore,
    qaCountSuffix: t.qaCountSuffix,
    qaAskedPrefix: t.qaAskedPrefix,
    qaReplyBuyerOnly: t.qaReplyBuyerOnly,
    qaModalTitle: t.qaModalTitle,
    qaLoginToAsk: t.qaLoginToAsk,
    qaBuyerReplied: t.qaBuyerReplied,
    reviewsStarLabel1: t.reviewsStarLabel1,
    reviewsStarLabel2: t.reviewsStarLabel2,
    reviewsStarLabel3: t.reviewsStarLabel3,
    reviewsStarLabel4: t.reviewsStarLabel4,
    reviewsStarLabel5: t.reviewsStarLabel5,
  }

  return `<script data-pw-pdp-bootstrap>(function(){
if(!document.getElementById('pw-site-sale-css')){var st=document.createElement('style');st.id='pw-site-sale-css';st.textContent=${JSON.stringify(PW_SITE_SALE_CARD_CSS)};document.head.appendChild(st);}
${PW_SHOP_LIVE_UI_OFF_FN};
if(pwShopLiveUiOff())return;
if(!document.querySelector('[data-pw-region="pdp-info"],[data-pw-region="gallery"],.pw-pdp'))return;
${PW_SHOP_CARD_IMG_JS};
${PW_SHOP_PDP_PAGE_SRC_JS};
${PW_SHOP_HIDE_BROKEN_PDP_IMGS_JS};
hideBrokenPdpImgs();
var API_PREFIX=${JSON.stringify(apiPrefix)};
var EVENTS_API=${JSON.stringify(eventsApi)};
var LOGIN_PATH=${JSON.stringify(loginPath)};
var COPY=${JSON.stringify(copy)};
var catalogReviewTotal=0,catalogReviewScore=0,catalogQaTotal=0;
var REVIEW_PAGE_SIZE=20,SUMMARY_PAGE_SIZE=1;
var SESSION_KEY='app_guest_session_id';
var SESSION_KEY_LEGACY='nanoai_guest_session_id';
var SESSION_HDR='x-guest-session-id';
var ACCOUNT_KEY='app_guest_account_id';
var ACCOUNT_KEY_LEGACY='nanoai_guest_account_id';
var ACCOUNT_HDR='x-guest-account-id';
function readCookie(n){var p=document.cookie.split(';');for(var i=0;i<p.length;i++){var x=p[i].trim().split('=');if(x[0]===n)return decodeURIComponent(x.slice(1).join('=')||'');}return '';}
function sessionId(){try{var ls=localStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY_LEGACY)||'';if(ls)return ls;}catch(e){}return readCookie('app_guest_session_sync');}
function accountId(){try{var ls=localStorage.getItem(ACCOUNT_KEY)||localStorage.getItem(ACCOUNT_KEY_LEGACY)||'';if(ls)return ls;}catch(e){}return readCookie('app_guest_account_sync')||readCookie(ACCOUNT_KEY);}
function authHeaders(){var h={'Content-Type':'application/json'};var s=sessionId(),a=accountId();if(s)h[SESSION_HDR]=s;if(a)h[ACCOUNT_HDR]=a;return h;}
function captureSession(res){
  var sid=res.headers.get(SESSION_HDR);if(sid){try{localStorage.setItem(SESSION_KEY,sid);localStorage.setItem(SESSION_KEY_LEGACY,sid);}catch(e){}}
  var aid=res.headers.get(ACCOUNT_HDR);if(aid){try{localStorage.setItem(ACCOUNT_KEY,aid);localStorage.setItem(ACCOUNT_KEY_LEGACY,aid);}catch(e){}}
}
function apiFetch(url,opts){
  opts=opts||{};opts.credentials='same-origin';
  opts.headers=Object.assign({},authHeaders(),opts.headers||{});
  return fetch(url,opts).then(function(r){captureSession(r);return r.json().then(function(j){return {ok:r.ok,status:r.status,j:j};}).catch(function(){return {ok:r.ok,status:r.status,j:{}};});});
}
function trackView(id){
  if(!id)return;
  apiFetch(EVENTS_API,{method:'POST',body:JSON.stringify({event:'view_product',inventory_id:id})}).then(function(res){
    if(res&&res.ok){try{document.dispatchEvent(new Event('pw-recently-viewed-updated'));}catch(e){}}
  }).catch(function(){});
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function money(n){var v=Math.max(0,Math.round(Number(n)||0));try{return new Intl.NumberFormat(COPY.locale==='vi'?'vi-VN':COPY.locale,{style:'currency',currency:'VND',maximumFractionDigits:0}).format(v);}catch(e){return v.toLocaleString()+'₫';}}
function pdpBirthdayCount(iso){
  if(!iso)return '';
  var t=Date.parse(iso);if(!Number.isFinite(t))return '';
  var d=t-Date.now();if(d<=0)return '';
  var s=Math.floor(d/1000),days=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=s%60;
  var hms=('0'+h).slice(-2)+':'+('0'+m).slice(-2)+':'+('0'+sec).slice(-2);
  return days>0?days+'d '+hms:hms;
}
function paintPdpBirthday(p){
  var card=document.querySelector('.pw-pdp-price-card');
  if(!card||!p)return;
  var slot=card.querySelector('[data-pw-pdp-slot="birthday"]');
  var offer=p.birthdayOffer||window.__pwBirthdayOffer||null;
  var pct=Math.max(0,Math.round(Number(p.birthdayOfferPercent||(offer&&offer.percent)||0)||0));
  var ends=String(p.birthdayOfferEndsAt||(offer&&(offer.countdownTo||offer.endsAt))||'').trim();
  if(p.isClearance===true||!(pct>0)){if(slot)slot.remove();return;}
  var sale=saleView(p);
  var list=Math.max(0,Math.round(Number(p.priceAmount)||0));
  if(!(list>0))list=Math.max(0,Math.round(Number(String(p.priceHint||'').replace(/[^\\d]/g,''))||0));
  var charged=sale&&sale.kind==='active'&&Number(p.salePriceAmount)>0?Math.round(Number(p.salePriceAmount)):list;
  var requested=Math.round(charged*pct/100);
  var cap=Math.round((list||charged)*15/100);
  var lineSave=Math.max(0,(list||charged)-charged);
  var saveAmt=Math.max(0,Math.min(requested,Math.max(0,cap-lineSave)));
  var hint=String(COPY.birthdayCheckoutHint||'').replace('{pct}',String(pct));
  var save=saveAmt?String(COPY.birthdaySave||'').replace('{amount}',money(saveAmt)):'';
  var count=pdpBirthdayCount(ends);
  if(!slot){
    slot=document.createElement('p');
    slot.className='pw-pdp-birthday-hint';
    slot.setAttribute('data-pw-pdp-slot','birthday');
    card.appendChild(slot);
  }
  slot.style.display='';
  slot.innerHTML=(hint?'<span>'+esc(hint)+'</span>':'')+(save?'<span>'+esc(save)+'</span>':'')
    +(count?'<span class="pw-pdp-birthday-count" data-pw-sale-countdown="'+esc(ends)+'" data-pw-sale-phase="active" data-pw-sale-kind="birthday">⏱ '+esc(COPY.birthdayEndsAfter||'')+' <strong data-pw-sale-hms>'+esc(count)+'</strong></span>':'');
}
${PW_SITE_SALE_VIEW_JS}
function productId(){
  var host=document.querySelector('[data-pw-region="pdp-info"],[data-pw-region="gallery"],.pw-pdp,[data-pw-page="product"]');
  var id=(host&&(host.getAttribute('data-inventory-id')||host.getAttribute('data-pw-inventory-id')))||'';
  if(id)return id.trim();
  var m=String(location.pathname||'').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m?m[0]:'';
}
function setText(el,text){if(el)el.textContent=text;}
function stampId(el,id){if(el&&el.setAttribute)el.setAttribute('data-inventory-id',id);}
function goLogin(hash){
  var loc=location.pathname+(location.search||'')+(hash||location.hash||'');
  location.href=LOGIN_PATH+'?redirect='+encodeURIComponent(loc);
}
function imagesOf(p){
  var out=[],seen={};
  ;(p.galleryImages||[]).concat(p.imageUrl||'').forEach(function(url){
    var u=String(url||'').trim();
    if(!u||seen[u])return;
    seen[u]=1;out.push(u);
  });
  return out;
}
function isTryOnVideo(u){return /\\.(mp4|webm|mov)(\\?|#|$)/i.test(String(u||''));}
function stampProductGatewayEl(el,main,second,sku,id,tryOn){
  if(main)el.setAttribute('data-nanoai-image',main);
  if(second)el.setAttribute('data-nanoai-image-2',second);
  if(sku)el.setAttribute('data-nanoai-sku',sku);
  if(id)el.setAttribute('data-nanoai-inventory',id);
  if(tryOn){
    if(!el.hasAttribute('data-nanoai-try-on'))el.setAttribute('data-nanoai-try-on','');
  }else if(!el.hasAttribute('data-nanoai-consult')){
    el.setAttribute('data-nanoai-consult','');
  }
}
function stampTryOnButtons(p){
  var imgs=imagesOf(p);
  var main='',second='';
  for(var i=0;i<imgs.length;i++){
    if(isTryOnVideo(imgs[i]))continue;
    if(!main){main=imgs[i];continue;}
    if(!second){second=imgs[i];break;}
  }
  var live=document.querySelector('[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img');
  var liveSrc=pdpImgFullSrc(live);
  if(liveSrc&&!isTryOnVideo(liveSrc))main=shopPdpOrigSrc(liveSrc);
  var sku=String(p.sku||'').trim();
  var id=String(p.id||'').trim();
  document.querySelectorAll('[data-nanoai-try-on],[data-pw-chrome-btn="try-on"]').forEach(function(el){
    stampProductGatewayEl(el,main,second,sku,id,true);
  });
  document.querySelectorAll('[data-nanoai-open-chat],[data-pw-chrome-btn="chat"]').forEach(function(el){
    if(el.closest&&el.closest('[data-pw-chrome-btn="chat-zalo"],[data-pw-chrome-btn="chat-facebook"]'))return;
    stampProductGatewayEl(el,main,second,sku,id,false);
  });
}
function apply(p){
  var id=String(p.id||'').trim();
  if(!id)return;
  stampId(document.body,id);
  document.querySelectorAll('[data-pw-region="pdp-info"],[data-pw-region="gallery"],.pw-pdp,.pw-pdp-sticky,[data-pw-pdp-favorite],[data-pw-pdp-add-cart],[data-pw-pdp-buy-now]').forEach(function(el){stampId(el,id);});
  var name=String(p.name||'Product');
  document.querySelectorAll('[data-pw-region="pdp-info"] [data-pw-el="title"],.pw-pdp-title').forEach(function(el){setText(el,name);});
  var sku=String(p.sku||'').trim();
  if(sku){
    document.querySelectorAll('[data-pw-region="pdp-info"] [data-pw-el="sku"],.pw-pdp-sku strong').forEach(function(el){setText(el,sku);});
  }
  var brand=String(p.brandName||'').trim();
  document.querySelectorAll('[data-pw-pdp-slot="brand"]').forEach(function(el){
    if(!brand){el.style.display='none';return;}
    el.style.display='';
    setText(el,(COPY.pdpBrandLabel||'')+': '+brand);
  });
  var desc=String(p.detailDescription||p.description||'').trim();
  if(desc)document.querySelectorAll('.pw-shop-product-detail-body[data-pw-el="desc"],[data-pw-pdp-tabpanel="description"] [data-pw-el="desc"]').forEach(function(el){
    if(/<[a-z][\s\S]*>/i.test(desc))el.innerHTML=typeof rewritePdpHtmlString==='function'?rewritePdpHtmlString(desc):desc;
    else setText(el,desc);
    rewriteDescImgs(el);
  });
  var sale=saleView(p);
  var price=sale?sale.price:String(p.priceHint||'').trim();
  if(price)document.querySelectorAll('[data-pw-region="pdp-info"] [data-pw-el="price"]').forEach(function(el){
    var compare=el.querySelector('[data-pw-el="compare-price"]');
    if(compare){
      el.childNodes.forEach(function(n){if(n.nodeType===3)n.textContent='';});
      el.insertBefore(document.createTextNode(price),el.firstChild);
      if(sale&&sale.kind==='teaser'){
        compare.textContent='→ '+(sale.expected||'');
        compare.style.display='';
        compare.classList.add('pw-price-expected');
      }else{
        compare.textContent=sale?sale.compare:'';
        compare.style.display=sale&&sale.compare?'':'none';
        compare.classList.remove('pw-price-expected');
      }
    }
    else setText(el,price);
  });
  document.querySelectorAll('[data-pw-pdp-slot="flash"]').forEach(function(el){
    if(!sale||!sale.badge){el.style.display='none';return;}
    el.style.display='';
    el.className=(el.className||'').replace(/pw-pdp-sale-pill\\S*/g,'');
    el.classList.add('pw-pdp-sale-pill','pw-pdp-sale-pill-'+(sale.kind||'active'));
    if(sale.promoKind)el.classList.add('pw-pdp-sale-pill-'+sale.promoKind);
    el.textContent=sale.badge;
  });
  var card=document.querySelector('.pw-pdp-price-card');
  var timer=card&&card.querySelector('[data-pw-pdp-slot="sale-timer"]');
  if(sale&&sale.countdown&&sale.promoKind!=='clearance'){
    var prefix=sale.promoKind==='flash'?String(COPY.flashRemaining||'')
      :String((sale.kind==='active'?COPY.countdownLeft:COPY.countdownStarts)||'').replace('{label}',sale.program||'');
    if(!timer&&card){
      timer=document.createElement('div');
      timer.setAttribute('data-pw-pdp-slot','sale-timer');
      var flashEl=card.querySelector('[data-pw-pdp-slot="flash"]');
      if(flashEl&&flashEl.nextSibling)card.insertBefore(timer,flashEl.nextSibling);
      else if(flashEl)card.appendChild(timer);
      else card.insertBefore(timer,card.firstChild);
    }
    if(timer){
      timer.style.display='';
      timer.className='pw-pdp-sale-timer pw-pdp-sale-timer-'+(sale.promoKind==='flash'?'flash':sale.kind);
      timer.setAttribute('data-pw-sale-countdown',sale.countdown);
      timer.setAttribute('data-pw-sale-phase',sale.kind||'');
      timer.setAttribute('data-pw-sale-kind',sale.promoKind||'');
      timer.setAttribute('data-pw-sale-label',sale.program||'');
      timer.innerHTML='⏱ '+esc(prefix)+' <span data-pw-sale-hms></span>';
    }
  }else if(timer){
    timer.style.display='none';
  }
  var kicker=card&&card.querySelector('[data-pw-pdp-slot="price-kicker"]');
  if(sale){
    if(!kicker&&card){
      kicker=document.createElement('p');
      kicker.className='pw-pdp-price-kicker';
      kicker.setAttribute('data-pw-pdp-slot','price-kicker');
      var after=timer||card.querySelector('[data-pw-pdp-slot="flash"]');
      if(after&&after.nextSibling)card.insertBefore(kicker,after.nextSibling);
      else if(after)card.appendChild(kicker);
      else card.insertBefore(kicker,card.firstChild);
    }
    if(kicker){
      kicker.style.display='';
      kicker.textContent=sale.kind==='teaser'?String(COPY.currentPrice||''):(sale.program||'');
    }
  }else if(kicker){
    kicker.style.display='none';
  }
  document.querySelectorAll('[data-pw-pdp-slot="savings"]').forEach(function(el){
    if(!sale){el.style.display='none';return;}
    el.style.display='';
    el.textContent=sale.kind==='teaser'
      ?(COPY.teaserSave||COPY.expectedSave||'').replace('{program}',sale.program||'').replace('{pct}',String(sale.percent)).replace('{amount}',sale.savings)
      :(COPY.save||'').replace('{program}',sale.program||'').replace('{amount}',sale.savings);
  });
  paintPdpBirthday(p);
  var imgs=imagesOf(p);
  var main=imgs[0]||'';
  if(main){
    document.querySelectorAll('[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img,[data-pw-region="gallery"] .pw-shop-product-img').forEach(function(img){
      if(!galleryFaceVisible(img))return;
      var page=shopPdpPageSrc(main);
      var full=shopPdpOrigSrc(main);
      img.setAttribute('src',page||main);
      if(full)img.setAttribute('data-pw-full-src',full);
      img.setAttribute('alt',name);
    });
  }
  document.querySelectorAll('[data-pw-region="gallery"] [data-pw-el="thumb"]').forEach(function(thumb,i){
    if(!galleryFaceVisible(thumb))return;
    var url=imgs[i];
    if(!url){thumb.hidden=true;thumb.style.display='none';return;}
    thumb.hidden=false;thumb.style.display='';
    var img=thumb.querySelector('img');
    if(img){
      img.setAttribute('src',shopPdpPageSrc(url)||url);
      img.setAttribute('data-pw-full-src',shopPdpOrigSrc(url));
      img.setAttribute('alt',name);
      if(!img.getAttribute('loading'))img.setAttribute('loading','lazy');
    }
  });
  var sold=Math.max(0,Math.round(Number(p.purchasesCount||0))||0);
  var likes=Math.max(0,Math.round(Number(p.likesCount||0))||0);
  var reviews=Math.max(0,Math.round(Number(p.reviewsCount||0))||0);
  var rating=Number(p.ratingScore||0);
  catalogReviewTotal=reviews;
  catalogReviewScore=isFinite(rating)?rating:0;
  catalogQaTotal=Math.max(0,Math.round(Number(p.questionsCount||0))||0);
  var ratingText=isFinite(rating)?Number(rating).toFixed(1):'0.0';
  var statsHtml='<span>🛒 '+esc(COPY.pdpPurchasesLabel)+': <strong>'+esc(String(sold))+'</strong></span>'+
    '<span>♥ '+esc(COPY.pdpLikesLabel)+': <strong data-pw-stat="likes">'+esc(String(likes))+'</strong></span>'+
    '<span><span class="pw-pdp-star">★</span> '+esc(COPY.pdpRatingLabel)+': <strong>'+esc(ratingText)+'/5</strong> ('+esc(String(reviews))+' '+esc(COPY.pdpRatingCountSuffix)+')</span>'+
    '<a href="#pw-pdp-reviews">'+esc(COPY.pdpJumpReviews)+'</a><a href="#pw-pdp-qa">'+esc(COPY.pdpJumpQa)+'</a>';
  document.querySelectorAll('[data-pw-pdp-slot="stats"],.pw-pdp-stats').forEach(function(el){el.innerHTML=statsHtml;});
  paintPdpLikeCounts(likes);
  stampTryOnButtons(p);
  hideBrokenPdpImgs();
}
function paintPdpLikeCounts(likes){
  var n=Math.max(0,Math.round(Number(likes)||0));
  document.querySelectorAll('[data-pw-like-count]').forEach(function(el){el.textContent=String(n);});
  document.querySelectorAll('[data-pw-stat="likes"]').forEach(function(el){el.textContent=String(n);});
  document.querySelectorAll('[data-pw-favorite],[data-pw-pdp-favorite],[data-pw-chrome-btn="favorite-product"]').forEach(function(btn){
    btn.setAttribute('data-pw-like-base',String(n));
    if(btn.querySelector&&btn.querySelector('[data-pw-like-count],svg,.pw-pdp-like-copy'))return;
    btn.textContent='♡ '+String(n);
  });
}
function ensureSection(sel,id,region,title,qa){
  var el=document.querySelector(sel);
  if(el){
    if(!el.id)el.id=id;
    if(qa)el.setAttribute('data-pw-pdp-slot','qa');
    return el;
  }
  el=document.createElement('section');
  el.id=id;
  el.className='pw-shop-reviews';
  el.setAttribute('data-pw-region',region);
  if(qa)el.setAttribute('data-pw-pdp-slot','qa');
  el.innerHTML='<h2 data-pw-el="section-title">'+esc(title)+'</h2>';
  var catalog=document.querySelector('[data-pw-region="catalog"]');
  var main=document.querySelector('main')||document.body;
  if(catalog&&catalog.parentNode)catalog.parentNode.insertBefore(el,catalog);
  else main.appendChild(el);
  return el;
}
function stars(n){
  var r=Math.max(0,Math.min(5,Math.round(Number(n)||0))),s='';
  for(var i=1;i<=5;i++)s+=i<=r?'★':'☆';
  return s;
}
function starPicker(value){
  var s='';
  for(var i=1;i<=5;i++){
    s+='<button type="button" data-pw-review-star="'+i+'" aria-label="'+i+'" style="font-size:1.4rem;line-height:1;background:none;border:none;cursor:pointer;color:'+(i<=value?'#f59e0b':'#d1d5db')+'">★</button>';
  }
  return '<div data-pw-review-stars="1" data-rating="'+value+'" style="display:flex;gap:4px">'+s+'</div>';
}
function setStarValue(host,n){
  host.setAttribute('data-rating',String(n));
  var btns=host.querySelectorAll('[data-pw-review-star]');
  for(var i=0;i<btns.length;i++)btns[i].style.color=(i+1)<=n?'#f59e0b':'#d1d5db';
}
function pdpBuyBox(){
  return document.querySelector('.pw-shop-pdp-info')||document.querySelector('[data-pw-region="pdp-info"]:not(.pw-shop-product-detail)');
}
function rehomePdpBuyBox(){
  var info=pdpBuyBox();
  if(!info)return;
  var qty=info.querySelector('[data-pw-el="qty"]');
  var qtyHost=qty&&qty.parentElement&&qty.parentElement!==info?qty.parentElement:qty;
  var actions=info.querySelector('.pw-pdp-actions');
  var before=qtyHost||actions;
  document.querySelectorAll('[data-pw-pdp-option]').forEach(function(block){
    if(info.contains(block))return;
    if(before)info.insertBefore(block,before);
    else info.appendChild(block);
  });
  info.querySelectorAll('.pw-pdp-total,.pw-pdp-notes,.pw-pdp-policy').forEach(function(el){el.remove();});
  document.querySelectorAll('.pw-shop-product-layout > .pw-pdp-total,.pw-pdp > .pw-pdp-total,.pw-shop-product-layout > .pw-pdp-notes,.pw-shop-product-layout > .pw-pdp-policy').forEach(function(el){el.remove();});
}
function paintPills(kind,items){
  rehomePdpBuyBox();
  var info=pdpBuyBox();
  var block=info&&info.querySelector('[data-pw-pdp-option="'+kind+'"]');
  if(!block&&kind==='color'){
    var colorPill=info&&info.querySelector('.pw-pdp-color')||document.querySelector('.pw-pdp-color');
    block=colorPill&&colorPill.closest?colorPill.closest('[data-pw-el="variant"],[data-pw-pdp-option]') :null;
    if(block&&info&&!info.contains(block)){
      var qty=info.querySelector('[data-pw-el="qty"]');
      var qtyHost=qty&&qty.parentElement&&qty.parentElement!==info?qty.parentElement:qty;
      info.insertBefore(block,qtyHost||info.querySelector('.pw-pdp-actions')||null);
    }
  }
  if(!items||!items.length){
    if(block)block.style.display='none';
    return;
  }
  if(!block){
    if(!info)return;
    if(info.querySelector('[data-pw-pdp-option="'+kind+'"]'))return;
    block=document.createElement('div');
    block.setAttribute('data-pw-el','variant');
    block.setAttribute('data-pw-pdp-option',kind);
    block.style.marginTop='16px';
    var qty2=info.querySelector('[data-pw-el="qty"]');
    var qtyHost2=qty2&&qty2.parentElement&&qty2.parentElement!==info?qty2.parentElement:qty2;
    if(qtyHost2)info.insertBefore(block,qtyHost2);
    else info.appendChild(block);
  }
  block.style.display='';
  var label=kind==='color'?COPY.colorLabel:COPY.sizeLabel;
  var pills='';
  for(var i=0;i<items.length;i++){
    var name=String(items[i].name||items[i]||'').trim();
    if(!name)continue;
    var img=String(items[i].img||'').trim();
    var face=img?'<img src="'+esc(shopImg({imageUrl:img}))+'" data-pw-full-src="'+esc(shopPdpOrigSrc(img))+'" alt="'+esc(name)+'" loading="lazy" decoding="async" />':esc(name);
    pills+='<button type="button" class="pw-pdp-pill'+(kind==='color'?' pw-pdp-color':'')+(i===0?' is-active':'')+'" data-pw-pdp-option-value="'+esc(name)+'">'+face+'</button>';
  }
  block.innerHTML='<p style="font-weight:700;margin:0 0 8px;font-size:14px">'+esc(label)+'</p><div class="pw-pdp-pills">'+pills+'</div>';
}
function applyOptions(options){
  rehomePdpBuyBox();
  if(!options)return;
  var sizes=(options.sizes||[]).map(function(s){return {name:String(s||'').trim()};}).filter(function(s){return s.name;});
  var colors=(options.colors||[]).map(function(c){return {name:String(c&&c.name||'').trim(),img:String(c&&c.img||'').trim()};}).filter(function(c){return c.name;});
  paintPills('size',sizes);
  paintPills('color',colors);
  hideBrokenPdpImgs();
}
function fmtDate(s){
  try{var d=new Date(s);if(isNaN(d.getTime()))return '';return d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return '';}
}
function verifiedBadge(){return '<span class="pw-pdp-verified">✓ '+esc(COPY.qaVerifiedBadge)+'</span>';}
function helpfulRow(kind,id,n){
  return '<div class="pw-pdp-helpful"><span>'+esc(String(COPY.reviewsHelpfulCount||'').replace('{n}',String(n||0)))+'</span><button type="button" data-pw-'+kind+'-vote="'+esc(id)+'">👍 '+esc(COPY.reviewsUsefulLabel)+'</button></div>';
}
function reviewCard(r){
  var photos=(r.imageUrls||[]).map(function(u){return String(u||'').trim();}).filter(Boolean);
  var photoHtml=photos.length?'<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">'+photos.map(function(u){return '<img src="'+esc(shopImg({imageUrl:u}))+'" data-pw-full-src="'+esc(shopPdpOrigSrc(u))+'" alt="" loading="lazy" decoding="async" style="width:72px;height:72px;object-fit:cover;border-radius:8px" />';}).join('')+'</div>':'';
  var reply=String(r.merchantReply||'').trim();
  var replyHtml=reply?'<div class="pw-pdp-rq-reply"><strong>'+esc(r.merchantReplyBy||'Shop')+'</strong> · '+esc(fmtDate(r.createdAt))+'<p style="margin:4px 0 0">'+esc(reply)+'</p></div>':'';
  var title=String(r.title||'').trim();
  var verified=(r.verified===true)||r.guestAccountId||r.linkedUserId||(r.isImported&&String(r.content||'').trim())?verifiedBadge():'';
  return '<article class="pw-pdp-rq-item" data-pw-el="card" data-pw-review-id="'+esc(r.id)+'" id="review-'+esc(r.id)+'"><div style="display:flex;justify-content:space-between;gap:8px"><div><strong data-pw-el="card-name">'+esc(r.reviewerName||'')+'</strong>'+verified+'<div class="pw-shop-muted" style="font-size:12px">'+esc(fmtDate(r.createdAt))+'</div></div><span class="pw-pdp-star">'+stars(r.rating)+'</span></div>'+(title?'<p class="pw-pdp-rq-title">'+esc(title)+'</p>':'')+'<p data-pw-el="body">'+esc(r.content||'')+'</p>'+photoHtml+replyHtml+helpfulRow('review',r.id,r.usefulCount)+'</article>';
}
function questionCard(q){
  var answers=q.answers||[];
  var admin=answers.filter(function(a){return a.answerType==='admin';})[0];
  var buyers=answers.filter(function(a){return a.answerType==='buyer';}).slice(0,2);
  var reply='';
  if(admin)reply+='<div class="pw-pdp-rq-reply"><strong>'+esc(admin.responderName||'Shop')+'</strong> · '+esc(fmtDate(admin.createdAt))+'<p style="margin:4px 0 0">'+esc(admin.content||'')+'</p></div>';
  buyers.forEach(function(a){
    reply+='<div class="pw-pdp-rq-reply buyer"><strong>'+esc(a.responderName||'')+'</strong>'+verifiedBadge()+' '+esc(COPY.qaBuyerReplied)+' · '+esc(fmtDate(a.createdAt))+'<p style="margin:4px 0 0">'+esc(a.content||'')+'</p></div>';
  });
  var ansForm=buyers.length<2?'<button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-qa-answer-open="'+esc(q.id)+'" style="margin-top:8px;font-size:13px">'+esc(COPY.qaReplyBuyerOnly)+'</button><div hidden data-pw-qa-answer-form="'+esc(q.id)+'" style="margin-top:8px;display:grid;gap:8px"><textarea rows="2" data-pw-qa-answer-body placeholder="'+esc(COPY.qaAnswerFormPlaceholder)+'"></textarea><p data-pw-qa-answer-msg hidden></p><button type="button" class="pw-shop-btn" data-pw-qa-answer-submit="'+esc(q.id)+'">'+esc(COPY.qaAnswerSubmit)+'</button></div>':'';
  return '<article class="pw-pdp-rq-item" data-pw-el="card" data-pw-question-id="'+esc(q.id)+'" id="question-'+esc(q.id)+'"><p style="margin:0"><strong data-pw-el="card-name">'+esc(q.askerName||'')+'</strong> '+esc(COPY.qaAskedPrefix)+' <span data-pw-el="body">'+esc(q.content||'')+'</span></p><div class="pw-shop-muted" style="font-size:12px">'+esc(fmtDate(q.createdAt))+'</div>'+reply+ansForm+helpfulRow('qa',q.id,q.usefulCount)+'</article>';
}
function ensureModal(id,kind){
  var el=document.getElementById(id);
  if(el)return el;
  el=document.createElement('div');
  el.id=id;
  el.className='pw-pdp-rq-modal';
  el.hidden=true;
  el.setAttribute('data-pw-rq-modal',kind);
  el.setAttribute('role','dialog');
  el.innerHTML='<div class="pw-pdp-rq-dialog"><div class="pw-pdp-rq-dialog-head"><strong></strong><button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-rq-close>×</button></div><div class="pw-pdp-rq-strip" data-pw-rq-product-strip></div><div data-pw-pdp-slot="'+(kind==='reviews'?'review-form':'qa-form')+'"></div><div class="pw-pdp-rq-list" data-pw-pdp-slot="'+(kind==='reviews'?'review-list':'qa-list')+'"></div></div>';
  document.body.appendChild(el);
  return el;
}
function openRqModal(kind){
  var m=document.querySelector('[data-pw-rq-modal="'+kind+'"]');
  if(m){m.hidden=false;m.removeAttribute('hidden');}
}
function closeRqModals(){
  document.querySelectorAll('[data-pw-rq-modal]').forEach(function(m){m.hidden=true;});
}
function ensureReviewUi(section){
  var modal=ensureModal('pw-pdp-reviews-modal','reviews');
  var form=modal.querySelector('[data-pw-pdp-slot="review-form"]');
  if(form){
    form.innerHTML='<p style="margin:0;font-weight:700">'+esc(COPY.reviewsWriteButton)+'</p><p class="pw-shop-muted" style="margin:0">'+esc(COPY.reviewsFormRatingLabel)+'</p>'+starPicker(5)+'<textarea rows="3" data-pw-review-body placeholder="'+esc(COPY.reviewsFormContentPlaceholder)+'"></textarea><p data-pw-review-msg hidden></p><button type="button" class="pw-shop-btn" data-pw-review-submit>'+esc(COPY.reviewsFormSubmit)+'</button>';
  }
  var list=modal.querySelector('[data-pw-pdp-slot="review-list"]');
  var sample=section.querySelector('[data-pw-rq-review-sample]')||section;
  var countEl=section.querySelector('[data-pw-rq-review-count]');
  var scoreEl=section.querySelector('[data-pw-rq-review-score]');
  var more=modal.querySelector('[data-pw-review-more]');
  if(!more){more=document.createElement('button');more.type='button';more.className='pw-shop-btn pw-shop-btn-outline';more.setAttribute('data-pw-review-more','1');more.textContent=COPY.reviewsLoadMore;more.hidden=true;list.insertAdjacentElement('afterend',more);}
  return {summary:countEl,score:scoreEl,list:list,sample:sample,more:more,form:form,modal:modal};
}
function ensureQaUi(section){
  var modal=ensureModal('pw-pdp-qa-modal','qa');
  var form=modal.querySelector('[data-pw-pdp-slot="qa-form"]');
  if(form){
    form.innerHTML='<textarea rows="3" data-pw-qa-body placeholder="'+esc(COPY.qaFormPlaceholder)+'"></textarea><p data-pw-qa-msg hidden></p><button type="button" class="pw-shop-btn" data-pw-qa-submit>'+esc(COPY.qaFormSubmit)+'</button>';
  }
  var list=modal.querySelector('[data-pw-pdp-slot="qa-list"]');
  var sample=section.querySelector('[data-pw-rq-qa-sample]')||section;
  var countEl=section.querySelector('[data-pw-rq-qa-count]');
  var more=modal.querySelector('[data-pw-qa-more]');
  if(!more){more=document.createElement('button');more.type='button';more.className='pw-shop-btn pw-shop-btn-outline';more.setAttribute('data-pw-qa-more','1');more.textContent=COPY.qaLoadMore;more.hidden=true;list.insertAdjacentElement('afterend',more);}
  return {list:list,sample:sample,count:countEl,more:more,form:form,modal:modal};
}
function showMsg(el,text){
  if(!el)return;
  el.hidden=!text;
  el.textContent=text||'';
}
function bindLive(id){
  var reviewsPage=1,reviewsTotal=0,questionsPage=1,questionsTotal=0;
  var reviewSec=ensureSection('#pw-pdp-reviews,[data-pw-region="reviews"]:not([data-pw-pdp-slot="qa"])','pw-pdp-reviews','reviews',COPY.reviewsTitle,false);
  var qaSec=ensureSection('#pw-pdp-qa,[data-pw-pdp-slot="qa"]','pw-pdp-qa','reviews',COPY.qaTitle,true);
  var reviewUi=ensureReviewUi(reviewSec);
  var qaUi=ensureQaUi(qaSec);
  function paintReviews(rows,append){
    if(!reviewUi.list)return;
    if(!append)reviewUi.list.innerHTML='';
    if(!rows.length&&!append)reviewUi.list.innerHTML='<p class="pw-shop-muted">'+esc(COPY.reviewsEmpty)+'</p>';
    else reviewUi.list.insertAdjacentHTML('beforeend',rows.map(reviewCard).join(''));
    if(reviewUi.sample){
      reviewUi.sample.innerHTML=rows[0]?reviewCard(rows[0]):'<p class="pw-shop-muted">'+esc(COPY.reviewsEmpty)+'</p>';
    }
    reviewUi.more.hidden=reviewUi.list.querySelectorAll('.pw-pdp-rq-item').length>=reviewsTotal;
  }
  function paintQuestions(rows,append){
    if(!qaUi.list)return;
    if(!append)qaUi.list.innerHTML='';
    if(!rows.length&&!append)qaUi.list.innerHTML='<p class="pw-shop-muted">'+esc(COPY.qaEmpty)+'</p>';
    else qaUi.list.insertAdjacentHTML('beforeend',rows.map(questionCard).join(''));
    if(qaUi.sample){
      qaUi.sample.innerHTML=rows[0]?questionCard(rows[0]):'<p class="pw-shop-muted">'+esc(COPY.qaEmpty)+'</p>';
    }
    qaUi.more.hidden=qaUi.list.querySelectorAll('.pw-pdp-rq-item').length>=questionsTotal;
  }
  function loadReviews(page,append,pageSize){
    return apiFetch(API_PREFIX+encodeURIComponent(id)+'/reviews?page='+page+'&pageSize='+(pageSize||REVIEW_PAGE_SIZE)).then(function(res){
      var j=res.j||{};
      reviewsTotal=Number(j.total||0);
      var displayTotal=catalogReviewTotal>0?catalogReviewTotal:reviewsTotal;
      if(reviewUi.summary)reviewUi.summary.textContent=displayTotal+' '+COPY.reviewsTotalSuffix;
      var summary=j.summary;
      var score=catalogReviewScore>0?catalogReviewScore:(summary&&summary.average?summary.average:0);
      if(reviewUi.score&&score)reviewUi.score.textContent=String(score)+'/5 ★';
      if(j.hasReviewed){
        document.querySelectorAll('[data-pw-rq-open-write]').forEach(function(btn){btn.hidden=true;});
        if(reviewUi.form)reviewUi.form.hidden=true;
      }
      paintReviews(j.reviews||[],append);
    });
  }
  function loadQuestions(page,append,pageSize){
    return apiFetch(API_PREFIX+encodeURIComponent(id)+'/questions?page='+page+'&pageSize='+(pageSize||REVIEW_PAGE_SIZE)).then(function(res){
      var j=res.j||{};
      questionsTotal=Number(j.total||0);
      var qaDisplay=catalogQaTotal>0?catalogQaTotal:questionsTotal;
      if(qaUi.count)qaUi.count.textContent=qaDisplay+' '+COPY.qaCountSuffix;
      paintQuestions(j.questions||[],append);
    });
  }
  apiFetch(API_PREFIX+encodeURIComponent(id)+'/options').then(function(res){
    if(res.ok&&res.j&&res.j.options)applyOptions(res.j.options);
  }).catch(function(){});
  loadReviews(1,false,SUMMARY_PAGE_SIZE).catch(function(){});
  loadQuestions(1,false,SUMMARY_PAGE_SIZE).catch(function(){});
  function applyHash(){
    var h=location.hash||'';
    if(h==='#reviews'||h.indexOf('#review-')===0){reviewsPage=1;loadReviews(1,false);openRqModal('reviews');}
    if(h==='#qa'||h.indexOf('#question-')===0){questionsPage=1;loadQuestions(1,false);openRqModal('qa');}
  }
  window.addEventListener('hashchange',applyHash);
  applyHash();
  if(reviewSec.getAttribute('data-pw-pdp-live')==='1')return;
  reviewSec.setAttribute('data-pw-pdp-live','1');
  qaSec.setAttribute('data-pw-pdp-live','1');
  document.addEventListener('click',function(ev){
    var t=ev.target;if(!t||!t.closest)return;
    var pill=t.closest('[data-pw-pdp-option] .pw-pdp-pill');
    if(pill){
      ev.preventDefault();
      var host=pill.closest('[data-pw-pdp-option]');
      host.querySelectorAll('.pw-pdp-pill').forEach(function(p){p.classList.remove('is-active');});
      pill.classList.add('is-active');
      var colorHost=pill.closest('[data-pw-pdp-option="color"]');
      var colorImg=colorHost&&pill.querySelector('img');
      var colorSrc=pdpImgFullSrc(colorImg);
      if(colorSrc){
        var colorPage=shopPdpPageSrc(colorSrc);
        var colorFull=shopPdpOrigSrc(colorSrc);
        document.querySelectorAll('[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img,[data-pw-region="gallery"] .pw-shop-product-img').forEach(function(main){
          if(!galleryFaceVisible(main))return;
          main.setAttribute('src',colorPage||colorSrc);
          if(colorFull)main.setAttribute('data-pw-full-src',colorFull);
          main.classList.remove('pw-pdp-hero-img-hidden');
        });
        document.querySelectorAll('[data-nanoai-try-on],[data-pw-chrome-btn="try-on"],[data-nanoai-open-chat],[data-pw-chrome-btn="chat"]').forEach(function(el){
          if(el.closest&&el.closest('[data-pw-chrome-btn="chat-zalo"],[data-pw-chrome-btn="chat-facebook"]'))return;
          el.setAttribute('data-nanoai-image',colorFull||colorSrc);
        });
      }
      return;
    }
    var videoThumb=t.closest('[data-pw-pdp-video-thumb]');
    if(videoThumb){
      ev.preventDefault();
      document.querySelectorAll('[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img,[data-pw-region="gallery"] .pw-shop-product-img').forEach(function(img){img.classList.add('pw-pdp-hero-img-hidden');});
      document.querySelectorAll('[data-pw-pdp-hero-video]').forEach(function(el){el.hidden=false;el.removeAttribute('hidden');});
      document.querySelectorAll('[data-pw-region="gallery"] [data-pw-el="thumb"],[data-pw-pdp-video-thumb]').forEach(function(el){el.classList.remove('is-active');});
      videoThumb.classList.add('is-active');
      return;
    }
    var photoThumb=t.closest('[data-pw-region="gallery"] [data-pw-el="thumb"]');
    if(photoThumb){
      ev.preventDefault();
      var thumbImg=photoThumb.querySelector('img');
      var src=pdpImgFullSrc(thumbImg);
      if(src){
        var page=shopPdpPageSrc(src);
        var full=shopPdpOrigSrc(src);
        document.querySelectorAll('[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img,[data-pw-region="gallery"] .pw-shop-product-img').forEach(function(main){
          if(!galleryFaceVisible(main))return;
          main.setAttribute('src',page||src);
          if(full)main.setAttribute('data-pw-full-src',full);
          main.classList.remove('pw-pdp-hero-img-hidden');
        });
        document.querySelectorAll('[data-nanoai-try-on],[data-pw-chrome-btn="try-on"],[data-nanoai-open-chat],[data-pw-chrome-btn="chat"]').forEach(function(el){
          if(el.closest&&el.closest('[data-pw-chrome-btn="chat-zalo"],[data-pw-chrome-btn="chat-facebook"]'))return;
          el.setAttribute('data-nanoai-image',full||src);
        });
      }
      document.querySelectorAll('[data-pw-pdp-hero-video]').forEach(function(el){el.hidden=true;});
      document.querySelectorAll('[data-pw-region="gallery"] [data-pw-el="thumb"],[data-pw-pdp-video-thumb]').forEach(function(el){el.classList.remove('is-active');});
      photoThumb.classList.add('is-active');
      return;
    }
    var qtyHost=t.closest('[data-pw-el="qty"]');
    if(qtyHost&&t.closest('button')){
      ev.preventDefault();
      var span=qtyHost.querySelector('span');
      var n=Math.max(1,Number(span&&span.textContent)||1);
      var label=String((t.closest('button').textContent)||'').trim();
      if(label==='−'||label==='-'||label==='–')n=Math.max(1,n-1);
      else n=Math.min(99,n+1);
      if(span)span.textContent=String(n);
      return;
    }
    var star=t.closest('[data-pw-review-star]');
    if(star){
      ev.preventDefault();
      var wrap=star.closest('[data-pw-review-stars]');
      if(wrap)setStarValue(wrap,Number(star.getAttribute('data-pw-review-star'))||5);
      return;
    }
    if(t.closest('[data-pw-rq-close]')||t.getAttribute&&t.getAttribute('data-pw-rq-modal')){
      if(t.closest('[data-pw-rq-close]')||t===t.closest('[data-pw-rq-modal]')){ev.preventDefault();closeRqModals();return;}
    }
    if(t.closest('[data-pw-rq-open-reviews]')){ev.preventDefault();reviewsPage=1;loadReviews(1,false);openRqModal('reviews');return;}
    if(t.closest('[data-pw-rq-open-write]')){ev.preventDefault();reviewsPage=1;loadReviews(1,false);openRqModal('reviews');var wf=document.querySelector('[data-pw-rq-modal="reviews"] [data-pw-pdp-slot="review-form"]');if(wf)wf.hidden=false;return;}
    if(t.closest('[data-pw-rq-open-qa]')){ev.preventDefault();questionsPage=1;loadQuestions(1,false);openRqModal('qa');return;}
    var vote=t.closest('[data-pw-review-vote]');
    if(vote){
      ev.preventDefault();
      var rid=vote.getAttribute('data-pw-review-vote');
      apiFetch(API_PREFIX+encodeURIComponent(id)+'/reviews/'+encodeURIComponent(rid)+'/vote',{method:'POST'}).then(function(res){
        if(!res.ok||!res.j||!res.j.ok)return;
        vote.textContent='👍 '+COPY.reviewsUsefulLabel;
        var row=vote.closest('.pw-pdp-helpful');
        if(row&&row.querySelector('span'))row.querySelector('span').textContent=String(COPY.reviewsHelpfulCount||'').replace('{n}',String(res.j.usefulCount||0));
      });
      return;
    }
    var qvote=t.closest('[data-pw-qa-vote]');
    if(qvote){
      ev.preventDefault();
      var qvid=qvote.getAttribute('data-pw-qa-vote');
      apiFetch(API_PREFIX+encodeURIComponent(id)+'/questions/'+encodeURIComponent(qvid)+'/vote',{method:'POST'}).then(function(res){
        if(!res.ok||!res.j||!res.j.ok)return;
        var row=qvote.closest('.pw-pdp-helpful');
        if(row&&row.querySelector('span'))row.querySelector('span').textContent=String(COPY.reviewsHelpfulCount||'').replace('{n}',String(res.j.usefulCount||0));
      });
      return;
    }
    if(t.closest('[data-pw-review-submit]')){
      ev.preventDefault();
      var form=document.querySelector('[data-pw-rq-modal="reviews"] [data-pw-pdp-slot="review-form"]')||reviewSec.querySelector('[data-pw-pdp-slot="review-form"]');
      var body=form&&form.querySelector('[data-pw-review-body]');
      var starsEl=form&&form.querySelector('[data-pw-review-stars]');
      var msg=form&&form.querySelector('[data-pw-review-msg]');
      var content=String(body&&body.value||'').trim();
      if(!content)return;
      var btn=t.closest('button');if(btn)btn.disabled=true;
      apiFetch(API_PREFIX+encodeURIComponent(id)+'/reviews',{method:'POST',body:JSON.stringify({rating:Number(starsEl&&starsEl.getAttribute('data-rating'))||5,content:content,locale:COPY.locale})}).then(function(res){
        var err=res.j&&res.j.error;
        if(res.status===401||err==='login_required'){showMsg(msg,COPY.reviewsSubmitLoginRequired);goLogin('#pw-pdp-reviews');return;}
        if(err==='already_reviewed'){showMsg(msg,COPY.reviewsSubmitAlreadyReviewed);return;}
        if(err==='not_eligible'){showMsg(msg,COPY.reviewsSubmitNotEligible);return;}
        if(res.ok&&res.j&&res.j.ok){showMsg(msg,COPY.reviewsSubmitSuccess);if(body)body.value='';reviewsPage=1;loadReviews(1,false);}
      }).finally(function(){if(btn)btn.disabled=false;});
      return;
    }
    if(t.closest('[data-pw-reviews-more]')){
      ev.preventDefault();
      reviewsPage+=1;
      loadReviews(reviewsPage,true);
      return;
    }
    if(t.closest('[data-pw-qa-submit]')){
      ev.preventDefault();
      var qaForm=document.querySelector('[data-pw-rq-modal="qa"] [data-pw-pdp-slot="qa-form"]')||qaSec.querySelector('[data-pw-pdp-slot="qa-form"]');
      var qaBody=qaForm&&qaForm.querySelector('[data-pw-qa-body]');
      var qaMsg=qaForm&&qaForm.querySelector('[data-pw-qa-msg]');
      var ask=String(qaBody&&qaBody.value||'').trim();
      if(!ask)return;
      var qaBtn=t.closest('button');if(qaBtn)qaBtn.disabled=true;
      apiFetch(API_PREFIX+encodeURIComponent(id)+'/questions',{method:'POST',body:JSON.stringify({content:ask})}).then(function(res){
        var err=res.j&&res.j.error;
        if(res.status===401||err==='login_required'){showMsg(qaMsg,COPY.qaSubmitLoginRequired);goLogin('#pw-pdp-qa');return;}
        if(res.ok&&res.j&&res.j.ok){showMsg(qaMsg,COPY.qaSubmitSuccess);if(qaBody)qaBody.value='';questionsPage=1;loadQuestions(1,false);}
      }).finally(function(){if(qaBtn)qaBtn.disabled=false;});
      return;
    }
    var openAns=t.closest('[data-pw-qa-answer-open]');
    if(openAns){
      ev.preventDefault();
      var box=qaSec.querySelector('[data-pw-qa-answer-form="'+openAns.getAttribute('data-pw-qa-answer-open')+'"]');
      if(box)box.hidden=!box.hidden;
      return;
    }
    var ansSubmit=t.closest('[data-pw-qa-answer-submit]');
    if(ansSubmit){
      ev.preventDefault();
      var qid=ansSubmit.getAttribute('data-pw-qa-answer-submit');
      var ansForm=qaSec.querySelector('[data-pw-qa-answer-form="'+qid+'"]');
      var ansBody=ansForm&&ansForm.querySelector('[data-pw-qa-answer-body]');
      var ansMsg=ansForm&&ansForm.querySelector('[data-pw-qa-answer-msg]');
      var ans=String(ansBody&&ansBody.value||'').trim();
      if(!ans)return;
      ansSubmit.disabled=true;
      apiFetch(API_PREFIX+encodeURIComponent(id)+'/questions/'+encodeURIComponent(qid)+'/answers',{method:'POST',body:JSON.stringify({content:ans})}).then(function(res){
        var err=res.j&&res.j.error;
        if(res.status===401||err==='login_required'){showMsg(ansMsg,COPY.qaSubmitLoginRequired);goLogin('#pw-pdp-qa');return;}
        if(err==='not_eligible'){showMsg(ansMsg,COPY.qaAnswerNotEligible);return;}
        if(err==='slot_full'){showMsg(ansMsg,COPY.qaAnswerSlotFull);return;}
        if(res.ok&&res.j&&res.j.ok){if(ansBody)ansBody.value='';if(ansForm)ansForm.hidden=true;questionsPage=1;loadQuestions(1,false);}
      }).finally(function(){ansSubmit.disabled=false;});
      return;
    }
    if(t.closest('[data-pw-qa-more]')){
      ev.preventDefault();
      questionsPage+=1;
      loadQuestions(questionsPage,true);
    }
    if(t.closest('[data-pw-review-more]')){
      ev.preventDefault();
      reviewsPage+=1;
      loadReviews(reviewsPage,true);
    }
  });
}
var id=productId();
if(!id)return;
rehomePdpBuyBox();
trackView(id);
bindLive(id);
if(!document.querySelector('[data-pw-pdp-server-bound="1"]')){
  fetch(API_PREFIX+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
    if(j&&j.product){
      if(j.birthdayOffer){
        j.product.birthdayOffer=j.birthdayOffer;
        if(j.birthdayOffer.percent)j.product.birthdayOfferPercent=j.birthdayOffer.percent;
        j.product.birthdayOfferEndsAt=j.birthdayOffer.countdownTo||j.birthdayOffer.endsAt||j.product.birthdayOfferEndsAt||'';
      }
      apply(j.product);
    }
  }).catch(function(){});
} else {
  fetch(API_PREFIX+encodeURIComponent(id)+'?view=buy',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
    if(!j)return;
    var p=j.product||{};
    if(j.birthdayOffer)p.birthdayOffer=j.birthdayOffer;
    paintPdpBirthday(p);
  }).catch(function(){});
}
})();</script>`
}
