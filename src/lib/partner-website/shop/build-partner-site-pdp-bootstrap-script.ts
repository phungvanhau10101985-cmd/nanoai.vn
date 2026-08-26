import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteLoginPath, partnerSiteProductApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'

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
  const copy = {
    locale,
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
  }

  return `<script data-pw-pdp-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
if(pwShopLiveUiOff())return;
if(!document.querySelector('[data-pw-region="pdp-info"],[data-pw-region="gallery"],.pw-pdp'))return;
var API_PREFIX=${JSON.stringify(apiPrefix)};
var EVENTS_API=${JSON.stringify(eventsApi)};
var LOGIN_PATH=${JSON.stringify(loginPath)};
var COPY=${JSON.stringify(copy)};
var SESSION_KEY='app_guest_session_id';
var SESSION_KEY_LEGACY='nanoai_guest_session_id';
var SESSION_HDR='x-guest-session-id';
function readCookie(n){var p=document.cookie.split(';');for(var i=0;i<p.length;i++){var x=p[i].trim().split('=');if(x[0]===n)return decodeURIComponent(x.slice(1).join('=')||'');}return '';}
function sessionId(){try{var ls=localStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY_LEGACY)||'';if(ls)return ls;}catch(e){}return readCookie('app_guest_session_sync');}
function authHeaders(){var h={'Content-Type':'application/json'};var s=sessionId();if(s)h[SESSION_HDR]=s;return h;}
function captureSession(res){var sid=res.headers.get(SESSION_HDR);if(sid){try{localStorage.setItem(SESSION_KEY,sid);localStorage.setItem(SESSION_KEY_LEGACY,sid);}catch(e){}}}
function apiFetch(url,opts){
  opts=opts||{};opts.credentials='same-origin';
  opts.headers=Object.assign({},authHeaders(),opts.headers||{});
  return fetch(url,opts).then(function(r){captureSession(r);return r.json().then(function(j){return {ok:r.ok,status:r.status,j:j};}).catch(function(){return {ok:r.ok,status:r.status,j:{}};});});
}
function trackView(id){
  if(!id)return;
  apiFetch(EVENTS_API,{method:'POST',body:JSON.stringify({event:'view_product',inventory_id:id})}).catch(function(){});
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
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
  if(desc)document.querySelectorAll('[data-pw-region="pdp-info"] [data-pw-el="desc"]').forEach(function(el){
    if(/<[a-z][\s\S]*>/i.test(desc))el.innerHTML=desc;
    else setText(el,desc);
  });
  var price=String(p.priceHint||'').trim();
  if(price)document.querySelectorAll('[data-pw-region="pdp-info"] [data-pw-el="price"]').forEach(function(el){
    var compare=el.querySelector('[data-pw-el="compare-price"]');
    if(compare){el.childNodes.forEach(function(n){if(n.nodeType===3)n.textContent='';}); el.insertBefore(document.createTextNode(price),el.firstChild);}
    else setText(el,price);
  });
  var imgs=imagesOf(p);
  var main=imgs[0]||'';
  if(main){
    document.querySelectorAll('[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img,[data-pw-region="gallery"] .pw-shop-product-img').forEach(function(img){
      img.setAttribute('src',main);img.setAttribute('alt',name);
    });
  }
  document.querySelectorAll('[data-pw-region="gallery"] [data-pw-el="thumb"]').forEach(function(thumb,i){
    var url=imgs[i];
    if(!url){thumb.hidden=true;thumb.style.display='none';return;}
    thumb.hidden=false;thumb.style.display='';
    var img=thumb.querySelector('img');
    if(img){img.setAttribute('src',url);img.setAttribute('alt',name);}
  });
  var sold=Math.max(0,Math.round(Number(p.purchasesCount||0))||0);
  var likes=Math.max(0,Math.round(Number(p.likesCount||0))||0);
  var reviews=Math.max(0,Math.round(Number(p.reviewsCount||0))||0);
  var rating=Number(p.ratingScore||0);
  var ratingText=isFinite(rating)?Number(rating).toFixed(1):'0.0';
  var statsHtml='<span>🛒 '+esc(COPY.pdpPurchasesLabel)+': <strong>'+esc(String(sold))+'</strong></span>'+
    '<span>♥ '+esc(COPY.pdpLikesLabel)+': <strong>'+esc(String(likes))+'</strong></span>'+
    '<span><span class="pw-pdp-star">★</span> '+esc(COPY.pdpRatingLabel)+': <strong>'+esc(ratingText)+'/5</strong> ('+esc(String(reviews))+' '+esc(COPY.pdpRatingCountSuffix)+')</span>'+
    '<a href="#pw-pdp-reviews">'+esc(COPY.pdpJumpReviews)+'</a><a href="#pw-pdp-qa">'+esc(COPY.pdpJumpQa)+'</a>';
  document.querySelectorAll('[data-pw-pdp-slot="stats"],.pw-pdp-stats').forEach(function(el){el.innerHTML=statsHtml;});
  document.querySelectorAll('[data-pw-pdp-favorite],[data-pw-region="pdp-info"] [data-pw-favorite]').forEach(function(btn){
    btn.textContent='♡ '+String(likes);
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
function paintPills(kind,items){
  var block=document.querySelector('[data-pw-region="pdp-info"] [data-pw-pdp-option="'+kind+'"],[data-pw-pdp-option="'+kind+'"]');
  if(!block&&kind==='color'){
    var colorPill=document.querySelector('[data-pw-region="pdp-info"] .pw-pdp-color,.pw-pdp-color');
    block=colorPill&&colorPill.closest?colorPill.closest('[data-pw-el="variant"]'):null;
  }
  if(!items||!items.length){
    if(block)block.style.display='none';
    return;
  }
  if(!block){
    var info=document.querySelector('.pw-shop-pdp-info,[data-pw-region="pdp-info"]');
    if(!info)return;
    if(info.querySelector('[data-pw-pdp-option="'+kind+'"]'))return;
    block=document.createElement('div');
    block.setAttribute('data-pw-el','variant');
    block.setAttribute('data-pw-pdp-option',kind);
    block.style.marginTop='16px';
    var qty=info.querySelector('[data-pw-el="qty"]');
    if(qty&&qty.parentNode)qty.parentNode.insertBefore(block,qty);
    else info.appendChild(block);
  }
  block.style.display='';
  var label=kind==='color'?COPY.colorLabel:COPY.sizeLabel;
  var pills='';
  for(var i=0;i<items.length;i++){
    var name=String(items[i].name||items[i]||'').trim();
    if(!name)continue;
    var img=String(items[i].img||'').trim();
    var face=img?'<img src="'+esc(img)+'" alt="'+esc(name)+'" />':esc(name);
    pills+='<button type="button" class="pw-pdp-pill'+(kind==='color'?' pw-pdp-color':'')+(i===0?' is-active':'')+'" data-pw-pdp-option-value="'+esc(name)+'">'+face+'</button>';
  }
  block.innerHTML='<p style="font-weight:700;margin:0 0 8px;font-size:14px">'+esc(label)+'</p><div class="pw-pdp-pills">'+pills+'</div>';
}
function applyOptions(options){
  if(!options)return;
  var sizes=(options.sizes||[]).map(function(s){return {name:String(s||'').trim()};}).filter(function(s){return s.name;});
  var colors=(options.colors||[]).map(function(c){return {name:String(c&&c.name||'').trim(),img:String(c&&c.img||'').trim()};}).filter(function(c){return c.name;});
  paintPills('size',sizes);
  paintPills('color',colors);
}
function reviewCard(r){
  var photos=(r.imageUrls||[]).map(function(u){return String(u||'').trim();}).filter(Boolean);
  var photoHtml=photos.length?'<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">'+photos.map(function(u){return '<img src="'+esc(u)+'" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px" />';}).join('')+'</div>':'';
  var reply=String(r.merchantReply||'').trim();
  var replyHtml=reply?'<div style="margin-top:8px;padding:10px;background:var(--pw-surface);border-radius:8px;font-size:14px"><strong>'+esc(COPY.reviewsMerchantReplyPrefix)+' '+esc(r.merchantReplyBy||'Shop')+':</strong> '+esc(reply)+'</div>':'';
  var title=String(r.title||'').trim();
  return '<article data-pw-el="card" data-pw-review-id="'+esc(r.id)+'"><strong data-pw-el="card-name">'+esc(r.reviewerName||'')+'</strong><span class="pw-pdp-star"> '+stars(r.rating)+'</span>'+(title?'<p style="font-weight:600;margin:6px 0 2px">'+esc(title)+'</p>':'')+'<p data-pw-el="body">'+esc(r.content||'')+'</p>'+photoHtml+replyHtml+'<button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-review-vote="'+esc(r.id)+'" style="margin-top:8px;font-size:13px;padding:4px 10px">👍 '+esc(COPY.reviewsUsefulLabel)+' ('+esc(String(r.usefulCount||0))+')</button></article>';
}
function questionCard(q){
  var answers=q.answers||[];
  var reply='';
  if(!answers.length)reply='<p class="pw-shop-muted" style="margin-left:16px;font-size:13px">'+esc(COPY.qaNoAnswersYet)+'</p>';
  else{
    reply=answers.map(function(a){
      var badge=a.answerType==='buyer'?COPY.qaVerifiedBadge:COPY.qaAdminBadge;
      return '<div style="margin-left:16px;margin-top:8px;font-size:14px"><strong>'+esc(a.responderName||'Shop')+'</strong> <span style="font-size:11px;padding:2px 6px;border-radius:999px;background:var(--pw-surface)">'+esc(badge)+'</span><p style="margin:4px 0 0">'+esc(a.content||'')+'</p></div>';
    }).join('');
  }
  return '<article data-pw-el="card" data-pw-question-id="'+esc(q.id)+'"><strong data-pw-el="card-name">'+esc(q.askerName||'')+'</strong><p data-pw-el="body">'+esc(q.content||'')+'</p>'+reply+'<button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-qa-answer-open="'+esc(q.id)+'" style="margin-top:8px;font-size:13px">'+esc(COPY.qaAnswerButton)+'</button><div hidden data-pw-qa-answer-form="'+esc(q.id)+'" style="margin-top:8px;display:grid;gap:8px;max-width:480px"><textarea rows="2" data-pw-qa-answer-body placeholder="'+esc(COPY.qaAnswerFormPlaceholder)+'"></textarea><p data-pw-qa-answer-msg hidden></p><button type="button" class="pw-shop-btn" data-pw-qa-answer-submit="'+esc(q.id)+'">'+esc(COPY.qaAnswerSubmit)+'</button></div></article>';
}
function ensureReviewUi(section){
  var demoStars=section.querySelectorAll('.pw-pdp-star');
  for(var i=0;i<demoStars.length;i++){
    var row=demoStars[i].parentElement;
    if(row&&!row.getAttribute('data-pw-pdp-slot')&&!row.closest('[data-pw-el="card"]'))row.style.display='none';
  }
  var summary=section.querySelector('[data-pw-pdp-slot="review-summary"]');
  if(!summary){
    summary=document.createElement('div');
    summary.setAttribute('data-pw-pdp-slot','review-summary');
    summary.style.cssText='display:flex;align-items:center;gap:12px;margin-top:8px';
    var title=section.querySelector('h2,[data-pw-el="section-title"]');
    if(title&&title.nextSibling)title.parentNode.insertBefore(summary,title.nextSibling);
    else section.insertBefore(summary,section.firstChild);
  }
  var form=section.querySelector('[data-pw-pdp-slot="review-form"]');
  if(!form){
    form=document.createElement('div');
    form.setAttribute('data-pw-pdp-slot','review-form');
    form.style.cssText='margin-top:16px;padding:16px;border:1px solid var(--pw-border);border-radius:12px;display:grid;gap:10px';
    section.appendChild(form);
  }
  form.innerHTML='<p style="margin:0;font-weight:700">'+esc(COPY.reviewsWriteButton)+'</p><p class="pw-shop-muted" style="margin:0">'+esc(COPY.reviewsFormRatingLabel)+'</p>'+starPicker(5)+'<textarea rows="3" data-pw-review-body placeholder="'+esc(COPY.reviewsFormContentPlaceholder)+'"></textarea><p data-pw-review-msg hidden></p><button type="button" class="pw-shop-btn" data-pw-review-submit>'+esc(COPY.reviewsFormSubmit)+'</button>';
  var list=section.querySelector('[data-pw-pdp-slot="review-list"]');
  if(!list){
    list=document.createElement('div');
    list.setAttribute('data-pw-pdp-slot','review-list');
    list.style.cssText='margin-top:20px;display:grid;gap:16px';
    section.appendChild(list);
  }
  var more=section.querySelector('[data-pw-reviews-more]');
  if(!more){
    more=document.createElement('button');
    more.type='button';
    more.className='pw-shop-btn pw-shop-btn-outline';
    more.setAttribute('data-pw-reviews-more','1');
    more.style.marginTop='12px';
    more.textContent=COPY.reviewsLoadMore;
    section.appendChild(more);
  }
  section.querySelectorAll(':scope > [data-pw-el="card"]').forEach(function(card){card.remove();});
  section.querySelectorAll(':scope > button').forEach(function(btn){
    if(!btn.getAttribute('data-pw-reviews-more'))btn.style.display='none';
  });
  return {summary:summary,list:list,more:more};
}
function ensureQaUi(section){
  var form=section.querySelector('[data-pw-pdp-slot="qa-form"]');
  if(!form){
    form=document.createElement('div');
    form.setAttribute('data-pw-pdp-slot','qa-form');
    form.style.cssText='margin-top:12px;display:grid;gap:8px;max-width:480px';
    var askBtn=section.querySelector('button');
    if(askBtn&&askBtn.parentNode===section)section.insertBefore(form,askBtn.nextSibling);
    else section.appendChild(form);
  }
  form.innerHTML='<textarea rows="3" data-pw-qa-body placeholder="'+esc(COPY.qaFormPlaceholder)+'"></textarea><p data-pw-qa-msg hidden></p><button type="button" class="pw-shop-btn" data-pw-qa-submit>'+esc(COPY.qaFormSubmit)+'</button>';
  var list=section.querySelector('[data-pw-pdp-slot="qa-list"]');
  if(!list){
    list=document.createElement('div');
    list.setAttribute('data-pw-pdp-slot','qa-list');
    list.style.cssText='margin-top:20px;display:grid;gap:16px';
    section.appendChild(list);
  }
  var more=section.querySelector('[data-pw-qa-more]');
  if(!more){
    more=document.createElement('button');
    more.type='button';
    more.className='pw-shop-btn pw-shop-btn-outline';
    more.setAttribute('data-pw-qa-more','1');
    more.style.marginTop='12px';
    more.textContent=COPY.qaLoadMore;
    section.appendChild(more);
  }
  section.querySelectorAll(':scope > [data-pw-el="card"]').forEach(function(card){card.remove();});
  section.querySelectorAll(':scope > button').forEach(function(btn){
    if(!btn.getAttribute('data-pw-qa-more')&&!btn.getAttribute('data-pw-qa-submit'))btn.style.display='none';
  });
  return {list:list,more:more};
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
    if(!append)reviewUi.list.innerHTML='';
    if(!rows.length&&!append)reviewUi.list.innerHTML='<p class="pw-shop-muted">'+esc(COPY.reviewsEmpty)+'</p>';
    else reviewUi.list.insertAdjacentHTML('beforeend',rows.map(reviewCard).join(''));
    reviewUi.more.hidden=reviewUi.list.querySelectorAll('[data-pw-review-id]').length>=reviewsTotal;
  }
  function paintQuestions(rows,append){
    if(!append)qaUi.list.innerHTML='';
    if(!rows.length&&!append)qaUi.list.innerHTML='<p class="pw-shop-muted">'+esc(COPY.qaEmpty)+'</p>';
    else qaUi.list.insertAdjacentHTML('beforeend',rows.map(questionCard).join(''));
    qaUi.more.hidden=qaUi.list.querySelectorAll('[data-pw-question-id]').length>=questionsTotal;
  }
  function loadReviews(page,append){
    return apiFetch(API_PREFIX+encodeURIComponent(id)+'/reviews?page='+page+'&pageSize=10').then(function(res){
      var j=res.j||{};
      reviewsTotal=Number(j.total||0);
      var summary=j.summary;
      if(summary&&summary.total){
        reviewUi.summary.hidden=false;
        reviewUi.summary.innerHTML='<span style="font-size:1.5rem;font-weight:700">'+esc(String(summary.average))+'/5</span><span class="pw-pdp-star">'+stars(summary.average)+'</span><span class="pw-shop-muted">('+esc(String(summary.total))+' '+esc(COPY.reviewsTotalSuffix)+')</span>';
      }else{
        reviewUi.summary.hidden=true;
        reviewUi.summary.innerHTML='';
      }
      paintReviews(j.reviews||[],append);
    });
  }
  function loadQuestions(page,append){
    return apiFetch(API_PREFIX+encodeURIComponent(id)+'/questions?page='+page+'&pageSize=10').then(function(res){
      var j=res.j||{};
      questionsTotal=Number(j.total||0);
      paintQuestions(j.questions||[],append);
    });
  }
  apiFetch(API_PREFIX+encodeURIComponent(id)+'/options').then(function(res){
    if(res.ok&&res.j&&res.j.options)applyOptions(res.j.options);
  }).catch(function(){});
  loadReviews(1,false).catch(function(){});
  loadQuestions(1,false).catch(function(){});
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
      var src=thumbImg&&thumbImg.getAttribute('src');
      if(src){
        document.querySelectorAll('[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img,[data-pw-region="gallery"] .pw-shop-product-img').forEach(function(main){
          main.setAttribute('src',src);
          main.classList.remove('pw-pdp-hero-img-hidden');
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
    var vote=t.closest('[data-pw-review-vote]');
    if(vote){
      ev.preventDefault();
      var rid=vote.getAttribute('data-pw-review-vote');
      apiFetch(API_PREFIX+encodeURIComponent(id)+'/reviews/'+encodeURIComponent(rid)+'/vote',{method:'POST'}).then(function(res){
        if(!res.ok||!res.j||!res.j.ok)return;
        vote.textContent='👍 '+COPY.reviewsUsefulLabel+' ('+String(res.j.usefulCount||0)+')';
      });
      return;
    }
    if(t.closest('[data-pw-review-submit]')){
      ev.preventDefault();
      var form=reviewSec.querySelector('[data-pw-pdp-slot="review-form"]');
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
      var qaForm=qaSec.querySelector('[data-pw-pdp-slot="qa-form"]');
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
  });
}
var id=productId();
if(!id)return;
trackView(id);
bindLive(id);
fetch(API_PREFIX+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
  if(j&&j.product)apply(j.product);
}).catch(function(){});
})();</script>`
}
