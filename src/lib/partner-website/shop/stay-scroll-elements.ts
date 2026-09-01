/**
 * Added elements glued to one viewport spot while the page scrolls.
 * Uses CSS position:fixed (not JS rebase on scroll — that jitters then snaps).
 * X/Y are scene pixels from the top-center origin, then scaled with the canvas.
 * Parks the node on a viewport layer that is a sibling of `body` so ancestor
 * `transform` / `will-change:transform` (live canvas scale, banner slides) cannot
 * turn `fixed` into “sticky until the section ends”.
 * Keeps the original hole (spacer). Layer is `display:contents` (no z slab).
 * Each node carries scene z (lớp dưới = 100). `html` overflow-x stays visible
 * so fixed children do not scroll away; body clips horizontal overflow.
 */

import {
  PW_LIVE_CHROME_ATTR,
  PW_LIVE_CHROME_PH_ATTR,
  PW_LIVE_CHROME_SCALE_ATTR,
  PW_SCENE_BAND,
  pwSceneHoistLayerChildZCss,
  pwSceneHoistLayerHostCss,
  pwSceneStayScrollZCss,
} from '@/lib/partner-website/visual-editor/pw-scene'
import { PW_PLACEMENT_ATTR } from '@/lib/partner-website/visual-editor/pw-coordinate-space'

export const PW_STAY_SCROLL_ATTR = 'data-pw-stay-scroll'
export const PW_STAY_SCROLL_X_ATTR = 'data-pw-stay-x'
export const PW_STAY_SCROLL_Y_ATTR = 'data-pw-stay-y'
export const PW_STAY_SCROLL_W_ATTR = 'data-pw-stay-w'
export const PW_STAY_SCROLL_H_ATTR = 'data-pw-stay-h'
export const PW_STAY_SCROLL_PH_ATTR = 'data-pw-stay-ph'
export const PW_STAY_SCROLL_PH_SLOT_ATTR = 'data-pw-stay-ph-slot'
export const PW_STAY_SCROLL_LAYER_ATTR = 'data-pw-stay-layer'
export const PW_STAY_SCROLL_SCRIPT_ID = 'pw-shop-stay-scroll'

export const PW_HIDDEN_ATTR = 'data-pw-hidden'
/** Phải thắng mặt nút `display:inline-flex!important` (icon chữ dưới / kit head). */
export const PARTNER_SHOP_HIDDEN_CSS = [
  `[${PW_HIDDEN_ATTR}="1"]`,
  `html [${PW_HIDDEN_ATTR}="1"]`,
  `html [${PW_HIDDEN_ATTR}="1"][data-pw-chrome-btn]`,
  `html [${PW_HIDDEN_ATTR}="1"][data-pw-chrome-kit]`,
  `html [${PW_HIDDEN_ATTR}="1"][data-pw-chrome-added]`,
  `html [${PW_HIDDEN_ATTR}="1"][data-pw-chrome-style]`,
  `html [data-pw-chrome-btn][${PW_HIDDEN_ATTR}="1"]`,
  `html [data-pw-chrome-kit="1"][${PW_HIDDEN_ATTR}="1"]`,
  `html [data-pw-chrome-style="icon-label-below"][${PW_HIDDEN_ATTR}="1"]`,
  `html [data-pw-chrome-btn][data-pw-chrome-style="icon-label-below"][${PW_HIDDEN_ATTR}="1"]`,
  `html [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"][${PW_HIDDEN_ATTR}="1"]`,
  `html [data-pw-chrome-kit="1"].pw-chrome-label-below[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-header-actions [${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-header-actions [${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-bottom-nav [${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-bottom-nav [${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-header-actions [data-pw-chrome-kit="1"][${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-header-actions [data-pw-chrome-kit="1"][${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-header-actions [data-pw-chrome-style="icon-label-below"][${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-header-actions [data-pw-chrome-style="icon-label-below"][${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"][${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"][${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-header-actions [data-pw-chrome-kit="1"].pw-chrome-label-below[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-header-actions [data-pw-chrome-kit="1"].pw-chrome-label-below[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-bottom-nav > [${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-bottom-nav > [${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-bottom-nav > a[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-bottom-nav > a[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-bottom-nav > button[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-bottom-nav > button[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-bottom-nav > a:not([data-pw-pdp-home]):not([data-pw-dock-show="pdp"])[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-bottom-nav > a:not([data-pw-pdp-home]):not([data-pw-dock-show="pdp"])[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-bottom-nav > .pw-icon-btn[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-bottom-nav > .pw-icon-btn[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-bottom-nav > .pw-shop-icon-btn[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-bottom-nav > .pw-shop-icon-btn[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-bottom-nav > .pw-account-btn[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-bottom-nav > .pw-account-btn[${PW_HIDDEN_ATTR}="1"]`,
  `html [data-pw-chrome-kit="dock"] > [${PW_HIDDEN_ATTR}="1"]`,
  `html [data-pw-chrome-kit="dock"] > a[${PW_HIDDEN_ATTR}="1"]`,
  `html [data-pw-chrome-kit="dock"] > button[${PW_HIDDEN_ATTR}="1"]`,
  `html [data-pw-chrome-kit="dock"] > .pw-account-btn[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-bottom-nav[data-pw-chrome-kit="dock"] > a[${PW_HIDDEN_ATTR}="1"]`,
  `html .pw-shop-bottom-nav[data-pw-chrome-kit="dock"] > a[${PW_HIDDEN_ATTR}="1"]`,
].join(',') + '{display:none!important}'

export const PARTNER_SHOP_STAY_SCROLL_CSS = `
[${PW_STAY_SCROLL_ATTR}="1"],[${PW_PLACEMENT_ATTR}="viewport-fixed"]{position:fixed!important;right:auto!important;bottom:auto!important;margin:0!important;box-sizing:border-box!important;max-width:none!important;max-height:none!important;transform:none!important}
[${PW_STAY_SCROLL_PH_SLOT_ATTR}="1"]{display:block;width:100%;margin:0;padding:0;border:0;visibility:hidden;pointer-events:none}
${pwSceneHoistLayerHostCss(`[${PW_STAY_SCROLL_LAYER_ATTR}="1"]`)}
[${PW_STAY_SCROLL_ATTR}="1"][data-pw-added-bg="1"]{pointer-events:none!important}
[${PW_STAY_SCROLL_ATTR}="1"][data-pw-added-bg="1"] a,[${PW_STAY_SCROLL_ATTR}="1"][data-pw-added-bg="1"] button,[${PW_STAY_SCROLL_ATTR}="1"][data-pw-added-bg="1"] input,[${PW_STAY_SCROLL_ATTR}="1"][data-pw-added-bg="1"] [data-pw-chrome-btn],[${PW_STAY_SCROLL_ATTR}="1"][data-pw-added-bg="1"] [data-pw-el]{pointer-events:auto!important}
${pwSceneStayScrollZCss()}
${pwSceneHoistLayerChildZCss(`[${PW_STAY_SCROLL_LAYER_ATTR}="1"]`)}
`.trim()

/** Put hoisted stay-scroll nodes back before save. Drops runtime layer + spacers. */
export function restoreStayScrollPins(root: ParentNode): void {
  const layers = root.querySelectorAll(`[${PW_STAY_SCROLL_LAYER_ATTR}], [data-pw-live-fixed-layer]`)
  layers.forEach((layer) => {
    Array.from(layer.children).forEach((node) => {
      const el = node as HTMLElement
      if (
        el.getAttribute(PW_STAY_SCROLL_ATTR) !== '1' &&
        el.getAttribute(PW_PLACEMENT_ATTR) !== 'viewport-fixed' &&
        layer.getAttribute(PW_STAY_SCROLL_LAYER_ATTR) !== '1'
      ) {
        return
      }
      const phId = el.getAttribute(PW_STAY_SCROLL_PH_ATTR) || ''
      const ph = phId ? root.querySelector(`#${cssEscapeId(phId)}`) : null
      if (ph?.parentNode) {
        ph.parentNode.insertBefore(el, ph)
        ph.remove()
      } else {
        const host =
          root.querySelector('main, .pw-shop-main, .pw-main') ||
          root.querySelector('body') ||
          layer.parentNode
        host?.appendChild(el)
      }
      el.removeAttribute(PW_STAY_SCROLL_PH_ATTR)
    })
    if (layer.getAttribute(PW_STAY_SCROLL_LAYER_ATTR) === '1' || !layer.childElementCount) {
      layer.remove()
    }
  })
  root.querySelectorAll(`[${PW_STAY_SCROLL_PH_SLOT_ATTR}]`).forEach((ph) => ph.remove())
}

/** Put hoisted live header back before save. Drops runtime chrome host + spacer. */
export function restoreLiveChromePins(root: ParentNode): void {
  const chromes = root.querySelectorAll(`[${PW_LIVE_CHROME_ATTR}]`)
  chromes.forEach((chrome) => {
    const ph =
      root.querySelector(`[${PW_LIVE_CHROME_PH_ATTR}]`) ||
      chrome.nextElementSibling?.querySelector?.(`[${PW_LIVE_CHROME_PH_ATTR}]`) ||
      null
    const host =
      ph?.parentNode ||
      root.querySelector('[data-pw-inline-visual-root]') ||
      root.querySelector('body') ||
      chrome.parentNode
    const move = Array.from(chrome.querySelectorAll('.pw-topbar, .pw-shop-topbar, header.pw-header, header.pw-shop-header, .pw-header, .pw-shop-header')).filter(
      (el) => {
        const parent = el.parentElement
        return parent === chrome || parent?.getAttribute(PW_LIVE_CHROME_SCALE_ATTR) === '1'
      }
    )
    move.forEach((el) => {
      if (ph?.parentNode) ph.parentNode.insertBefore(el, ph)
      else if (host) host.insertBefore(el, host.firstChild)
    })
    chrome.remove()
    ph?.remove()
  })
  root.querySelectorAll(`[${PW_LIVE_CHROME_PH_ATTR}]`).forEach((ph) => ph.remove())
  dedupeShopHeadersInDocument(root)
}

function dedupeShopHeadersInDocument(root: ParentNode): void {
  const nodes = Array.from(
    root.querySelectorAll(
      'header.pw-header, header.pw-shop-header, .pw-header, .pw-shop-header, [data-pw-region="header"]'
    )
  )
  const roots = nodes.filter((el) => !nodes.some((other) => other !== el && other.contains(el)))
  roots.slice(1).forEach((el) => el.remove())
}

const INFLOW_CAT_SEL =
  '[data-pw-chrome-btn="categories"],[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn'

/** In-flow Danh mục wrongly hoisted to main must be saved inside header chrome. */
export function rehomeInflowSceneChromeInDocument(root: ParentNode): void {
  const main =
    root.querySelector('main, .pw-shop-main, .pw-main') ||
    (root instanceof Document ? root.body : null)
  if (!main) return
  root.querySelectorAll(INFLOW_CAT_SEL).forEach((node) => {
    const el = node as HTMLElement
    if (el.getAttribute('data-pw-chrome-added') === '1') return
    if (el.getAttribute(PW_STAY_SCROLL_ATTR) === '1') return
    if (el.getAttribute('data-pw-user-move') === '1') return
    if (el.getAttribute(PW_PLACEMENT_ATTR)) return
    if (el.getAttribute('data-pw-box-x') != null || el.getAttribute('data-pw-fixed-x') != null) return
    if (el.closest('header, .pw-header, .pw-shop-header')) return
    if (!main.contains(el)) return
    const cluster = root.querySelector('.pw-brand-cluster, .pw-shop-brand-cluster')
    if (!cluster) return
    try {
      cluster.insertBefore(el, cluster.firstChild)
    } catch {
      return
    }
    el.style.removeProperty('position')
    el.style.removeProperty('left')
    el.style.removeProperty('top')
    el.style.removeProperty('right')
    el.style.removeProperty('bottom')
    el.style.removeProperty('transform')
    el.style.removeProperty('margin')
    el.style.removeProperty('z-index')
    el.removeAttribute('data-pw-user-move')
  })
}

/** Drop runtime fixed coords — live re-applies from data-pw-stay-* after load. */
export function clearStayScrollTransientStyles(root: ParentNode): void {
  root
    .querySelectorAll(
      `[${PW_STAY_SCROLL_ATTR}="1"],[${PW_PLACEMENT_ATTR}="viewport-fixed"]`
    )
    .forEach((node) => {
      const el = node as HTMLElement
      el.style.removeProperty('position')
      el.style.removeProperty('left')
      el.style.removeProperty('top')
      el.style.removeProperty('right')
      el.style.removeProperty('bottom')
      el.style.removeProperty('inset')
      el.style.removeProperty('transform')
      el.style.removeProperty('z-index')
      el.style.removeProperty('margin')
    })
}

function isHeadDockChromeFloat(el: Element): boolean {
  if (el.closest('[data-pw-chrome-kit="float"],[data-pw-chrome-float-host="1"]')) return false
  return Boolean(
    el.closest(
      '.pw-header-actions,.pw-shop-header-actions,[data-pw-chrome-kit="actions"],.pw-bottom-nav,.pw-shop-bottom-nav,[data-pw-chrome-kit="dock"],header.pw-header,.pw-shop-header,header[data-pw-region="header"]'
    )
  )
}

const KIT_FLOAT_FACE_VARS: Array<[attr: string, cssVar: string]> = [
  ['data-pw-btn-color', '--pw-btn-color'],
  ['data-pw-btn-border', '--pw-btn-border'],
  ['data-pw-btn-text', '--pw-btn-text'],
  ['data-pw-icon-color', '--pw-icon-color'],
  ['data-pw-chrome-hover', '--pw-chrome-hover'],
]

function stripKitFloatRuntimeSeat(el: HTMLElement): void {
  const keptVars = new Map<string, string>()
  for (const [, cssVar] of KIT_FLOAT_FACE_VARS) {
    const fromStyle = el.style.getPropertyValue(cssVar).trim()
    if (fromStyle) keptVars.set(cssVar, fromStyle)
  }
  for (const [attr, cssVar] of KIT_FLOAT_FACE_VARS) {
    const fromAttr = el.getAttribute(attr)?.trim() || ''
    if (fromAttr && !keptVars.has(cssVar)) keptVars.set(cssVar, fromAttr)
  }
  el.removeAttribute(PW_PLACEMENT_ATTR)
  el.removeAttribute('data-pw-fixed-x')
  el.removeAttribute('data-pw-fixed-y')
  el.removeAttribute('data-pw-fixed-w')
  el.removeAttribute('data-pw-fixed-h')
  el.removeAttribute('data-pw-fixed-anchor')
  el.removeAttribute('data-pw-user-move')
  for (const property of ['position', 'left', 'top', 'right', 'bottom', 'transform', 'z-index', 'margin']) {
    el.style.removeProperty(property)
  }
  for (const [cssVar, value] of keptVars) {
    el.style.setProperty(cssVar, value)
  }
}

/**
 * Thanh nổi kit is the authored host. Runtime may hoist icons to `body` so
 * `position:fixed` wins; Save must put them back or the empty kit is reseeded.
 * Legacy pages without a kit still persist standalone floats on `body`.
 */
function rehomeChromeFloatsForStore(root: ParentNode): void {
  const body = root.querySelector('body')
  if (!body) return
  const kit = root.querySelector<HTMLElement>('[data-pw-chrome-kit="float"],[data-pw-chrome-float-host="1"]')
  const host = kit || body
  root.querySelectorAll('[data-pw-chrome-float="1"]').forEach((node) => {
    const el = node as HTMLElement
    if (el.getAttribute('data-pw-float-dup') === '1') {
      el.remove()
      return
    }
    if (isHeadDockChromeFloat(el)) return
    if (el.parentNode !== host) host.appendChild(el)
    if (kit && kit.contains(el)) stripKitFloatRuntimeSeat(el)
  })
}

/** In-flow search geometry is derived from data-pw-search-width + the active device. */
function clearInflowSearchTransientStyles(root: ParentNode): void {
  root
    .querySelectorAll('.pw-header-search, .pw-shop-search-wrap, [data-pw-el="search"]')
    .forEach((node) => {
      const el = node as HTMLElement
      const userSized = el.getAttribute('data-pw-search-width-user') === '1'
      if (
        userSized ||
        el.getAttribute('data-pw-user-move') === '1' ||
        el.getAttribute(PW_STAY_SCROLL_ATTR) === '1' ||
        el.getAttribute(PW_PLACEMENT_ATTR) === 'scene-absolute' ||
        el.getAttribute(PW_PLACEMENT_ATTR) === 'viewport-fixed'
      ) {
        return
      }
      el.removeAttribute('data-pw-search-width')
      el.removeAttribute('data-pw-search-width-user')
      for (const property of [
        'position',
        'left',
        'top',
        'right',
        'bottom',
        'inset',
        'transform',
        'margin',
        'opacity',
        'visibility',
        'min-width',
        'min-height',
        'width',
        'max-width',
        'flex',
      ]) {
        el.style.removeProperty(property)
      }
    })
}

export function prepareVisualDomForStore(root: ParentNode): void {
  rehomeInflowSceneChromeInDocument(root)
  restoreLiveChromePins(root)
  restoreStayScrollPins(root)
  rehomeChromeFloatsForStore(root)
  clearStayScrollTransientStyles(root)
  clearInflowSearchTransientStyles(root)
}

function cssEscapeId(id: string): string {
  return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/#/g, '\\#').replace(/\./g, '\\.')
}

export const PARTNER_SHOP_STAY_SCROLL_SCRIPT = `(function(){
  if (window.__pwStayScrollBound) {
    try { if (window.__pwStayScrollSync) window.__pwStayScrollSync(); } catch (errRebind) {}
    return;
  }
  window.__pwStayScrollBound = 1;
  var ATTR = '${PW_STAY_SCROLL_ATTR}';
  var XA = '${PW_STAY_SCROLL_X_ATTR}';
  var YA = '${PW_STAY_SCROLL_Y_ATTR}';
  var WA = '${PW_STAY_SCROLL_W_ATTR}';
  var HA = '${PW_STAY_SCROLL_H_ATTR}';
  var PH = '${PW_STAY_SCROLL_PH_ATTR}';
  var PHS = '${PW_STAY_SCROLL_PH_SLOT_ATTR}';
  var LAYER = '${PW_STAY_SCROLL_LAYER_ATTR}';
  var PLACEMENT = '${PW_PLACEMENT_ATTR}';
  var FX = 'data-pw-fixed-x';
  var FY = 'data-pw-fixed-y';
  var FW = 'data-pw-fixed-w';
  var FH = 'data-pw-fixed-h';
  var paused = 0;
  function sceneW(){
    try {
      var raw = window.getComputedStyle(document.documentElement).getPropertyValue('--pw-scene-w');
      var n = parseFloat(raw);
      if (n > 8) return n;
    } catch (errSw) {}
    var w = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 390;
    return w > 8 ? w : 390;
  }
  function zoom(){
    try {
      var raw = window.getComputedStyle(document.documentElement).getPropertyValue('--pw-scene-zoom');
      var n = parseFloat(raw);
      if (n > 0.05 && n < 8) return n;
    } catch (errZ) {}
    return 1;
  }
  function sceneOriginX(){
    try {
      var root = document.querySelector('[data-pw-inline-visual-root]') || document.body;
      if (!root) return 0;
      var r = root.getBoundingClientRect();
      if (r && isFinite(r.left)) return r.left;
    } catch (errOx) {}
    return 0;
  }
  function view(){
    var w = sceneW();
    var h = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 640;
    if (!(h > 8)) h = 640;
    return { w: w, h: h, ox: sceneOriginX(), z: zoom() };
  }
  function flowPos(el){
    try {
      var p = window.getComputedStyle(el).position || '';
      return p;
    } catch (errPos) { return ''; }
  }
  function needsPlaceholder(el){
    if (!el) return false;
    if (el.getAttribute && el.getAttribute('data-pw-added-bg-slot') === '1') return true;
    var p = flowPos(el);
    return p !== 'absolute' && p !== 'fixed';
  }
  function findPlaceholder(el){
    var id = el && el.getAttribute ? el.getAttribute(PH) : '';
    if (id) {
      var node = document.getElementById(id);
      if (node) return node;
    }
    return null;
  }
  function ensurePlaceholder(el, box){
    if (!el || !el.parentNode) return null;
    var existing = findPlaceholder(el);
    if (existing) return existing;
    if (!needsPlaceholder(el)) return null;
    var r = box;
    if (!r) {
      try { r = el.getBoundingClientRect(); } catch (errBox) { r = null; }
    }
    var h = r && r.height > 0 ? Math.round(r.height) : Math.round(el.offsetHeight || 0);
    if (!(h > 0)) h = 1;
    var ph = document.createElement('div');
    var sid = 'pw-stay-ph-' + Math.random().toString(36).slice(2, 10);
    ph.id = sid;
    ph.setAttribute(PHS, '1');
    ph.setAttribute('aria-hidden', 'true');
    ph.style.display = 'block';
    ph.style.width = '100%';
    ph.style.height = h + 'px';
    ph.style.margin = '0';
    ph.style.padding = '0';
    ph.style.border = '0';
    ph.style.visibility = 'hidden';
    ph.style.pointerEvents = 'none';
    el.parentNode.insertBefore(ph, el);
    el.setAttribute(PH, sid);
    return ph;
  }
  function stayLayer(){
    try {
      if (typeof window.__pwViewportFixedHost === 'function') {
        var shared = window.__pwViewportFixedHost();
        if (shared) return shared;
      }
    } catch (errShared) {}
    var visual = document.querySelector('[data-pw-inline-visual-root]');
    var host = (visual && visual.parentNode) || document.body || document.documentElement;
    if (!host) return null;
    var layer = host.querySelector ? host.querySelector('[data-pw-live-fixed-layer],[' + LAYER + ']') : null;
    var revision = visual && visual.getAttribute ? String(visual.getAttribute('data-pw-runtime-revision') || '') : '';
    if (layer && revision && layer.getAttribute('data-pw-runtime-revision') !== revision) {
      try { layer.remove(); } catch (errOldLayer) {}
      layer = null;
    }
    if (layer) return layer;
    layer = document.createElement('div');
    layer.setAttribute('data-pw-live-fixed-layer', '1');
    if (revision) layer.setAttribute('data-pw-runtime-revision', revision);
    if (visual && visual.parentNode === host) host.insertBefore(layer, visual);
    else host.insertBefore(layer, host.firstChild);
    return layer;
  }
  function hoist(el){
    if (!el) return;
    var layer = stayLayer();
    if (!layer || el.parentNode === layer) return;
    ensurePlaceholder(el);
    try { layer.appendChild(el); } catch (errH) {}
  }
  function unhoist(el){
    if (!el) return;
    var ph = findPlaceholder(el);
    if (ph && ph.parentNode) {
      ph.parentNode.insertBefore(el, ph);
      return;
    }
    var main = document.querySelector('main, .pw-shop-main, .pw-main') || document.body;
    if (main && el.parentNode !== main) {
      try { main.appendChild(el); } catch (errU) {}
    }
  }
  function releasePlaceholder(el){
    var ph = findPlaceholder(el);
    if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
    if (el && el.removeAttribute) el.removeAttribute(PH);
  }
  function apply(el){
    if (!el || !el.style || paused) return;
    var canonical = el.getAttribute(PLACEMENT) === 'viewport-fixed';
    var x = parseFloat(el.getAttribute(canonical ? FX : XA) || '');
    var y = parseFloat(el.getAttribute(canonical ? FY : YA) || '');
    if (!isFinite(x) || !isFinite(y)) return;
    hoist(el);
    var w = parseFloat(el.getAttribute(canonical ? FW : WA) || '');
    var h = parseFloat(el.getAttribute(canonical ? FH : HA) || '');
    var v = view();
    var z = v.z > 0.05 ? v.z : 1;
    var leftPx;
    var topPx;
    var C = window.__pwCoordinate;
    var vw = window.innerWidth || v.w;
    if (canonical && C && !(C.looksNorm && C.looksNorm(x, y))) {
      var map = C.createMap({ viewportWidth: vw, originX: vw / 2, originY: 0 });
      var pt = C.sceneToClient({ x: x, y: y }, map);
      var tl = C.clientTopLeft
        ? C.clientTopLeft(pt, w, h, map.scale)
        : { x: pt.x - (isFinite(w) ? w : 0) * map.scale / 2, y: pt.y - (isFinite(h) ? h : 0) * map.scale / 2 };
      leftPx = tl.x;
      topPx = tl.y;
    } else if (canonical) {
      leftPx = x * vw;
      topPx = y * v.h;
    } else {
      leftPx = v.ox + (x / 100) * v.w * z;
      topPx = (y / 100) * v.h;
    }
    el.style.setProperty('position', 'fixed', 'important');
    el.style.setProperty('left', leftPx + 'px', 'important');
    el.style.setProperty('top', topPx + 'px', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('transform', 'none', 'important');
    if (isFinite(w) && w > 0) el.style.setProperty('width', Math.round(w * z) + 'px', 'important');
    if (isFinite(h) && h > 0) el.style.setProperty('height', Math.round(h * z) + 'px', 'important');
    el.style.setProperty('box-sizing', 'border-box', 'important');
    el.style.setProperty('max-width', 'none', 'important');
    el.style.setProperty('max-height', 'none', 'important');
    var scene = parseInt(el.getAttribute('data-pw-scene') || '1', 10);
    if (!isFinite(scene) || scene < 1) scene = 1;
    if (scene > 4) scene = 4;
    if (el.getAttribute && el.getAttribute('data-pw-added-bg') === '1' && scene <= 1) scene = 1;
    el.style.setProperty('z-index', String(scene * ${PW_SCENE_BAND}), 'important');
  }
  function sync(){
    rehomeInflowSceneChrome();
    var nodes = document.querySelectorAll('[' + ATTR + '="1"],[' + PLACEMENT + '="viewport-fixed"]');
    for (var i = 0; i < nodes.length; i++) apply(nodes[i]);
  }
  function rehomeInflowSceneChrome(){
    var main = document.querySelector('main, .pw-shop-main, .pw-main');
    if (!main) return;
    var nodes = document.querySelectorAll('[data-pw-chrome-btn="categories"],[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || !el.getAttribute) continue;
      if (el.getAttribute('data-pw-chrome-added') === '1') continue;
      if (el.getAttribute(ATTR) === '1') continue;
      if (el.getAttribute('data-pw-user-move') === '1') continue;
      if (el.getAttribute(PLACEMENT)) continue;
      if (el.getAttribute('data-pw-box-x') != null || el.getAttribute(FX) != null) continue;
      if (el.getAttribute('data-pw-chrome-float') === '1' || el.getAttribute('data-pw-pin-screen') === '1') continue;
      if (el.closest && el.closest('header, .pw-header, .pw-shop-header')) continue;
      if (!main.contains(el)) continue;
      var cluster = document.querySelector('.pw-brand-cluster, .pw-shop-brand-cluster');
      if (!cluster) continue;
      try { cluster.insertBefore(el, cluster.firstChild); } catch (errHome) { continue; }
      if (!el.style) continue;
      el.style.removeProperty('position');
      el.style.removeProperty('left');
      el.style.removeProperty('top');
      el.style.removeProperty('right');
      el.style.removeProperty('bottom');
      el.style.removeProperty('transform');
      el.style.removeProperty('margin');
      try { el.removeAttribute('data-pw-user-move'); } catch (errMv) {}
    }
  }
  function capture(el, box){
    if (!el || !el.setAttribute) return;
    var r = box;
    if (!r) {
      try { r = el.getBoundingClientRect(); } catch (errBox) { r = null; }
    }
    if (!r) return;
    ensurePlaceholder(el, r);
    var v = view();
    var z = v.z > 0.05 ? v.z : 1;
    var viewportW = window.innerWidth || document.documentElement.clientWidth || v.w;
    var C = window.__pwCoordinate;
    el.setAttribute(PLACEMENT, 'viewport-fixed');
    if (C) {
      var capMap = C.createMap({ viewportWidth: viewportW, originX: viewportW / 2, originY: 0 });
      var cap = C.clientToScene(C.rectCenter ? C.rectCenter(r) : { x: r.left + r.width / 2, y: r.top + r.height / 2 }, capMap);
      el.setAttribute(FX, String(Math.round(cap.x * 1000) / 1000));
      el.setAttribute(FY, String(Math.round(cap.y * 1000) / 1000));
    } else {
      el.setAttribute(FX, (r.left / Math.max(1, viewportW)).toFixed(5));
      el.setAttribute(FY, (r.top / Math.max(1, v.h)).toFixed(5));
    }
    if (r.width > 0) el.setAttribute(FW, String(Math.round(r.width / z)));
    if (r.height > 0) el.setAttribute(FH, String(Math.round(r.height / z)));
    el.setAttribute(ATTR, '1');
    apply(el);
  }
  function holdFlow(el, box){
    if (!el) return;
    var r = box;
    if (!r) {
      try { r = el.getBoundingClientRect(); } catch (errHold) { r = null; }
    }
    ensurePlaceholder(el, r);
    if (r && el.style) {
      if (r.width > 0) el.style.setProperty('width', Math.round(r.width) + 'px', 'important');
      if (r.height > 0) el.style.setProperty('height', Math.round(r.height) + 'px', 'important');
      el.style.setProperty('box-sizing', 'border-box', 'important');
      el.style.setProperty('max-width', 'none', 'important');
      el.style.setProperty('max-height', 'none', 'important');
    }
  }
  function release(el){
    if (!el) return;
    unhoist(el);
    releasePlaceholder(el);
    try { el.removeAttribute(ATTR); } catch (errA) {}
    try { el.removeAttribute(XA); } catch (errX) {}
    try { el.removeAttribute(YA); } catch (errY) {}
    try { el.removeAttribute(WA); } catch (errW) {}
    try { el.removeAttribute(HA); } catch (errH) {}
    try { el.removeAttribute(PLACEMENT); } catch (errP) {}
    try { el.removeAttribute(FX); } catch (errFx) {}
    try { el.removeAttribute(FY); } catch (errFy) {}
    try { el.removeAttribute(FW); } catch (errFw) {}
    try { el.removeAttribute(FH); } catch (errFh) {}
  }
  window.__pwStayScrollPause = function (on) {
    paused = on ? 1 : 0;
    if (!on) sync();
  };
  window.__pwStayScrollSync = sync;
  window.__pwStayScrollCapture = capture;
  window.__pwStayScrollHoldFlow = holdFlow;
  window.__pwStayScrollRelease = release;
  window.__pwStayScrollReleasePh = releasePlaceholder;
  window.addEventListener('resize', sync);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', sync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
})();
`
