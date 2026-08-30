/**
 * Scene origin is always the content canvas (`main`), never body / visual-root.
 *
 * Fashion home used to omit `<main>`, so Sửa nhanh stored Y from body (header +
 * banner). Live hoists header out of the visual root, then applies the same Y
 * from a root that starts at the banner — overlays drop by the header height.
 *
 * One origin: wrap non-chrome children in `<main data-pw-scene-root="1">`,
 * remeasure overlays from that main, then hoist chrome. Editor and live share
 * this function.
 */

import {
  pwRoundLogical,
  pwSceneBoxLeftCss,
  pwSceneBoxTopPx,
  pwSceneWidth,
} from './pw-coordinate-space'

export const PW_SCENE_ROOT_ATTR = 'data-pw-scene-root'
export const PW_SCENE_ORIGIN_ATTR = 'data-pw-scene-origin'
export const PW_SCENE_ORIGIN_CONTENT = 'content'

export const PW_OUTER_SCENE_CHROME_SEL = [
  'header',
  '.pw-header',
  '.pw-shop-header',
  '.pw-topbar',
  '.pw-shop-topbar',
  'footer',
  '.pw-footer',
  '.pw-shop-footer',
  '.pw-bottom-nav',
  '.pw-shop-bottom-nav',
  '.pw-skip',
  'script',
  'style',
  'link',
  'noscript',
  '[data-pw-chrome-kit]',
  '[data-pw-pdp-bottom]',
  '[data-pw-live-chrome]',
  '[data-pw-live-dock]',
  '[data-pw-live-fixed-layer]',
].join(',')

const OUTER_CHROME_REGIONS = new Set(['header', 'topbar', 'footer', 'nav'])

export function isOuterSceneChromeNode(el: Element | null | undefined): boolean {
  if (!el || el.nodeType !== 1) return false
  try {
    if (typeof el.matches === 'function' && el.matches(PW_OUTER_SCENE_CHROME_SEL)) return true
  } catch {
    /* selector not supported in this document */
  }
  const region = el.getAttribute?.('data-pw-region') || ''
  return OUTER_CHROME_REGIONS.has(region)
}

function isBodyOrVisualHost(el: Element): boolean {
  const tag = el.tagName?.toLowerCase() || ''
  if (tag === 'body' || tag === 'html') return true
  return el.getAttribute('data-pw-inline-visual-root') === '1'
}

export function isContentSceneRootCandidate(el: Element | null | undefined): el is HTMLElement {
  if (!el || el.nodeType !== 1) return false
  if (isOuterSceneChromeNode(el) || isBodyOrVisualHost(el)) return false
  const tag = el.tagName?.toLowerCase() || ''
  if (tag === 'main') return true
  const cls = ` ${el.className || ''} `
  return (
    cls.includes(' pw-shop-main ') ||
    cls.includes(' pw-main ') ||
    el.getAttribute(PW_SCENE_ROOT_ATTR) === '1'
  )
}

function findContentMain(root: ParentNode): HTMLElement | null {
  const stamped = root.querySelector?.<HTMLElement>(`[${PW_SCENE_ROOT_ATTR}="1"]`)
  if (stamped && isContentSceneRootCandidate(stamped)) return stamped
  const mains = root.querySelectorAll?.<HTMLElement>('main, .pw-shop-main, .pw-main')
  if (!mains) return null
  for (let i = 0; i < mains.length; i += 1) {
    if (isContentSceneRootCandidate(mains[i])) return mains[i]
  }
  return null
}

export function isSceneAbsoluteOverlay(el: Element | null | undefined): boolean {
  if (!el?.getAttribute) return false
  if (el.getAttribute('data-pw-placement') === 'viewport-fixed') return false
  if (el.getAttribute('data-pw-stay-scroll') === '1') return false
  if (el.getAttribute('data-pw-pin-screen') === '1') return false
  if (el.getAttribute('data-pw-chrome-kit')) return false
  if (el.getAttribute('data-pw-placement') === 'scene-absolute') return true
  if (el.getAttribute('data-pw-chrome-added') === '1' && el.getAttribute('data-pw-box-x')) return true
  if (el.getAttribute('data-pw-added-text') === '1') return true
  if (el.getAttribute('data-pw-added-btn') === '1') return true
  if (el.getAttribute('data-pw-added-image') === '1') return true
  if (el.getAttribute('data-pw-added-video') === '1') return true
  return el.getAttribute('data-pw-added-bg') === '1' && el.getAttribute('data-pw-added-bg-slot') !== '1'
}

function scenePxOf(el: Element): number {
  let raw = ''
  try {
    const doc = el.ownerDocument
    const view = doc?.defaultView
    if (view && doc.documentElement) {
      raw = view.getComputedStyle(doc.documentElement).getPropertyValue('--pw-scene-w')
    }
  } catch {
    raw = ''
  }
  const n = Number.parseFloat(raw)
  if (Number.isFinite(n) && n > 80) return n
  return pwSceneWidth('desktop')
}

function applySceneBox(el: HTMLElement, x: number, y: number, w: number, h: number): void {
  el.style.setProperty('position', 'absolute', 'important')
  el.style.setProperty('left', pwSceneBoxLeftCss(x, w), 'important')
  el.style.setProperty('top', `${pwSceneBoxTopPx(y, h)}px`, 'important')
  el.style.setProperty('right', 'auto', 'important')
  el.style.setProperty('bottom', 'auto', 'important')
  el.style.setProperty('transform', 'none', 'important')
  el.style.setProperty('margin', '0', 'important')
  if (w > 0) el.style.setProperty('width', `${pwRoundLogical(w)}px`, 'important')
  if (h > 0) el.style.setProperty('height', `${pwRoundLogical(h)}px`, 'important')
  el.setAttribute('data-pw-placement', 'scene-absolute')
  el.setAttribute('data-pw-coordinate-root', 'scene')
  el.setAttribute('data-pw-box-x', String(pwRoundLogical(x)))
  el.setAttribute('data-pw-box-y', String(pwRoundLogical(y)))
  if (w > 0) el.setAttribute('data-pw-box-w', String(pwRoundLogical(w)))
  if (h > 0) el.setAttribute('data-pw-box-h', String(pwRoundLogical(h)))
}

function remeasureOverlayToMain(el: HTMLElement, main: HTMLElement): boolean {
  let br: DOMRect
  let sr: DOMRect
  try {
    br = el.getBoundingClientRect()
    sr = main.getBoundingClientRect()
  } catch {
    return false
  }
  if (!(sr.width > 8)) return false
  if (!(br.width > 0 || br.height > 0)) return false
  const scenePx = scenePxOf(main)
  const scale = sr.width / scenePx
  const x = (br.left + br.width / 2 - (sr.left + sr.width / 2)) / scale
  const y = (br.top + br.height / 2 - sr.top) / scale
  if (el.parentElement !== main) {
    try {
      main.appendChild(el)
    } catch {
      return false
    }
  }
  applySceneBox(el, x, y, br.width / scale, br.height / scale)
  return true
}

function collectOverlays(root: ParentNode): HTMLElement[] {
  const out: HTMLElement[] = []
  const nodes = root.querySelectorAll?.<HTMLElement>(
    '[data-pw-placement="scene-absolute"],[data-pw-chrome-added="1"][data-pw-box-x],[data-pw-added-text="1"],[data-pw-added-btn="1"],[data-pw-added-image="1"],[data-pw-added-video="1"],[data-pw-added-bg="1"]'
  )
  if (!nodes) return out
  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i]
    if (!isSceneAbsoluteOverlay(el)) continue
    if (el.closest?.(PW_OUTER_SCENE_CHROME_SEL)) continue
    out.push(el)
  }
  return out
}

/**
 * Find or create `<main data-pw-scene-root="1">` under `root`, move flow
 * content into it, then rewrite overlay boxes from that main. Call this
 * **before** live header hoist so Y is measured while header is still in flow.
 */
export function ensureContentSceneRoot(root: ParentNode | null | undefined): HTMLElement | null {
  if (!root) return null
  const doc = (root as Element).ownerDocument || (root as Document)
  let main = findContentMain(root)
  if (!main) {
    main = doc.createElement('main')
    main.className = 'pw-shop-main'
    const kids = Array.from(root.children)
    const flow = kids.filter((el) => !isOuterSceneChromeNode(el) && !isSceneAbsoluteOverlay(el))
    const firstFlow = flow[0] || null
    if (firstFlow) root.insertBefore(main, firstFlow)
    else root.appendChild(main)
    for (const el of flow) main.appendChild(el)
  }
  const host = root as Element
  if (host !== main && typeof host.getAttribute === 'function' && host.getAttribute(PW_SCENE_ROOT_ATTR) === '1') {
    host.removeAttribute(PW_SCENE_ROOT_ATTR)
  }
  main.setAttribute(PW_SCENE_ROOT_ATTR, '1')
  if (main.getAttribute(PW_SCENE_ORIGIN_ATTR) !== PW_SCENE_ORIGIN_CONTENT) {
    const overlays = collectOverlays(root)
    let measured = overlays.length === 0
    for (const el of overlays) {
      if (remeasureOverlayToMain(el, main)) measured = true
    }
    if (measured) main.setAttribute(PW_SCENE_ORIGIN_ATTR, PW_SCENE_ORIGIN_CONTENT)
  }
  return main
}

/** Runtime copy injected into Sửa nhanh + live. Keep in lockstep with `ensureContentSceneRoot`. */
export const PW_ENSURE_CONTENT_SCENE_ROOT_SOURCE = `function isOuterSceneChromeNode(el){
  if(!el||el.nodeType!==1)return false;
  try{if(el.matches&&el.matches('${PW_OUTER_SCENE_CHROME_SEL}'))return true}catch(eM){}
  var region=el.getAttribute&&el.getAttribute('data-pw-region')||'';
  return region==='header'||region==='topbar'||region==='footer'||region==='nav';
}
function isBodyOrVisualHost(el){
  var tag=(el.tagName||'').toLowerCase();
  return tag==='body'||tag==='html'||(el.getAttribute&&el.getAttribute('data-pw-inline-visual-root')==='1');
}
function isContentSceneRootCandidate(el){
  if(!el||isOuterSceneChromeNode(el)||isBodyOrVisualHost(el))return false;
  var tag=(el.tagName||'').toLowerCase();
  if(tag==='main')return true;
  var cls=' '+(el.className||'')+' ';
  return cls.indexOf(' pw-shop-main ')>=0||cls.indexOf(' pw-main ')>=0||(el.getAttribute&&el.getAttribute('data-pw-scene-root')==='1');
}
function isSceneAbsoluteOverlay(el){
  if(!el||!el.getAttribute)return false;
  if(el.getAttribute('data-pw-placement')==='viewport-fixed')return false;
  if(el.getAttribute('data-pw-stay-scroll')==='1')return false;
  if(el.getAttribute('data-pw-pin-screen')==='1')return false;
  if(el.getAttribute('data-pw-chrome-kit'))return false;
  if(el.getAttribute('data-pw-placement')==='scene-absolute')return true;
  if(el.getAttribute('data-pw-chrome-added')==='1'&&el.getAttribute('data-pw-box-x'))return true;
  if(el.getAttribute('data-pw-added-text')==='1')return true;
  if(el.getAttribute('data-pw-added-btn')==='1')return true;
  if(el.getAttribute('data-pw-added-image')==='1')return true;
  if(el.getAttribute('data-pw-added-video')==='1')return true;
  return el.getAttribute('data-pw-added-bg')==='1'&&el.getAttribute('data-pw-added-bg-slot')!=='1';
}
function applySceneBoxFromCenter(el,x,y,w,h,C){
  if(!el||!el.style)return;
  el.style.setProperty('position','absolute','important');
  el.style.setProperty('left',C&&C.boxLeftCss?C.boxLeftCss(x,w):('calc(50% + '+(x-(w||0)/2)+'px)'),'important');
  el.style.setProperty('top',((C&&C.boxTopPx?C.boxTopPx(y,h):y-(h||0)/2))+'px','important');
  el.style.setProperty('right','auto','important');
  el.style.setProperty('bottom','auto','important');
  el.style.setProperty('transform','none','important');
  el.style.setProperty('margin','0','important');
  if(isFinite(w)&&w>0)el.style.setProperty('width',w+'px','important');
  if(isFinite(h)&&h>0)el.style.setProperty('height',h+'px','important');
  el.setAttribute('data-pw-placement','scene-absolute');
  el.setAttribute('data-pw-coordinate-root','scene');
  el.setAttribute('data-pw-box-x',String(Math.round(x*1000)/1000));
  el.setAttribute('data-pw-box-y',String(Math.round(y*1000)/1000));
  if(isFinite(w)&&w>0)el.setAttribute('data-pw-box-w',String(Math.round(w*1000)/1000));
  if(isFinite(h)&&h>0)el.setAttribute('data-pw-box-h',String(Math.round(h*1000)/1000));
}
function ensureContentSceneRoot(root){
  if(!root||!root.querySelector)return root||null;
  var C=window.__pwCoordinate;
  var main=root.querySelector('[data-pw-scene-root="1"]');
  if(!isContentSceneRootCandidate(main))main=null;
  if(!main){
    var found=root.querySelectorAll('main,.pw-shop-main,.pw-main');
    var fi;
    for(fi=0;fi<found.length;fi++){
      if(isContentSceneRootCandidate(found[fi])){main=found[fi];break}
    }
  }
  if(!main){
    main=document.createElement('main');
    main.className='pw-shop-main';
    var kids=Array.prototype.slice.call(root.children||[]);
    var flow=[],ki;
    for(ki=0;ki<kids.length;ki++){
      if(isOuterSceneChromeNode(kids[ki])||isSceneAbsoluteOverlay(kids[ki]))continue;
      flow.push(kids[ki]);
    }
    var first=flow[0]||null;
    if(first)root.insertBefore(main,first);
    else root.appendChild(main);
    for(ki=0;ki<flow.length;ki++)main.appendChild(flow[ki]);
  }
  if(root!==main&&root.getAttribute&&root.getAttribute('data-pw-scene-root')==='1'){
    try{root.removeAttribute('data-pw-scene-root')}catch(eU){}
  }
  if(main.setAttribute)main.setAttribute('data-pw-scene-root','1');
  if(main.getAttribute&&main.getAttribute('data-pw-scene-origin')!=='content'){
    var nodes=root.querySelectorAll('[data-pw-placement="scene-absolute"],[data-pw-chrome-added="1"][data-pw-box-x],[data-pw-added-text="1"],[data-pw-added-btn="1"],[data-pw-added-image="1"],[data-pw-added-video="1"],[data-pw-added-bg="1"]');
    var measured=nodes.length===0;
    var ni,sr;
    try{sr=main.getBoundingClientRect()}catch(eS){sr=null}
    var scenePx=(C&&C.widths&&C.widths.desktop)||1440;
    try{
      var raw=document.documentElement&&window.getComputedStyle?window.getComputedStyle(document.documentElement).getPropertyValue('--pw-scene-w'):'';
      var n=parseFloat(raw||'');
      if(isFinite(n)&&n>80)scenePx=n;
    }catch(eW){}
    for(ni=0;ni<nodes.length;ni++){
      var el=nodes[ni];
      if(!isSceneAbsoluteOverlay(el))continue;
      if(el.closest&&el.closest('${PW_OUTER_SCENE_CHROME_SEL}'))continue;
      var br;
      try{br=el.getBoundingClientRect()}catch(eB){br=null}
      if(!sr||!(sr.width>8)||!br||!(br.width>0||br.height>0))continue;
      var scale=sr.width/scenePx;
      if(!(scale>0))scale=1;
      if(el.parentNode!==main){
        try{main.appendChild(el)}catch(eP){continue}
      }
      applySceneBoxFromCenter(
        el,
        (br.left+br.width/2-(sr.left+sr.width/2))/scale,
        (br.top+br.height/2-sr.top)/scale,
        br.width/scale,
        br.height/scale,
        C
      );
      measured=true;
    }
    if(measured)main.setAttribute('data-pw-scene-origin','content');
  }
  return main;
}
window.__pwEnsureContentSceneRoot=ensureContentSceneRoot;`
