/** Pin added buttons/backgrounds under the sticky shop header while scrolling. */

export const PARTNER_SHOP_STICK_HEADER_ATTR = 'data-pw-stick-header'
export const PARTNER_SHOP_STICK_HEADER_SCRIPT_ID = 'pw-shop-stick-header'
export const PARTNER_SHOP_STICK_HEADER_ON_CLASS = 'pw-stick-header-on'
export const PARTNER_SHOP_STICK_HEADER_SLOT_CLASS = 'pw-stick-header-slot'

type StickRest = {
  position?: string
  top?: string
  left?: string
  right?: string
  width?: string
  height?: string
  transform?: string
  zIndex?: string
  margin?: string
}

function applyRest(el: HTMLElement, rest: StickRest) {
  const s = el.style
  if (!s) return
  s.position = rest.position || ''
  s.top = rest.top || ''
  s.left = rest.left || ''
  s.right = rest.right || ''
  s.width = rest.width || ''
  s.height = rest.height || ''
  s.transform = rest.transform || ''
  s.zIndex = rest.zIndex || ''
  s.margin = rest.margin || ''
}

/** Strip runtime pin styles before saving HTML. Keeps `data-pw-stick-header`. */
export function releaseStickHeaderPins(root: ParentNode): void {
  root.querySelectorAll(`.${PARTNER_SHOP_STICK_HEADER_SLOT_CLASS}`).forEach((node) => {
    node.remove()
  })
  root.querySelectorAll(`[${PARTNER_SHOP_STICK_HEADER_ATTR}]`).forEach((node) => {
    const el = node as HTMLElement
    el.classList.remove(PARTNER_SHOP_STICK_HEADER_ON_CLASS)
    const raw = el.getAttribute('data-pw-stick-rest')
    if (raw) {
      try {
        applyRest(el, JSON.parse(raw) as StickRest)
      } catch {
        /* keep current inline styles */
      }
      el.removeAttribute('data-pw-stick-rest')
    }
    el.removeAttribute('data-pw-stick-origin')
    el.removeAttribute('data-pw-stick-slot')
    if (el.getAttribute('style')?.trim() === '') el.removeAttribute('style')
  })
}

export const PARTNER_SHOP_STICK_HEADER_CSS = `
[${PARTNER_SHOP_STICK_HEADER_ATTR}="1"].${PARTNER_SHOP_STICK_HEADER_ON_CLASS}{position:fixed!important;z-index:190!important;margin:0!important}
.${PARTNER_SHOP_STICK_HEADER_SLOT_CLASS}{display:inline-block;flex:0 0 auto;pointer-events:none;visibility:hidden}
`.trim()

export const PARTNER_SHOP_STICK_HEADER_SCRIPT = `(function(){
  if (window.__pwStickHeaderBound) return;
  window.__pwStickHeaderBound = 1;
  var ATTR = '${PARTNER_SHOP_STICK_HEADER_ATTR}';
  var ORIGIN = 'data-pw-stick-origin';
  var REST = 'data-pw-stick-rest';
  var ON = '${PARTNER_SHOP_STICK_HEADER_ON_CLASS}';
  var SLOT = '${PARTNER_SHOP_STICK_HEADER_SLOT_CLASS}';
  function headerBottom(){
    var h = document.querySelector('header.pw-header, header.pw-shop-header, .pw-header, .pw-shop-header, header');
    if (!h) return 0;
    return Math.round(h.getBoundingClientRect().bottom);
  }
  function paused(){
    return !!(window.__pwStickHeaderPaused || (document.body && document.body.classList.contains('nanoai-ve-dragging')));
  }
  function list(){ return document.querySelectorAll('[' + ATTR + '="1"]'); }
  function inChrome(el){
    return !!(el && el.closest && el.closest('header, .pw-header, .pw-shop-header, .pw-bottom-nav, .pw-shop-bottom-nav'));
  }
  function captureOrigin(el){
    if (!el || el.classList.contains(ON)) return;
    var r = el.getBoundingClientRect();
    var sy = window.scrollY || document.documentElement.scrollTop || 0;
    var sx = window.scrollX || document.documentElement.scrollLeft || 0;
    el.setAttribute(ORIGIN, JSON.stringify({ y: r.top + sy, x: r.left + sx, w: r.width, h: r.height }));
  }
  function parseOrigin(el){
    try { return JSON.parse(el.getAttribute(ORIGIN) || ''); } catch (e) { return null; }
  }
  function saveRest(el){
    if (el.getAttribute(REST)) return;
    var s = el.style;
    el.setAttribute(REST, JSON.stringify({
      position: s.position || '',
      top: s.top || '',
      left: s.left || '',
      right: s.right || '',
      width: s.width || '',
      height: s.height || '',
      transform: s.transform || '',
      zIndex: s.zIndex || '',
      margin: s.margin || ''
    }));
  }
  function restoreRest(el){
    var raw = el.getAttribute(REST);
    el.classList.remove(ON);
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      el.style.position = o.position || '';
      el.style.top = o.top || '';
      el.style.left = o.left || '';
      el.style.right = o.right || '';
      el.style.width = o.width || '';
      el.style.height = o.height || '';
      el.style.transform = o.transform || '';
      el.style.zIndex = o.zIndex || '';
      el.style.margin = o.margin || '';
    } catch (e) {}
    el.removeAttribute(REST);
  }
  function ensureSlot(el){
    var id = el.getAttribute('data-pw-stick-slot');
    if (id) {
      var existing = document.getElementById(id);
      if (existing) return existing;
    }
    var pos = '';
    try { pos = window.getComputedStyle(el).position; } catch (ePos) { pos = ''; }
    if (pos === 'absolute' || pos === 'fixed') return null;
    if (!el.parentNode) return null;
    var slot = document.createElement('span');
    var sid = 'pw-stick-slot-' + Math.random().toString(36).slice(2, 8);
    slot.id = sid;
    slot.className = SLOT + ' nanoai-ve-ignore';
    slot.setAttribute('aria-hidden', 'true');
    slot.setAttribute('data-nanoai-ve-ignore', '1');
    slot.style.display = 'inline-block';
    slot.style.width = Math.max(1, Math.round(el.offsetWidth || 0)) + 'px';
    slot.style.height = Math.max(1, Math.round(el.offsetHeight || 0)) + 'px';
    slot.style.flex = '0 0 auto';
    slot.style.pointerEvents = 'none';
    el.parentNode.insertBefore(slot, el);
    el.setAttribute('data-pw-stick-slot', sid);
    return slot;
  }
  function removeSlot(el){
    var id = el.getAttribute('data-pw-stick-slot');
    if (id) {
      var slot = document.getElementById(id);
      if (slot && slot.parentNode) slot.parentNode.removeChild(slot);
      el.removeAttribute('data-pw-stick-slot');
    }
  }
  function pin(el, origin, hb){
    saveRest(el);
    ensureSlot(el);
    var sx = window.scrollX || document.documentElement.scrollLeft || 0;
    el.classList.add(ON);
    el.style.position = 'fixed';
    el.style.top = hb + 'px';
    el.style.left = Math.round(origin.x - sx) + 'px';
    el.style.right = 'auto';
    el.style.width = Math.round(origin.w) + 'px';
    el.style.height = Math.round(origin.h) + 'px';
    el.style.transform = 'none';
    el.style.margin = '0';
    el.style.zIndex = '190';
  }
  function unpin(el){
    if (!el) return;
    restoreRest(el);
    removeSlot(el);
  }
  function tick(){
    if (paused()) return;
    var hb = headerBottom();
    var sy = window.scrollY || document.documentElement.scrollTop || 0;
    var nodes = list();
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || el.nodeType !== 1 || inChrome(el)) continue;
      if (!el.classList.contains(ON)) captureOrigin(el);
      var origin = parseOrigin(el);
      if (!origin) continue;
      if (origin.y - sy <= hb + 0.5) pin(el, origin, hb);
      else unpin(el);
    }
  }
  function releaseAll(){
    var nodes = list();
    for (var i = 0; i < nodes.length; i++) unpin(nodes[i]);
    var slots = document.querySelectorAll('.' + SLOT);
    for (var j = 0; j < slots.length; j++) {
      if (slots[j].parentNode) slots[j].parentNode.removeChild(slots[j]);
    }
  }
  window.__pwStickHeaderSync = tick;
  window.__pwStickHeaderRelease = releaseAll;
  window.__pwStickHeaderUnpin = function (el) { unpin(el); };
  window.__pwStickHeaderApply = function (el) {
    if (!el) return;
    unpin(el);
    if (el.getAttribute(ATTR) === '1') { captureOrigin(el); tick(); }
  };
  var raf = 0;
  function onScroll(){
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; tick(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
  else tick();
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
})();`
