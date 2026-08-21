/** Viewport-fixed chrome: Chat mua / Zalo / Facebook / Top up — đặt đâu nổi đó. */

export const PW_CHROME_FLOAT_ATTR = 'data-pw-chrome-float'
/** Any Sửa nhanh element pinned to the viewport (scrolls stay, swipe does not drag it). */
export const PW_PIN_SCREEN_ATTR = 'data-pw-pin-screen'
export const PW_CHROME_FLOAT_SCRIPT_ID = 'pw-shop-chrome-float'
export const PW_CHROME_TOPUP_ON_CLASS = 'pw-chrome-topup-on'
export const PW_CHROME_TOPUP_SCROLL_PX = 240
/** Above header (200), bottom nav (180), lightbox (200) — chat/topup/Zalo/FB floats stay clickable. */
export const PW_CHROME_FLOAT_Z_INDEX = 9999

export const PW_CHROME_FLOAT_KINDS = ['chat', 'chat-zalo', 'chat-facebook', 'topup'] as const
export type PwChromeFloatKind = (typeof PW_CHROME_FLOAT_KINDS)[number]

export const PW_CHROME_FLOAT_DEFAULT_RIGHT_PX = 16
export const PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX: Record<PwChromeFloatKind, number> = {
  chat: 88,
  'chat-zalo': 144,
  'chat-facebook': 200,
  topup: 256,
}

export function isChromeFloatKind(kind: string | null | undefined): kind is PwChromeFloatKind {
  return (PW_CHROME_FLOAT_KINDS as readonly string[]).includes(String(kind || ''))
}

export function chromeFloatDefaultBottomPx(kind: string | null | undefined): number {
  if (isChromeFloatKind(kind)) return PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX[kind]
  return PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.topup
}

const FLOAT_BTN_RE = new RegExp(
  `data-pw-chrome-btn=["'](?:${PW_CHROME_FLOAT_KINDS.join('|')})["']`,
  'i'
)

/** Drop leftover Desktop px pins when seeding a narrower machine (laptop). */
export function resetChromeFloatUserMoveInHtml(html: string): string {
  return html.replace(/<(a|button)\b([^>]*)>/gi, (full, tag: string, attrs: string) => {
    if (!FLOAT_BTN_RE.test(attrs)) return full
    if (!/\bdata-pw-user-move=|\bdata-pw-chrome-float=/i.test(attrs)) return full
    let next = attrs.replace(/\sdata-pw-user-move=(["'])[^"']*\1/gi, '')
    next = next.replace(/\sstyle=(["'])([\s\S]*?)\1/i, (_m, q: string, css: string) => {
      const cleaned = String(css)
        .replace(/(?:^|;)\s*(?:left|top|right|bottom|transform)\s*:[^;]*/gi, '')
        .replace(/^;+|;+$/g, '')
        .trim()
      return cleaned ? ` style=${q}${cleaned}${q}` : ''
    })
    return `<${tag}${next}>`
  })
}

/** Shared live + Sửa nhanh JS: keep Tư vấn / chat floats on-screen when laptop ↔ desktop width changes. */
export const PARTNER_SHOP_CHROME_FLOAT_POS_JS = `function pwChromeFloatViewSize(){
  var w=window.innerWidth||(document.documentElement&&document.documentElement.clientWidth)||1280;
  var h=window.innerHeight||(document.documentElement&&document.documentElement.clientHeight)||720;
  if(w<1)w=1280;if(h<1)h=720;
  return {w:w,h:h};
}
function pwChromeFloatDefaultBottom(kind){
  if(kind==='chat')return ${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.chat};
  if(kind==='chat-zalo')return ${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX['chat-zalo']};
  if(kind==='chat-facebook')return ${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX['chat-facebook']};
  return ${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.topup};
}
function pwChromeFloatSeatDefault(el){
  if(!el||!el.style)return;
  var kind=el.getAttribute?String(el.getAttribute('data-pw-chrome-btn')||''):'';
  el.style.setProperty('position','fixed','important');
  el.style.setProperty('left','auto','important');
  el.style.setProperty('top','auto','important');
  el.style.setProperty('right','${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX}px','important');
  el.style.setProperty('bottom',pwChromeFloatDefaultBottom(kind)+'px','important');
  el.style.setProperty('transform','none','important');
  el.style.setProperty('margin','0','important');
  el.style.setProperty('z-index','${PW_CHROME_FLOAT_Z_INDEX}','important');
}
function pwChromeFloatBakePct(el){
  if(!el||!el.style)return;
  var r=el.getBoundingClientRect();
  var view=pwChromeFloatViewSize();
  var leftPct=Math.max(0,Math.min(100,(r.left/view.w)*100));
  var topPct=Math.max(0,Math.min(100,(r.top/view.h)*100));
  el.style.setProperty('position','fixed','important');
  el.style.setProperty('left',leftPct.toFixed(2)+'%','important');
  el.style.setProperty('top',topPct.toFixed(2)+'%','important');
  el.style.setProperty('right','auto','important');
  el.style.setProperty('bottom','auto','important');
  el.style.setProperty('transform','none','important');
  el.style.setProperty('margin','0','important');
}
function pwChromeFloatRemap(el){
  if(!el||!el.style)return;
  var view=pwChromeFloatViewSize();
  var leftRaw=String(el.style.left||'');
  var topRaw=String(el.style.top||'');
  var left=parseFloat(leftRaw);
  var top=parseFloat(topRaw);
  var w=el.offsetWidth||56;
  var h=el.offsetHeight||56;
  if(leftRaw.indexOf('px')>=0&&isFinite(left)){
    if(left+w>view.w-8||left<0){
      el.style.setProperty('left','auto','important');
      el.style.setProperty('right','16px','important');
    }else{
      el.style.setProperty('left',(Math.max(0,Math.min(100,(left/view.w)*100))).toFixed(2)+'%','important');
    }
  }
  if(topRaw.indexOf('px')>=0&&isFinite(top)){
    if(top+h>view.h-8||top<0){
      el.style.setProperty('top','auto','important');
      el.style.setProperty('bottom','88px','important');
    }else{
      el.style.setProperty('top',(Math.max(0,Math.min(100,(top/view.h)*100))).toFixed(2)+'%','important');
    }
  }
}`

export const PARTNER_SHOP_CHROME_FLOAT_CSS = `
[${PW_CHROME_FLOAT_ATTR}="1"],[${PW_PIN_SCREEN_ATTR}="1"]{position:fixed!important;z-index:${PW_CHROME_FLOAT_Z_INDEX}!important;isolation:isolate!important;margin:0!important;flex:0 0 auto!important;max-width:none!important;max-height:none!important;pointer-events:auto!important}
[${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]){left:auto!important;top:auto!important;right:${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX}px!important}
[data-pw-chrome-btn="chat"][${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]){bottom:${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.chat}px!important}
[data-pw-chrome-btn="chat-zalo"][${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]){bottom:${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX['chat-zalo']}px!important}
[data-pw-chrome-btn="chat-facebook"][${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]){bottom:${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX['chat-facebook']}px!important}
[data-pw-chrome-btn="topup"][${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]){bottom:${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.topup}px!important}
[${PW_CHROME_FLOAT_ATTR}="1"].pw-chrome-icon-only,[${PW_CHROME_FLOAT_ATTR}="1"].pw-chrome-icon-square{
  width:calc(var(--pw-chrome-size,22px) + 14px)!important;height:calc(var(--pw-chrome-size,22px) + 14px)!important;
  min-width:calc(var(--pw-chrome-size,22px) + 14px)!important;min-height:calc(var(--pw-chrome-size,22px) + 14px)!important;
  padding:0!important
}
[data-pw-chrome-btn="topup"]{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
[data-pw-chrome-btn="topup"].${PW_CHROME_TOPUP_ON_CLASS},
[data-pw-chrome-btn="topup"][data-nanoai-ve-selected],
[data-pw-chrome-btn="topup"].nanoai-ve-highlight{opacity:1!important;visibility:visible!important;pointer-events:auto!important}
[data-pw-chrome-btn][data-pw-float-dup="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important}
`.trim()

export const PARTNER_SHOP_CHROME_FLOAT_SCRIPT = `(function(){
  if (window.__pwChromeFloatBound) return;
  window.__pwChromeFloatBound = 1;
  var ATTR = '${PW_CHROME_FLOAT_ATTR}';
  var PIN = '${PW_PIN_SCREEN_ATTR}';
  var ON = '${PW_CHROME_TOPUP_ON_CLASS}';
  var KINDS = ${JSON.stringify(PW_CHROME_FLOAT_KINDS)};
  var THRESH = ${PW_CHROME_TOPUP_SCROLL_PX};
  ${PARTNER_SHOP_CHROME_FLOAT_POS_JS}
  function bake(el){
    if (!el || !el.setAttribute) return;
    if (el.getAttribute('data-pw-float-dup') === '1') return;
    var placed = el.getAttribute('data-pw-user-move') === '1';
    el.setAttribute(ATTR, '1');
    if (el.style) el.style.setProperty('z-index', '${PW_CHROME_FLOAT_Z_INDEX}', 'important');
    /* Escape header/main isolation so fixed z-index wins over page sections. */
    try {
      if (el.parentNode && el.parentNode !== document.body) document.body.appendChild(el);
    } catch (errHost) {}
    if (!el.style) return;
    if (!placed) {
      pwChromeFloatSeatDefault(el);
      return;
    }
    pwChromeFloatRemap(el);
  }
  function bakePinned(){
    var nodes=document.querySelectorAll('['+PIN+'="1"]');
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(!el||!el.style)continue;
      try{ if(el.parentNode&&el.parentNode!==document.body) document.body.appendChild(el); }catch(errPin){}
      el.style.setProperty('position','fixed','important');
      el.style.setProperty('z-index','${PW_CHROME_FLOAT_Z_INDEX}','important');
      if(el.getAttribute('data-pw-user-move')==='1') pwChromeFloatRemap(el);
      else pwChromeFloatBakePct(el);
    }
  }
  function rootVisible(el){
    if(!el||!el.closest)return true;
    var wrap=el.closest('.pw-visual-desktop,.pw-visual-laptop,.pw-visual-tablet,.pw-visual-mobile');
    if(!wrap)return true;
    try{
      var cs=window.getComputedStyle(wrap);
      if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')return false;
    }catch(errVis){}
    return true;
  }
  function dedupeFloats(){
    for(var ki=0;ki<KINDS.length;ki++){
      var kind=KINDS[ki];
      var nodes=document.querySelectorAll('[data-pw-chrome-btn="'+kind+'"]');
      var kept=null;
      for(var i=0;i<nodes.length;i++){
        var el=nodes[i];
        if(!rootVisible(el)||el.getAttribute('data-pw-float-dup')==='1'){
          el.style.setProperty('display','none','important');
          el.style.setProperty('visibility','hidden','important');
          el.style.setProperty('pointer-events','none','important');
          el.setAttribute('data-pw-float-dup','1');
          continue;
        }
        if(!kept){kept=el;continue;}
        el.style.setProperty('display','none','important');
        el.style.setProperty('visibility','hidden','important');
        el.style.setProperty('pointer-events','none','important');
        el.setAttribute('data-pw-float-dup','1');
      }
    }
  }
  function stamp(){
    for (var i = 0; i < KINDS.length; i++) {
      var nodes = document.querySelectorAll('[data-pw-chrome-btn="' + KINDS[i] + '"]');
      for (var n = 0; n < nodes.length; n++) {
        if (nodes[n].getAttribute('data-pw-float-dup') === '1') continue;
        if (!rootVisible(nodes[n])) continue;
        bake(nodes[n]);
      }
    }
    bakePinned();
  }
  function pageY(){
    var y = window.pageYOffset || window.scrollY || 0;
    var de = document.documentElement;
    var body = document.body;
    var se = document.scrollingElement;
    if (de && de.scrollTop > y) y = de.scrollTop;
    if (body && body.scrollTop > y) y = body.scrollTop;
    if (se && se.scrollTop > y) y = se.scrollTop;
    try {
      if (window.visualViewport && window.visualViewport.pageTop > y) y = window.visualViewport.pageTop;
    } catch (eVv) {}
    return y;
  }
  function thresh(){
    var h = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
    if (h > 0 && h < 900) return Math.min(THRESH, Math.max(80, Math.round(h * 0.35)));
    return THRESH;
  }
  function syncTopup(){
    var y = pageY();
    var nodes = document.querySelectorAll('[data-pw-chrome-btn="topup"]');
    var show = y > thresh();
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('data-pw-float-dup') === '1') continue;
      if (show) nodes[i].classList.add(ON);
      else nodes[i].classList.remove(ON);
    }
  }
  function onClick(e){
    if (document.body && document.body.classList.contains('nanoai-ve-active')) return;
    var t = e.target && e.target.closest ? e.target.closest('[data-pw-chrome-btn="topup"]') : null;
    if (!t) return;
    e.preventDefault();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (err) { window.scrollTo(0, 0); }
  }
  var raf = 0;
  function onScroll(){
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; syncTopup(); });
  }
  window.__pwChromeTopupSync = syncTopup;
  dedupeFloats();
  stamp();
  window.addEventListener('resize', function(){
    for (var i = 0; i < KINDS.length; i++) {
      var nodes = document.querySelectorAll('[data-pw-chrome-btn="' + KINDS[i] + '"][data-pw-user-move="1"]');
      for (var n = 0; n < nodes.length; n++) pwChromeFloatRemap(nodes[n]);
    }
    var pinned=document.querySelectorAll('['+PIN+'="1"]');
    for(var p=0;p<pinned.length;p++) pwChromeFloatRemap(pinned[p]);
  });
  document.addEventListener('click', onClick, true);
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('touchmove', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ dedupeFloats(); stamp(); syncTopup(); });
  else syncTopup();
  var mo=typeof MutationObserver!=='undefined'?new MutationObserver(function(){
    dedupeFloats();
    stamp();
    syncTopup();
  }):null;
  if(mo)mo.observe(document.documentElement,{childList:true,subtree:true});
})();`
