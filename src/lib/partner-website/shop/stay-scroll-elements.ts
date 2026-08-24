/**
 * Added elements glued to one viewport spot while the page scrolls.
 * Uses CSS position:fixed (not JS rebase on scroll — that jitters then snaps).
 * X/Y are % of the scene canvas (`--pw-scene-w`), not window.innerWidth.
 * Keeps the original hole (spacer). Does not lift to body / z-index 9999.
 */

export const PW_STAY_SCROLL_ATTR = 'data-pw-stay-scroll'
export const PW_STAY_SCROLL_X_ATTR = 'data-pw-stay-x'
export const PW_STAY_SCROLL_Y_ATTR = 'data-pw-stay-y'
export const PW_STAY_SCROLL_W_ATTR = 'data-pw-stay-w'
export const PW_STAY_SCROLL_H_ATTR = 'data-pw-stay-h'
export const PW_STAY_SCROLL_PH_ATTR = 'data-pw-stay-ph'
export const PW_STAY_SCROLL_PH_SLOT_ATTR = 'data-pw-stay-ph-slot'
export const PW_STAY_SCROLL_SCRIPT_ID = 'pw-shop-stay-scroll'

export const PW_HIDDEN_ATTR = 'data-pw-hidden'
export const PARTNER_SHOP_HIDDEN_CSS = `[${PW_HIDDEN_ATTR}="1"]{display:none!important}`

export const PARTNER_SHOP_STAY_SCROLL_CSS = `
[${PW_STAY_SCROLL_ATTR}="1"]{position:fixed!important;right:auto!important;bottom:auto!important;margin:0!important;box-sizing:border-box!important;max-width:none!important;max-height:none!important;transform:none!important}
[${PW_STAY_SCROLL_PH_SLOT_ATTR}="1"]{display:block;width:100%;margin:0;padding:0;border:0;visibility:hidden;pointer-events:none}
`.trim()

export const PARTNER_SHOP_STAY_SCROLL_SCRIPT = `(function(){
  if (window.__pwStayScrollBound) return;
  window.__pwStayScrollBound = 1;
  var ATTR = '${PW_STAY_SCROLL_ATTR}';
  var XA = '${PW_STAY_SCROLL_X_ATTR}';
  var YA = '${PW_STAY_SCROLL_Y_ATTR}';
  var WA = '${PW_STAY_SCROLL_W_ATTR}';
  var HA = '${PW_STAY_SCROLL_H_ATTR}';
  var PH = '${PW_STAY_SCROLL_PH_ATTR}';
  var PHS = '${PW_STAY_SCROLL_PH_SLOT_ATTR}';
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
    return { w: w, h: h, ox: sceneOriginX() };
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
  function releasePlaceholder(el){
    var ph = findPlaceholder(el);
    if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
    if (el && el.removeAttribute) el.removeAttribute(PH);
  }
  function apply(el){
    if (!el || !el.style || paused) return;
    if (document.querySelector('[data-pw-inline-visual-root]')) return;
    var x = parseFloat(el.getAttribute(XA) || '');
    var y = parseFloat(el.getAttribute(YA) || '');
    if (!isFinite(x) || !isFinite(y)) return;
    var w = parseFloat(el.getAttribute(WA) || '');
    var h = parseFloat(el.getAttribute(HA) || '');
    var v = view();
    el.style.setProperty('position', 'fixed', 'important');
    el.style.setProperty('left', (v.ox + (x / 100) * v.w) + 'px', 'important');
    el.style.setProperty('top', (y / 100) * v.h + 'px', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('transform', 'none', 'important');
    if (isFinite(w) && w > 0) el.style.setProperty('width', Math.round(w) + 'px', 'important');
    if (isFinite(h) && h > 0) el.style.setProperty('height', Math.round(h) + 'px', 'important');
    el.style.setProperty('box-sizing', 'border-box', 'important');
    el.style.setProperty('max-width', 'none', 'important');
    el.style.setProperty('max-height', 'none', 'important');
  }
  function sync(){
    var nodes = document.querySelectorAll('[' + ATTR + '="1"]');
    for (var i = 0; i < nodes.length; i++) apply(nodes[i]);
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
    el.setAttribute(XA, (((r.left - v.ox) / v.w) * 100).toFixed(3));
    el.setAttribute(YA, ((r.top / v.h) * 100).toFixed(3));
    if (r.width > 0) el.setAttribute(WA, String(Math.round(r.width)));
    if (r.height > 0) el.setAttribute(HA, String(Math.round(r.height)));
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
    releasePlaceholder(el);
    try { el.removeAttribute(ATTR); } catch (errA) {}
    try { el.removeAttribute(XA); } catch (errX) {}
    try { el.removeAttribute(YA); } catch (errY) {}
    try { el.removeAttribute(WA); } catch (errW) {}
    try { el.removeAttribute(HA); } catch (errH) {}
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
})();
`