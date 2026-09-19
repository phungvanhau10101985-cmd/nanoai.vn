/**
 * Immediate tap acknowledgement for every SaaS shop storefront.
 * Parser-blocking: customers see that a press registered even before React /
 * runtime scripts finish, so they do not mash the same control 2–3 times.
 */
export const PW_SHOP_TAP_ACK_STYLE_ID = 'pw-tap-ack-css'
export const PW_SHOP_TAP_ACK_STORAGE_KEY = 'pw_tap_ack_nav_v1'

const HIT_SEL = [
  'a[href]',
  'button',
  '[role="button"]',
  'summary',
  '[data-pw-chrome-btn]',
  '[data-pw-add-cart]',
  '[data-pw-pdp-add-cart]',
  '[data-pw-buy]',
  '[data-pw-favorite]',
  '[data-pw-react-fav]',
  '.pw-rec-fav',
  '[data-pw-cat-toggle]',
  '[data-pw-el="cat-toggle"]',
  '[data-pw-el="card"]',
  '[data-pw-el="cta"]',
  '[data-pw-el="submit"]',
  '.pw-product-card',
  '.pw-product-card-hit',
  '[data-pw-grid-more]',
  '[data-pw-slide-prev]',
  '[data-pw-slide-next]',
  '[data-pw-head-back]',
  '[data-nanoai-open-chat]',
  '[data-nanoai-try-on]',
  '[data-pw-image-search]',
  '[type="submit"]',
].join(',')

export const PW_SHOP_TAP_ACK_CSS = `
#pw-tap-ack-bar{position:fixed;top:0;left:0;right:0;height:3px;z-index:10050;pointer-events:none;display:none;overflow:hidden;background:color-mix(in srgb,var(--pw-primary,#111827) 22%,transparent)}
html[data-pw-nav-pending] #pw-tap-ack-bar,html[data-pw-tap-loading] #pw-tap-ack-bar{display:block}
#pw-tap-ack-bar>i{display:block;height:100%;width:38%;border-radius:999px;background:var(--pw-primary,#111827);animation:pw-tap-ack-bar 1s ease-in-out infinite}
#pw-tap-ack-veil{position:fixed;inset:0;z-index:10048;display:none;align-items:center;justify-content:center;background:color-mix(in srgb,#fff 55%,transparent);pointer-events:none}
html[data-pw-nav-pending] #pw-tap-ack-veil{display:flex;pointer-events:auto}
#pw-tap-ack-veil[hidden]{display:none!important}
.pw-tap-ack-veil-card{display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 20px;border-radius:16px;background:#fff;box-shadow:0 10px 32px rgba(17,24,39,.16);color:#111827;font:600 13px/1.35 var(--pw-font-ui,system-ui)}
.pw-tap-ack-spin{width:22px;height:22px;border-radius:999px;border:2px solid color-mix(in srgb,var(--pw-primary,#111827) 22%,#e5e7eb);border-top-color:var(--pw-primary,#111827);animation:pw-tap-ack-spin .7s linear infinite}
#pw-tap-ack-toast{position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:10046;pointer-events:none;display:none;max-width:min(92vw,360px);padding:10px 16px;border-radius:999px;background:rgba(17,24,39,.92);color:#fff;font:600 13px/1.3 var(--pw-font-ui,system-ui);text-align:center;box-shadow:0 8px 24px rgba(17,24,39,.28)}
html[data-pw-tap-toast] #pw-tap-ack-toast{display:block}
#pw-tap-ack-layer{position:fixed;inset:0;z-index:10044;pointer-events:none;overflow:visible}
.pw-tap-ack-ripple{position:absolute;width:42px;height:42px;margin:-21px 0 0 -21px;border-radius:999px;background:color-mix(in srgb,var(--pw-primary,#111827) 32%,transparent);animation:pw-tap-ack-ripple .42s ease-out forwards}
[data-pw-tapped="1"]{filter:brightness(.9);outline:2px solid color-mix(in srgb,var(--pw-primary,#111827) 45%,transparent);outline-offset:-2px}
html[data-pw-nav-pending],html[data-pw-tap-loading]{cursor:progress}
body.nanoai-ve-active #pw-tap-ack-bar,body.nanoai-ve-active #pw-tap-ack-veil,body.nanoai-ve-active #pw-tap-ack-toast,body.nanoai-ve-active #pw-tap-ack-layer{display:none!important}
@keyframes pw-tap-ack-bar{0%{transform:translateX(-120%)}50%{transform:translateX(160%)}100%{transform:translateX(280%)}}
@keyframes pw-tap-ack-spin{to{transform:rotate(360deg)}}
@keyframes pw-tap-ack-ripple{0%{transform:scale(.55);opacity:.55}100%{transform:scale(2.35);opacity:0}}
@media (prefers-reduced-motion:reduce){
#pw-tap-ack-bar>i,.pw-tap-ack-spin,.pw-tap-ack-ripple{animation-duration:.01ms!important;animation-iteration-count:1!important}
}
`.trim()

const COPY: Record<string, { received: string; opening: string }> = {
  vi: { received: 'Đã nhận thao tác', opening: 'Đang mở trang…' },
  en: { received: 'Tap received', opening: 'Opening page…' },
  zh: { received: '已收到点击', opening: '正在打开页面…' },
  ja: { received: '操作を受け付けました', opening: 'ページを開いています…' },
  ko: { received: '입력을 받았습니다', opening: '페이지를 여는 중…' },
}

export function buildPartnerSiteTapAckScript(): string {
  return `(function(){
  if(window.__pwTapAckBound)return;
  window.__pwTapAckBound=1;
  var HIT=${JSON.stringify(HIT_SEL)};
  var CSS=${JSON.stringify(PW_SHOP_TAP_ACK_CSS)};
  var KEY=${JSON.stringify(PW_SHOP_TAP_ACK_STORAGE_KEY)};
  var COPY=${JSON.stringify(COPY)};
  var STYLE_ID=${JSON.stringify(PW_SHOP_TAP_ACK_STYLE_ID)};
  var doc=window.document;
  var tapped=null;
  var tapTimer=0;
  var toastTimer=0;
  var navTimer=0;
  var lastDownEl=null;
  var lastDownAt=0;
  var shownAt=0;
  var hideTimer=0;
  function editorOff(){
    try{
      var b=doc&&doc.body;
      return !!(b&&b.classList&&b.classList.contains('nanoai-ve-active'));
    }catch(_){return false}
  }
  function htmlEl(){return doc&&doc.documentElement?doc.documentElement:null}
  function pageReady(){
    if(!doc)return true;
    return doc.readyState==='complete';
  }
  function copy(){
    var lang='vi';
    try{
      lang=String((htmlEl()&&htmlEl().lang)||doc.documentElement.lang||'').toLowerCase().slice(0,2);
    }catch(_){}
    return COPY[lang]||COPY.vi;
  }
  function ensureCss(){
    if(!doc||doc.getElementById(STYLE_ID))return;
    var st=doc.createElement('style');
    st.id=STYLE_ID;
    st.textContent=CSS;
    (doc.head||doc.documentElement).appendChild(st);
  }
  function host(id,html){
    var el=doc.getElementById(id);
    if(el)return el;
    el=doc.createElement('div');
    el.id=id;
    if(html)el.innerHTML=html;
    (doc.body||doc.documentElement).appendChild(el);
    return el;
  }
  function ensureHosts(){
    if(!doc||!doc.documentElement)return;
    ensureCss();
    host('pw-tap-ack-bar','<i></i>');
    var veil=host('pw-tap-ack-veil','<div class="pw-tap-ack-veil-card"><span class="pw-tap-ack-spin" aria-hidden="true"></span><span data-pw-tap-ack-label></span></div>');
    veil.setAttribute('role','status');
    veil.setAttribute('aria-live','polite');
    host('pw-tap-ack-toast','');
    host('pw-tap-ack-layer','');
    paintCopy();
  }
  function paintCopy(){
    var t=copy();
    var label=doc.getElementById('pw-tap-ack-veil')&&doc.getElementById('pw-tap-ack-veil').querySelector('[data-pw-tap-ack-label]');
    if(label)label.textContent=t.opening;
    var toast=doc.getElementById('pw-tap-ack-toast');
    if(toast&&!toast.getAttribute('data-pw-tap-ack-custom'))toast.textContent=t.received;
  }
  function hit(node){
    if(!node||typeof node.closest!=='function')return null;
    if(node.closest('input,textarea,select,option,[contenteditable="true"]'))return null;
    return node.closest(HIT);
  }
  function clearTap(){
    if(!tapped)return;
    try{tapped.removeAttribute('data-pw-tapped')}catch(_){}
    tapped=null;
    if(tapTimer){window.clearTimeout(tapTimer);tapTimer=0}
  }
  function ripple(x,y){
    var layer=doc.getElementById('pw-tap-ack-layer');
    if(!layer)return;
    var dot=doc.createElement('span');
    dot.className='pw-tap-ack-ripple';
    dot.style.left=x+'px';
    dot.style.top=y+'px';
    layer.appendChild(dot);
    window.setTimeout(function(){try{dot.remove()}catch(_){}},480);
  }
  function showToast(){
    var root=htmlEl();
    if(!root)return;
    paintCopy();
    root.setAttribute('data-pw-tap-toast','1');
    if(toastTimer)window.clearTimeout(toastTimer);
    toastTimer=window.setTimeout(function(){
      try{root.removeAttribute('data-pw-tap-toast')}catch(_){}
    },pageReady()?1400:2200);
  }
  function setLoading(on){
    var root=htmlEl();
    if(!root)return;
    if(on)root.setAttribute('data-pw-tap-loading','1');
    else root.removeAttribute('data-pw-tap-loading');
  }
  function navStart(){
    if(editorOff())return;
    ensureHosts();
    var root=htmlEl();
    if(!root)return;
    paintCopy();
    shownAt=Date.now();
    if(hideTimer){window.clearTimeout(hideTimer);hideTimer=0}
    root.setAttribute('data-pw-nav-pending','1');
    try{window.sessionStorage.setItem(KEY,'1')}catch(_){}
    if(navTimer)window.clearTimeout(navTimer);
    navTimer=window.setTimeout(navEnd,8000);
  }
  function reallyEnd(){
    var root=htmlEl();
    if(navTimer){window.clearTimeout(navTimer);navTimer=0}
    if(hideTimer){window.clearTimeout(hideTimer);hideTimer=0}
    try{window.sessionStorage.removeItem(KEY)}catch(_){}
    if(!root)return;
    root.removeAttribute('data-pw-nav-pending');
    setLoading(false);
  }
  function navEnd(){
    var wait=180-(Date.now()-shownAt);
    if(shownAt&&wait>0){
      if(hideTimer)window.clearTimeout(hideTimer);
      hideTimer=window.setTimeout(reallyEnd,wait);
      return;
    }
    reallyEnd();
  }
  function busy(){
    var root=htmlEl();
    if(!root)return false;
    return root.hasAttribute('data-pw-nav-pending')||root.hasAttribute('data-pw-tap-loading');
  }
  function isDup(el){
    var now=Date.now();
    if(el&&el===lastDownEl&&now-lastDownAt<650)return true;
    lastDownEl=el||lastDownEl;
    lastDownAt=now;
    return false;
  }
  function press(event){
    if(editorOff()||!doc)return false;
    if(event&&event.button!=null&&event.button!==0)return false;
    ensureHosts();
    var origin=event&&event.target;
    var el=hit(origin);
    if(!el)return false;
    clearTap();
    tapped=el;
    try{el.setAttribute('data-pw-tapped','1')}catch(_){}
    ripple(event.clientX||0,event.clientY||0);
    tapTimer=window.setTimeout(clearTap,280);
    if(!pageReady())showToast();
    return isDup(el);
  }
  function resume(){
    if(editorOff()||!doc)return;
    var pending=false;
    try{pending=window.sessionStorage.getItem(KEY)==='1'}catch(_){}
    ensureHosts();
    if(pending)navStart();
    if(pageReady())reallyEnd();
  }
  window.__pwShopTapAckPress=press;
  window.__pwShopTapAckNav=navStart;
  window.__pwShopTapAckNavEnd=navEnd;
  window.__pwShopTapAckBusy=busy;
  window.__pwShopTapAckDup=isDup;
  if(!doc)return;
  function onReady(){
    reallyEnd();
  }
  if(doc.readyState==='complete')onReady();
  else{
    window.addEventListener('DOMContentLoaded',function(){if(doc.readyState==='interactive')paintCopy()},true);
    window.addEventListener('load',onReady,true);
  }
  window.addEventListener('pageshow',function(){if(pageReady())reallyEnd()},true);
  window.addEventListener('pointercancel',clearTap,true);
  window.addEventListener('pointerup',function(){window.setTimeout(clearTap,180)},true);
  try{resume()}catch(_){}
})();`
}
