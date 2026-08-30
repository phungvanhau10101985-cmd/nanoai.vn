/** Viewport-fixed chrome: Chat mua / Zalo / Facebook / Top up — đặt đâu nổi đó. */

import { PW_PLACEMENT_ATTR } from '@/lib/partner-website/visual-editor/pw-coordinate-space'

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
export const PW_FLOAT_EDGE_MIN = 0
export const PW_FLOAT_EDGE_MAX = 1600
export const PW_FLOAT_RIGHT_ATTR = 'data-pw-float-right'
export const PW_FLOAT_BOTTOM_ATTR = 'data-pw-float-bottom'
export const PW_FLOAT_STACK_BOTTOM_ATTR = 'data-pw-float-stack-bottom'
export const PW_FLOAT_GAP_ATTR = 'data-pw-float-gap'
export const PW_FLOAT_GAP_MIN = 36
export const PW_FLOAT_GAP_MAX = 200
export const PW_FLOAT_GAP_DEFAULT = 56
/** Cỡ icon nổi chung (px) — mọi nút Chat / Zalo / Facebook / Top cùng một vòng tròn. */
export const PW_FLOAT_SIZE_ATTR = 'data-pw-float-size'
export const PW_FLOAT_SIZE_MIN = 16
export const PW_FLOAT_SIZE_MAX = 200
export const PW_FLOAT_SIZE_DEFAULT = 40

export function clampChromeFloatEdge(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 0
  return Math.max(PW_FLOAT_EDGE_MIN, Math.min(PW_FLOAT_EDGE_MAX, n))
}

export function clampChromeFloatGap(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_FLOAT_GAP_DEFAULT
  return Math.max(PW_FLOAT_GAP_MIN, Math.min(PW_FLOAT_GAP_MAX, n))
}

export function clampChromeFloatSize(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_FLOAT_SIZE_DEFAULT
  return Math.max(PW_FLOAT_SIZE_MIN, Math.min(PW_FLOAT_SIZE_MAX, n))
}

/**
 * Cột góc màn neo từ dưới: phần tử DOM đầu = đáy cột.
 * Panel Thanh nổi + nút ↑/↓ dùng thứ tự nhìn thấy (trên → dưới).
 */
export function visualOrderOfChromeFloatDom<T>(domOrder: readonly T[]): T[] {
  return domOrder.slice().reverse()
}

export function chromeFloatDomOrderFromVisual<T>(visualOrder: readonly T[]): T[] {
  return visualOrder.slice().reverse()
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
    next = next
      .replace(/\sdata-pw-placement=(["'])[^"']*\1/gi, '')
      .replace(/\sdata-pw-fixed-(?:x|y|w|h)=(["'])[^"']*\1/gi, '')
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
function pwChromeFloatHost(){
  try{
    if(typeof window.__pwViewportFixedHost==='function'){
      var shared=window.__pwViewportFixedHost();
      if(shared)return shared;
    }
  }catch(eShared){}
  return document.body;
}
function pwChromeFloatClampEdge(n){
  n=Math.round(Number(n));
  if(!isFinite(n))n=0;
  if(n<${PW_FLOAT_EDGE_MIN})n=${PW_FLOAT_EDGE_MIN};
  if(n>${PW_FLOAT_EDGE_MAX})n=${PW_FLOAT_EDGE_MAX};
  return n;
}
function pwChromeFloatWriteEdge(el,right,bottom){
  if(!el||!el.setAttribute)return {right:0,bottom:0};
  right=pwChromeFloatClampEdge(right);
  bottom=pwChromeFloatClampEdge(bottom);
  el.setAttribute('${PW_FLOAT_RIGHT_ATTR}',String(right));
  el.setAttribute('${PW_FLOAT_BOTTOM_ATTR}',String(bottom));
  if(el.style){
    el.style.setProperty('--pw-float-right',right+'px');
    el.style.setProperty('--pw-float-bottom',bottom+'px');
  }
  return {right:right,bottom:bottom};
}
function pwChromeFloatEdgeOf(el){
  var kind=el&&el.getAttribute?String(el.getAttribute('data-pw-chrome-btn')||''):'';
  var right=parseInt(el&&el.getAttribute?String(el.getAttribute('${PW_FLOAT_RIGHT_ATTR}')||''):'',10);
  var bottom=parseInt(el&&el.getAttribute?String(el.getAttribute('${PW_FLOAT_BOTTOM_ATTR}')||''):'',10);
  if(isFinite(right)&&isFinite(bottom))return {right:pwChromeFloatClampEdge(right),bottom:pwChromeFloatClampEdge(bottom)};
  if(el&&el.getAttribute&&el.getAttribute('data-pw-user-move')==='1'&&el.getBoundingClientRect){
    try{
      var r=el.getBoundingClientRect();
      var view=pwChromeFloatViewSize();
      return {right:pwChromeFloatClampEdge(view.w-r.right),bottom:pwChromeFloatClampEdge(view.h-r.bottom)};
    }catch(eEdge){}
  }
  return {right:${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX},bottom:pwChromeFloatDefaultBottom(kind)};
}
function pwChromeFloatMoveBy(el,dx,dy){
  if(!el)return;
  var edge=pwChromeFloatEdgeOf(el);
  pwChromeFloatSeatEdge(el,edge.right-(Number(dx)||0),edge.bottom-(Number(dy)||0));
}
function pwChromeFloatDragFrom(el,startRight,startBottom,dx,dy){
  if(!el)return;
  pwChromeFloatSeatEdge(el,(Number(startRight)||0)-(Number(dx)||0),(Number(startBottom)||0)-(Number(dy)||0));
}
function pwChromeFloatSeatEdge(el,right,bottom){
  if(!el||!el.style)return;
  var edge=pwChromeFloatWriteEdge(el,right,bottom);
  el.style.setProperty('position','fixed','important');
  el.style.setProperty('left','auto','important');
  el.style.setProperty('top','auto','important');
  el.style.setProperty('right',edge.right+'px','important');
  el.style.setProperty('bottom',edge.bottom+'px','important');
  el.style.setProperty('transform','none','important');
  el.style.setProperty('margin','0','important');
  el.style.setProperty('z-index','${PW_CHROME_FLOAT_Z_INDEX}','important');
  el.setAttribute('${PW_PLACEMENT_ATTR}','viewport-fixed');
  el.setAttribute('data-pw-fixed-anchor','right-bottom');
  el.setAttribute('data-pw-user-move','1');
}
function pwChromeFloatKitHost(){
  return document.querySelector('[data-pw-chrome-kit="float"],[data-pw-chrome-float-host="1"]');
}
function pwChromeFloatClampGap(n){
  n=Math.round(Number(n));
  if(!isFinite(n))n=${PW_FLOAT_GAP_DEFAULT};
  if(n<${PW_FLOAT_GAP_MIN})n=${PW_FLOAT_GAP_MIN};
  if(n>${PW_FLOAT_GAP_MAX})n=${PW_FLOAT_GAP_MAX};
  return n;
}
function pwChromeFloatClampSize(n){
  n=Math.round(Number(n));
  if(!isFinite(n))n=${PW_FLOAT_SIZE_DEFAULT};
  if(n<${PW_FLOAT_SIZE_MIN})n=${PW_FLOAT_SIZE_MIN};
  if(n>${PW_FLOAT_SIZE_MAX})n=${PW_FLOAT_SIZE_MAX};
  return n;
}
function pwChromeFloatStackRead(){
  var host=pwChromeFloatKitHost();
  var right=${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX};
  var bottom=${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.chat};
  var gap=${PW_FLOAT_GAP_DEFAULT};
  var size=${PW_FLOAT_SIZE_DEFAULT};
  if(host){
    var r=parseInt(String(host.getAttribute('${PW_FLOAT_RIGHT_ATTR}')||''),10);
    var b=parseInt(String(host.getAttribute('${PW_FLOAT_STACK_BOTTOM_ATTR}')||''),10);
    var g=parseInt(String(host.getAttribute('${PW_FLOAT_GAP_ATTR}')||''),10);
    var s=parseInt(String(host.getAttribute('${PW_FLOAT_SIZE_ATTR}')||''),10);
    if(isFinite(r))right=pwChromeFloatClampEdge(r);
    if(isFinite(b))bottom=pwChromeFloatClampEdge(b);
    if(isFinite(g))gap=pwChromeFloatClampGap(g);
    if(isFinite(s))size=pwChromeFloatClampSize(s);
  }
  return {host:host,right:right,bottom:bottom,gap:gap,size:size};
}
function pwChromeFloatStackWrite(right,bottom,gap,size){
  var host=pwChromeFloatKitHost();
  if(!host)return pwChromeFloatStackRead();
  var prev=pwChromeFloatStackRead();
  right=pwChromeFloatClampEdge(right);
  bottom=pwChromeFloatClampEdge(bottom);
  gap=pwChromeFloatClampGap(gap);
  size=size==null?prev.size:pwChromeFloatClampSize(size);
  host.setAttribute('${PW_FLOAT_RIGHT_ATTR}',String(right));
  host.setAttribute('${PW_FLOAT_STACK_BOTTOM_ATTR}',String(bottom));
  host.setAttribute('${PW_FLOAT_GAP_ATTR}',String(gap));
  host.setAttribute('${PW_FLOAT_SIZE_ATTR}',String(size));
  if(host.style){
    host.style.setProperty('--pw-float-right',right+'px');
    host.style.setProperty('--pw-float-stack-bottom',bottom+'px');
    host.style.setProperty('--pw-float-gap',gap+'px');
    host.style.setProperty('--pw-float-size',size+'px');
  }
  return {host:host,right:right,bottom:bottom,gap:gap,size:size};
}
function pwChromeFloatStackItems(){
  var host=pwChromeFloatKitHost();
  var kinds=${JSON.stringify(PW_CHROME_FLOAT_KINDS)};
  var items=[];
  if(!host||!host.querySelectorAll)return items;
  var kids=host.querySelectorAll('[data-pw-chrome-btn]');
  for(var i=0;i<kids.length;i++){
    var kind=String(kids[i].getAttribute('data-pw-chrome-btn')||'');
    if(kinds.indexOf(kind)<0)continue;
    if(kids[i].getAttribute('data-pw-float-dup')==='1')continue;
    items.push(kids[i]);
  }
  return items;
}
function pwChromeFloatSeatStackItem(el,right,bottom){
  if(!el||!el.style)return;
  var edge=pwChromeFloatWriteEdge(el,right,bottom);
  el.style.setProperty('position','fixed','important');
  el.style.setProperty('left','auto','important');
  el.style.setProperty('top','auto','important');
  el.style.setProperty('right',edge.right+'px','important');
  el.style.setProperty('bottom',edge.bottom+'px','important');
  el.style.setProperty('transform','none','important');
  el.style.setProperty('margin','0','important');
  el.style.setProperty('z-index','${PW_CHROME_FLOAT_Z_INDEX}','important');
  el.setAttribute('${PW_PLACEMENT_ATTR}','viewport-fixed');
  el.setAttribute('data-pw-fixed-anchor','right-bottom');
  el.removeAttribute('data-pw-user-move');
  el.removeAttribute('data-pw-fixed-x');
  el.removeAttribute('data-pw-fixed-y');
}
function pwChromeFloatEnsureCircle(el){
  if(!el||!el.setAttribute)return;
  var style=String(el.getAttribute('data-pw-chrome-style')||'').toLowerCase();
  if(style&&style!=='icon')return;
  el.setAttribute('data-pw-chrome-style','icon-circle');
  if(el.classList){
    el.classList.add('pw-chrome-icon-only','pw-chrome-icon-circle');
    el.classList.remove('pw-chrome-icon-square','pw-chrome-has-label','pw-chrome-label-below','pw-chrome-label-left','pw-chrome-link');
  }
  try{
    var labs=el.querySelectorAll?el.querySelectorAll('.pw-chrome-btn-label,.pw-shop-nav-label,.pw-shop-icon-label'):[];
    for(var li=0;li<labs.length;li++){if(labs[li].style)labs[li].style.display='none';}
  }catch(eLab){}
}
function pwChromeFloatApplyIconSize(el,size){
  if(!el||!el.setAttribute)return;
  size=pwChromeFloatClampSize(size);
  el.setAttribute('data-pw-chrome-size',String(size));
  try{el.removeAttribute('data-pw-chrome-w')}catch(eW){}
  try{el.removeAttribute('data-pw-chrome-h')}catch(eH){}
  var px=size+'px';
  if(el.style){
    el.style.setProperty('--pw-chrome-size',px);
    el.style.setProperty('--pw-chrome-w',px);
    el.style.setProperty('--pw-chrome-h',px);
  }
  try{
    var wrap=el.querySelector?el.querySelector('.pw-chrome-icon-wrap'):null;
    if(wrap&&wrap.style){
      wrap.style.setProperty('width',px,'important');
      wrap.style.setProperty('height',px,'important');
      wrap.style.setProperty('max-width',px,'important');
      wrap.style.setProperty('max-height',px,'important');
    }
    var glyphs=el.querySelectorAll?el.querySelectorAll('.pw-chrome-icon-wrap svg,.pw-chrome-icon-wrap img,.pw-chrome-chat-logo,.pw-chrome-brand-logo'):[];
    for(var gi=0;gi<glyphs.length;gi++){
      var g=glyphs[gi];
      var tag=String(g.tagName||'').toLowerCase();
      if(g.setAttribute&&(tag==='svg'||tag==='img')){
        g.setAttribute('width',String(size));
        g.setAttribute('height',String(size));
      }
      if(g.style){
        g.style.setProperty('width',px,'important');
        g.style.setProperty('height',px,'important');
        g.style.setProperty('max-width',px,'important');
        g.style.setProperty('max-height',px,'important');
      }
    }
  }catch(eGlyph){}
}
function pwChromeFloatMigrateStack(host){
  if(!host)return;
  var hasStack=!!(host.getAttribute('${PW_FLOAT_STACK_BOTTOM_ATTR}')&&host.getAttribute('${PW_FLOAT_GAP_ATTR}'));
  var hasSize=!!host.getAttribute('${PW_FLOAT_SIZE_ATTR}');
  if(hasStack&&hasSize)return;
  var items=pwChromeFloatStackItems();
  var right=${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX};
  var bottoms=[];
  var size=${PW_FLOAT_SIZE_DEFAULT};
  for(var i=0;i<items.length;i++){
    var edge=pwChromeFloatEdgeOf(items[i]);
    if(i===0)right=edge.right;
    bottoms.push(edge.bottom);
    if(!hasSize&&i===0){
      var rawSize=parseInt(String(items[i].getAttribute('data-pw-chrome-size')||''),10);
      if(isFinite(rawSize))size=pwChromeFloatClampSize(rawSize);
    }
  }
  bottoms.sort(function(a,b){return a-b;});
  var bottom=bottoms.length?bottoms[0]:${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.chat};
  var gap=${PW_FLOAT_GAP_DEFAULT};
  if(bottoms.length>=2)gap=pwChromeFloatClampGap(bottoms[1]-bottoms[0]);
  if(hasStack){
    var cur=pwChromeFloatStackRead();
    right=cur.right;bottom=cur.bottom;gap=cur.gap;
  }
  if(!hasSize){for(var c=0;c<items.length;c++)pwChromeFloatEnsureCircle(items[c]);}
  pwChromeFloatStackWrite(right,bottom,gap,size);
}
function pwChromeFloatEscapeScaledRoot(host){
  if(!host||!host.closest)return host;
  try{
    if(document.body&&document.body.classList.contains('nanoai-ve-active'))return host;
  }catch(eVe){}
  var scaled=host.closest('[data-pw-inline-visual-root]');
  if(!scaled)return host;
  var dest=pwChromeFloatHost();
  if(dest&&host.parentNode!==dest){
    try{dest.appendChild(host)}catch(eEsc){}
  }
  return host;
}
function pwChromeFloatApplyStack(){
  var host=pwChromeFloatEscapeScaledRoot(pwChromeFloatKitHost());
  if(!host)return pwChromeFloatStackRead();
  pwChromeFloatMigrateStack(host);
  var st=pwChromeFloatStackRead();
  st=pwChromeFloatStackWrite(st.right,st.bottom,st.gap,st.size);
  var items=pwChromeFloatStackItems();
  var vis=0;
  var ve=!!(document.body&&document.body.classList.contains('nanoai-ve-active'));
  for(var i=0;i<items.length;i++){
    var el=items[i];
    el.setAttribute('data-pw-chrome-float','1');
    pwChromeFloatApplyIconSize(el,st.size);
    if(el.getAttribute('data-pw-hidden')==='1'){
      el.removeAttribute('data-pw-user-move');
      continue;
    }
    pwChromeFloatSeatStackItem(el,st.right,st.bottom+vis*st.gap);
    vis+=1;
    if(ve&&el.getAttribute('data-pw-chrome-btn')==='topup'&&el.classList)el.classList.add('${PW_CHROME_TOPUP_ON_CLASS}');
  }
  return st;
}
function pwChromeFloatSeatDefault(el){
  if(!el||!el.style)return;
  var kind=el.getAttribute?String(el.getAttribute('data-pw-chrome-btn')||''):'';
  var right=${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX};
  var bottom=pwChromeFloatDefaultBottom(kind);
  el.removeAttribute('data-pw-user-move');
  el.removeAttribute('${PW_FLOAT_RIGHT_ATTR}');
  el.removeAttribute('${PW_FLOAT_BOTTOM_ATTR}');
  if(el.style){
    el.style.removeProperty('--pw-float-right');
    el.style.removeProperty('--pw-float-bottom');
  }
  el.style.setProperty('position','fixed','important');
  el.style.setProperty('left','auto','important');
  el.style.setProperty('top','auto','important');
  el.style.setProperty('right',right+'px','important');
  el.style.setProperty('bottom',bottom+'px','important');
  el.style.setProperty('transform','none','important');
  el.style.setProperty('margin','0','important');
  el.style.setProperty('z-index','${PW_CHROME_FLOAT_Z_INDEX}','important');
  el.setAttribute('${PW_PLACEMENT_ATTR}','viewport-fixed');
  el.setAttribute('data-pw-fixed-anchor','right-bottom');
}
function pwChromeFloatBakePct(el,box){
  if(!el||!el.style)return;
  var r=box;
  if(!r){try{r=el.getBoundingClientRect()}catch(eBox){r=null}}
  if(!r)return;
  var view=pwChromeFloatViewSize();
  var C=window.__pwCoordinate;
  var leftCss;
  var topCss;
  var fx;
  var fy;
  if(C){
    var map=C.createMap({viewportWidth:view.w,originX:view.w/2,originY:0});
    var center=C.rectCenter?C.rectCenter(r):{x:r.left+r.width/2,y:r.top+r.height/2};
    var pt=C.clientToScene(center,map);
    var client=C.sceneToClient(pt,map);
    var tl=C.clientTopLeft?C.clientTopLeft(client,r.width,r.height,1):{x:client.x-r.width/2,y:client.y-r.height/2};
    fx=pt.x;
    fy=pt.y;
    leftCss=tl.x+'px';
    topCss=tl.y+'px';
  }else{
    fx=Math.max(0,Math.min(1,r.left/view.w));
    fy=Math.max(0,Math.min(1,r.top/view.h));
    leftCss=(fx*100).toFixed(2)+'%';
    topCss=(fy*100).toFixed(2)+'%';
  }
  el.style.setProperty('position','fixed','important');
  el.style.setProperty('left',leftCss,'important');
  el.style.setProperty('top',topCss,'important');
  el.style.setProperty('right','auto','important');
  el.style.setProperty('bottom','auto','important');
  el.style.setProperty('transform','none','important');
  el.style.setProperty('margin','0','important');
  el.style.setProperty('z-index','${PW_CHROME_FLOAT_Z_INDEX}','important');
  el.setAttribute('${PW_PLACEMENT_ATTR}','viewport-fixed');
  el.setAttribute('data-pw-fixed-x',String(Math.round(fx*1000)/1000));
  el.setAttribute('data-pw-fixed-y',String(Math.round(fy*1000)/1000));
  if(r.width>0)el.setAttribute('data-pw-fixed-w',String(Math.round(r.width)));
  if(r.height>0)el.setAttribute('data-pw-fixed-h',String(Math.round(r.height)));
  el.removeAttribute('data-pw-fixed-anchor');
}
function pwChromeFloatLiftAndPin(el,box){
  if(!el||!el.style)return;
  var r=box;
  if(!r){try{r=el.getBoundingClientRect()}catch(eLift){r=null}}
  try{
    var host=pwChromeFloatHost();
    if(host&&el.parentNode!==host) host.appendChild(el);
  }catch(eHost){}
  if(r&&(r.width>0||r.height>0)){
    var view=pwChromeFloatViewSize();
    pwChromeFloatWriteEdge(el,view.w-r.right,view.h-r.bottom);
    pwChromeFloatSeatEdge(el,view.w-r.right,view.h-r.bottom);
  }else pwChromeFloatBakePct(el);
}
function pwChromeFloatRemap(el){
  if(!el||!el.style)return;
  if(el.getAttribute&&el.getAttribute('data-pw-fixed-anchor')==='right-bottom'){
    var edge=pwChromeFloatEdgeOf(el);
    el.style.setProperty('position','fixed','important');
    el.style.setProperty('left','auto','important');
    el.style.setProperty('top','auto','important');
    el.style.setProperty('right',edge.right+'px','important');
    el.style.setProperty('bottom',edge.bottom+'px','important');
    el.style.setProperty('transform','none','important');
    el.style.setProperty('margin','0','important');
    el.style.setProperty('z-index','${PW_CHROME_FLOAT_Z_INDEX}','important');
    return;
  }
  var view=pwChromeFloatViewSize();
  var leftRaw=String(el.style.left||'');
  var topRaw=String(el.style.top||'');
  var left=parseFloat(leftRaw);
  var top=parseFloat(topRaw);
  var w=el.offsetWidth||56;
  var h=el.offsetHeight||56;
  if(el.getAttribute&&el.getAttribute('${PW_PLACEMENT_ATTR}')==='viewport-fixed'){
    var fx=parseFloat(el.getAttribute('data-pw-fixed-x')||'');
    var fy=parseFloat(el.getAttribute('data-pw-fixed-y')||'');
    var fw=parseFloat(el.getAttribute('data-pw-fixed-w')||'');
    var fh=parseFloat(el.getAttribute('data-pw-fixed-h')||'');
    var C=window.__pwCoordinate;
    if(isFinite(fx)&&isFinite(fy)&&C&&!(C.looksNorm&&C.looksNorm(fx,fy))){
      var map=C.createMap({viewportWidth:view.w,originX:view.w/2,originY:0});
      var pt=C.sceneToClient({x:fx,y:fy},map);
      var tl=C.clientTopLeft?C.clientTopLeft(pt,fw,fh,map.scale):{x:pt.x-(isFinite(fw)?fw:0)*map.scale/2,y:pt.y-(isFinite(fh)?fh:0)*map.scale/2};
      el.style.setProperty('left',tl.x+'px','important');
      el.style.setProperty('top',tl.y+'px','important');
    }else{
      if(isFinite(fx))el.style.setProperty('left',(Math.max(0,Math.min(1,fx))*100).toFixed(3)+'%','important');
      if(isFinite(fy))el.style.setProperty('top',(Math.max(0,Math.min(1,fy))*100).toFixed(3)+'%','important');
    }
    if(isFinite(fw)&&fw>0)el.style.setProperty('width',Math.round(fw)+'px','important');
    if(isFinite(fh)&&fh>0)el.style.setProperty('height',Math.round(fh)+'px','important');
    if(isFinite(fx)||isFinite(fy)){
      el.style.setProperty('right','auto','important');
      el.style.setProperty('bottom','auto','important');
      return;
    }
  }
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
[${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-hidden="1"]),[${PW_PIN_SCREEN_ATTR}="1"]:not([data-pw-hidden="1"]){position:fixed!important;z-index:${PW_CHROME_FLOAT_Z_INDEX}!important;isolation:isolate!important;margin:0!important;flex:0 0 auto!important;max-width:none!important;max-height:none!important;pointer-events:auto!important}
[data-pw-chrome-added][${PW_PIN_SCREEN_ATTR}="1"]:not([data-pw-hidden="1"]),[data-pw-chrome-btn][${PW_PIN_SCREEN_ATTR}="1"]:not([data-pw-hidden="1"]){display:inline-flex!important}
[${PW_CHROME_FLOAT_ATTR}="1"][data-pw-fixed-anchor="right-bottom"]:not([data-pw-hidden="1"]){left:auto!important;top:auto!important;right:var(--pw-float-right,${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX}px)!important;bottom:var(--pw-float-bottom,88px)!important}
[${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]):not([${PW_FLOAT_BOTTOM_ATTR}]):not([data-pw-hidden="1"]){left:auto!important;top:auto!important;right:${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX}px!important}
[data-pw-chrome-btn="chat"][${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]):not([${PW_FLOAT_BOTTOM_ATTR}]){bottom:${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.chat}px!important}
[data-pw-chrome-btn="chat-zalo"][${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]):not([${PW_FLOAT_BOTTOM_ATTR}]){bottom:${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX['chat-zalo']}px!important}
[data-pw-chrome-btn="chat-facebook"][${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]):not([${PW_FLOAT_BOTTOM_ATTR}]){bottom:${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX['chat-facebook']}px!important}
[data-pw-chrome-btn="topup"][${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]):not([${PW_FLOAT_BOTTOM_ATTR}]){bottom:${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.topup}px!important}
html [${PW_CHROME_FLOAT_ATTR}="1"][data-pw-hidden="1"],html [data-pw-chrome-kit="float"] [data-pw-hidden="1"],html [${PW_CHROME_FLOAT_ATTR}="1"][data-pw-hidden="1"][data-nanoai-ve-selected],html [${PW_CHROME_FLOAT_ATTR}="1"][data-pw-hidden="1"].nanoai-ve-highlight,html [data-pw-chrome-kit="float"] [data-pw-hidden="1"][data-nanoai-ve-selected]{display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important}
html[data-pw-edit-device] [${PW_CHROME_FLOAT_ATTR}="1"]:not([data-pw-user-move]):not([${PW_FLOAT_RIGHT_ATTR}]):not([data-pw-hidden="1"]){
  right:calc((100vw - var(--pw-scene-w,1440px)) / 2 + ${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX}px)!important
}
[data-pw-chrome-kit="float"] [data-pw-chrome-btn], [data-pw-chrome-float-host="1"] [data-pw-chrome-btn]{
  --pw-chrome-size:var(--pw-float-size,${PW_FLOAT_SIZE_DEFAULT}px);
  --pw-chrome-w:var(--pw-chrome-size);
  --pw-chrome-h:var(--pw-chrome-size)
}
[data-pw-chrome-kit="float"] .pw-chrome-icon-wrap,
[data-pw-chrome-float-host="1"] .pw-chrome-icon-wrap,
[data-pw-chrome-kit="float"] .pw-chrome-icon-wrap svg,
[data-pw-chrome-float-host="1"] .pw-chrome-icon-wrap svg,
[data-pw-chrome-kit="float"] .pw-chrome-icon-wrap img,
[data-pw-chrome-float-host="1"] .pw-chrome-icon-wrap img,
[data-pw-chrome-kit="float"] .pw-chrome-chat-logo,
[data-pw-chrome-float-host="1"] .pw-chrome-chat-logo,
[data-pw-chrome-kit="float"] .pw-chrome-brand-logo,
[data-pw-chrome-float-host="1"] .pw-chrome-brand-logo{
  width:var(--pw-chrome-w,var(--pw-float-size,${PW_FLOAT_SIZE_DEFAULT}px))!important;
  height:var(--pw-chrome-h,var(--pw-float-size,${PW_FLOAT_SIZE_DEFAULT}px))!important;
  max-width:var(--pw-chrome-w,var(--pw-float-size,${PW_FLOAT_SIZE_DEFAULT}px))!important;
  max-height:var(--pw-chrome-h,var(--pw-float-size,${PW_FLOAT_SIZE_DEFAULT}px))!important
}
[${PW_CHROME_FLOAT_ATTR}="1"].pw-chrome-icon-only:not(.pw-chrome-icon-circle):not([data-pw-chrome-style="icon-circle"]),[${PW_CHROME_FLOAT_ATTR}="1"].pw-chrome-icon-square{
  width:auto!important;height:auto!important;
  min-width:0!important;min-height:0!important;
  padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,4px)!important
}
[data-pw-chrome-btn="topup"]{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
[data-pw-chrome-btn="topup"].${PW_CHROME_TOPUP_ON_CLASS},
[data-pw-chrome-btn="topup"][data-nanoai-ve-selected],
[data-pw-chrome-btn="topup"].nanoai-ve-highlight{opacity:1!important;visibility:visible!important;pointer-events:auto!important}
[data-pw-chrome-btn][data-pw-float-dup="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important}
`.trim()

export const PARTNER_SHOP_CHROME_FLOAT_SCRIPT = `(function(){
  if (window.__pwChromeFloatBound) {
    try { if (window.__pwChromeFloatSync) window.__pwChromeFloatSync(); } catch (errRebind) {}
    return;
  }
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
      var host=pwChromeFloatHost();
      if (host && el.parentNode !== host) host.appendChild(el);
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
      if(el.parentNode&&el.parentNode!==pwChromeFloatHost()) pwChromeFloatLiftAndPin(el);
      else {
        el.style.setProperty('position','fixed','important');
        el.style.setProperty('z-index','${PW_CHROME_FLOAT_Z_INDEX}','important');
        if(el.getAttribute('data-pw-user-move')==='1') pwChromeFloatRemap(el);
      }
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
  function pwChromeFloatIsKitHost(el){
    if(!el||!el.closest)return false;
    return !!el.closest('[data-pw-chrome-kit="float"],[data-pw-chrome-float-host="1"]');
  }
  function pwChromeFloatIsHeadDock(el){
    if(!el||!el.closest)return false;
    if(pwChromeFloatIsKitHost(el))return false;
    return !!el.closest('.pw-header-actions,.pw-shop-header-actions,[data-pw-chrome-kit="actions"],.pw-bottom-nav,.pw-shop-bottom-nav,[data-pw-chrome-kit="dock"],header.pw-header,.pw-shop-header,header[data-pw-region="header"]');
  }
  function pwChromeFloatShouldBake(el){
    if(!el||!el.getAttribute)return false;
    if(el.getAttribute('data-pw-float-dup')==='1')return false;
    if(el.getAttribute(ATTR)==='1')return true;
    if(pwChromeFloatIsKitHost(el))return true;
    if(pwChromeFloatIsHeadDock(el))return false;
    return false;
  }
  function pwChromeFloatKeepScore(el){
    if(!el||!el.getAttribute)return -1;
    if(el.getAttribute('data-pw-hidden')==='1')return -1;
    if(!rootVisible(el))return -1;
    var score=0;
    if(pwChromeFloatIsKitHost(el))score+=100;
    if(el.getAttribute(ATTR)==='1')score+=50;
    if(el.getAttribute('data-pw-user-move')==='1')score+=10;
    return score;
  }
  function pwChromeFloatMarkDup(el){
    if(!el||!el.style)return;
    el.style.setProperty('display','none','important');
    el.style.setProperty('visibility','hidden','important');
    el.style.setProperty('pointer-events','none','important');
    el.setAttribute('data-pw-float-dup','1');
  }
  function pwChromeFloatClearDup(el){
    if(!el||!el.getAttribute)return;
    el.removeAttribute('data-pw-float-dup');
    if(el.style){
      el.style.removeProperty('display');
      el.style.removeProperty('visibility');
      el.style.removeProperty('pointer-events');
      el.style.removeProperty('opacity');
    }
  }
  function dedupeFloats(){
    for(var ki=0;ki<KINDS.length;ki++){
      var kind=KINDS[ki];
      var nodes=document.querySelectorAll('[data-pw-chrome-btn="'+kind+'"]');
      var kept=null;
      var keptScore=-1;
      for(var i=0;i<nodes.length;i++){
        var el=nodes[i];
        var score=pwChromeFloatKeepScore(el);
        if(score<0){
          if(!rootVisible(el)) pwChromeFloatMarkDup(el);
          else pwChromeFloatClearDup(el);
          continue;
        }
        if(!kept||score>keptScore){
          if(kept) pwChromeFloatMarkDup(kept);
          kept=el;
          keptScore=score;
          pwChromeFloatClearDup(el);
        }else{
          pwChromeFloatMarkDup(el);
        }
      }
    }
  }
  function stamp(){
    try { pwChromeFloatApplyStack(); } catch (errStack) {}
    for (var i = 0; i < KINDS.length; i++) {
      var nodes = document.querySelectorAll('[data-pw-chrome-btn="' + KINDS[i] + '"]');
      for (var n = 0; n < nodes.length; n++) {
        var el = nodes[n];
        if (el.getAttribute('data-pw-float-dup') === '1') continue;
        if (!rootVisible(el)) continue;
        if (pwChromeFloatIsKitHost(el)) continue;
        if (!pwChromeFloatShouldBake(el)) continue;
        bake(el);
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
      if (nodes[i].getAttribute('data-pw-hidden') === '1') {
        nodes[i].classList.remove(ON);
        continue;
      }
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
  window.__pwChromeFloatSync = function(){ dedupeFloats(); stamp(); syncTopup(); };
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
    try{
      if(document.body&&(document.body.classList.contains('nanoai-ve-dragging')||document.querySelector('[data-nanoai-ve-selected][data-pw-chrome-float="1"]'))){
        syncTopup();
        return;
      }
    }catch(eSkipStamp){}
    dedupeFloats();
    stamp();
    syncTopup();
  }):null;
  if(mo)mo.observe(document.documentElement,{childList:true,subtree:true});
})();`
