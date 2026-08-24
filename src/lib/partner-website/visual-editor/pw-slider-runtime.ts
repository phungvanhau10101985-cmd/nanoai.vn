/** Banner ngang — attr live, editor và serve cùng đọc. */

export const PW_SLIDER_WAIT_DEFAULT = 4000
export const PW_SLIDER_WAIT_MIN = 0
export const PW_SLIDER_WAIT_MAX = 12000
export const PW_SLIDER_WAIT_STEP = 500
export const PW_SLIDER_SLIDE_MAX = 8
/** Full-banner slides (copy + media slide together). Image-only sliders omit this. */
export const PW_SLIDER_FULL_ATTR = 'data-pw-full-slides'

export const PW_SLIDER_ARROW_PREV_HTML =
  '<button type="button" class="pw-slide-arrow pw-slide-prev" data-pw-slide-prev aria-label="Prev"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg></button>'
export const PW_SLIDER_ARROW_NEXT_HTML =
  '<button type="button" class="pw-slide-arrow pw-slide-next" data-pw-slide-next aria-label="Next"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18"></polyline></svg></button>'

export function shouldMergeBannerAsSlide(input: {
  mergeSlide?: boolean
  place?: string
  neighborIsBanner?: boolean
}): boolean {
  if (!input.mergeSlide || !input.neighborIsBanner) return false
  return input.place === 'left' || input.place === 'right'
}

export function clampPwSliderWait(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_SLIDER_WAIT_DEFAULT
  return Math.min(PW_SLIDER_WAIT_MAX, Math.max(PW_SLIDER_WAIT_MIN, n))
}

export const PARTNER_SHOP_SLIDER_CSS = `
html [data-pw-slider]{position:relative;overflow:hidden}
html [data-pw-slides]{position:relative;z-index:0;display:flex;flex-wrap:nowrap;width:100%!important;max-width:100%;min-height:inherit;transition:transform .5s ease;will-change:transform}
html [data-pw-slide]{position:relative!important;flex:0 0 100%!important;width:100%!important;max-width:100%;min-width:0;min-height:inherit;overflow:hidden;box-sizing:border-box}
html [data-pw-slide] img[data-pw-el="media"]{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
html [data-pw-slider] [data-pw-el="inner"]{position:relative;z-index:2}
html .pw-slide-arrow{position:absolute;top:50%;z-index:8;width:44px;height:44px;margin:0;padding:0;border:0;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--pw-text,#111) 42%,transparent);color:#fff;cursor:pointer;pointer-events:auto;transform:translateY(-50%);-webkit-appearance:none;appearance:none;user-select:none}
html .pw-slide-arrow:hover{background:color-mix(in srgb,var(--pw-primary) 78%,#000)}
html .pw-slide-arrow svg{width:22px;height:22px;display:block;stroke:currentColor;fill:none;stroke-width:2;pointer-events:none}
html .pw-slide-prev{left:12px}
html .pw-slide-next{right:12px}
html [data-pw-slide-arrows="0"] .pw-slide-arrow{display:none!important}
html .pw-slide-dots{position:absolute;left:0;right:0;bottom:16px;z-index:8;display:flex;justify-content:center;gap:8px;margin:0;pointer-events:auto}
html .pw-slide-dots [data-pw-slide-to]{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.45);border:0;padding:0;cursor:pointer}
html .pw-slide-dots [data-pw-slide-to].is-active{background:#fff;width:18px;border-radius:999px}
html [data-pw-slider][data-pw-full-slides="1"] [data-pw-slides]{position:relative;inset:auto;left:auto;top:auto;right:auto;bottom:auto;height:auto}
html [data-pw-slider][data-pw-full-slides="1"] [data-pw-slide]{height:auto}
html [data-pw-slider][data-pw-full-slides="1"] [data-pw-slide] [data-pw-el="inner"]{position:relative;z-index:2}
`.trim()

/** Function body for editor IIFE + live bootstrap. No persist bound attr. */
export const PW_SLIDER_ENGINE_JS = `
var pwSliderTimers = typeof WeakMap === 'function' ? new WeakMap() : null;
function pwSliderEditorOn(){
  try { return !!(document.body && document.body.classList.contains('nanoai-ve-active')); } catch (e0) { return false; }
}
function pwSliderClampWait(n){
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return ${PW_SLIDER_WAIT_DEFAULT};
  if (n < ${PW_SLIDER_WAIT_MIN}) return ${PW_SLIDER_WAIT_MIN};
  if (n > ${PW_SLIDER_WAIT_MAX}) return ${PW_SLIDER_WAIT_MAX};
  return n;
}
function pwSliderHostOf(el){
  if (!el || !el.closest) return null;
  return el.closest('[data-pw-slider="1"],[data-pw-banner-kind="slider"]');
}
function pwSliderIsControl(el){
  if (!el || !el.closest) return false;
  return !!(el.closest('[data-pw-slide-prev],[data-pw-slide-next],[data-pw-slide-to]'));
}
function pwSliderSlides(host){
  return host ? host.querySelectorAll('[data-pw-slide]') : [];
}
function pwSliderIsChrome(el){
  if (!el || el.nodeType !== 1) return false;
  if (el.hasAttribute && (el.hasAttribute('data-pw-slides') || el.hasAttribute('data-pw-slide-prev') || el.hasAttribute('data-pw-slide-next'))) return true;
  if (el.classList && (el.classList.contains('pw-slide-arrow') || el.classList.contains('pw-slide-dots'))) return true;
  return false;
}
function pwSliderHostCopy(host){
  if (!host || !host.children) return { copy: null, overlay: null };
  var copy = null;
  var overlay = null;
  var kids = host.children;
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    if (!k || k.nodeType !== 1 || pwSliderIsChrome(k)) continue;
    if (k.getAttribute && (k.getAttribute('data-pw-el') === 'inner' || (k.classList && k.classList.contains('pw-hero-inner')))) {
      copy = k;
      continue;
    }
    if (k.getAttribute && k.getAttribute('aria-hidden') === 'true' && !k.getAttribute('data-pw-el')) overlay = k;
  }
  return { copy: copy, overlay: overlay };
}
function pwSliderPromoteFull(host){
  if (!host) return;
  var track = host.querySelector('[data-pw-slides]');
  if (!track) return;
  var stray = pwSliderHostCopy(host);
  var slides = pwSliderSlides(host);
  if (!slides.length) return;
  if (stray.copy || stray.overlay) {
    for (var s = 0; s < slides.length; s++) {
      if (stray.overlay && !slides[s].querySelector('[aria-hidden="true"]')) {
        slides[s].appendChild(stray.overlay.cloneNode(true));
      }
      if (stray.copy && !slides[s].querySelector('[data-pw-el="inner"], .pw-hero-inner')) {
        slides[s].appendChild(s === 0 ? stray.copy : stray.copy.cloneNode(true));
      }
    }
    if (stray.copy && stray.copy.parentNode === host) stray.copy.parentNode.removeChild(stray.copy);
    if (stray.overlay && stray.overlay.parentNode === host) stray.overlay.parentNode.removeChild(stray.overlay);
  }
  host.setAttribute(${JSON.stringify(PW_SLIDER_FULL_ATTR)}, '1');
  host.setAttribute('data-pw-slider', '1');
  host.setAttribute('data-pw-banner-kind', 'slider');
}
function pwSliderGo(host, index){
  if (!host) return;
  pwSliderPromoteFull(host);
  var slides = pwSliderSlides(host);
  if (!slides.length) return;
  var i = ((Number(index) % slides.length) + slides.length) % slides.length;
  host.setAttribute('data-pw-slide-index', String(i));
  var track = host.querySelector('[data-pw-slides]');
  var w = 0;
  try { w = Math.round(host.getBoundingClientRect().width) || host.offsetWidth || 0; } catch (eW) { w = host.offsetWidth || 0; }
  if (track && track.style) {
    track.style.width = '100%';
    track.style.display = 'flex';
    track.style.flexWrap = 'nowrap';
    track.style.transform = w ? 'translate3d(' + (-i * w) + 'px,0,0)' : 'translate3d(' + (-i * 100) + '%,0,0)';
  }
  for (var s = 0; s < slides.length; s++) {
    if (s === i) slides[s].setAttribute('data-pw-slide-active', '1');
    else slides[s].removeAttribute('data-pw-slide-active');
  }
  var dots = host.querySelectorAll('[data-pw-slide-to]');
  for (var d = 0; d < dots.length; d++) {
    if (d === i) dots[d].classList.add('is-active');
    else dots[d].classList.remove('is-active');
  }
}
function pwSliderClearTimer(host){
  if (!pwSliderTimers || !host) return;
  var id = pwSliderTimers.get(host);
  if (id) clearInterval(id);
  pwSliderTimers.delete(host);
}
function pwSliderRestart(host){
  if (!host) return;
  pwSliderClearTimer(host);
  if (pwSliderEditorOn()) return;
  var wait = pwSliderClampWait(host.getAttribute('data-pw-slide-wait'));
  if (wait <= 0 || !pwSliderTimers) return;
  pwSliderTimers.set(host, setInterval(function(){
    if (pwSliderEditorOn()) return;
    var cur = Number(host.getAttribute('data-pw-slide-index') || 0);
    pwSliderGo(host, cur + 1);
  }, wait));
}
function pwSliderBind(host){
  if (!host || host._pwSliderBound) return;
  host._pwSliderBound = 1;
  host.addEventListener('click', function(ev){
    if (pwSliderEditorOn()) return;
    var t = ev.target;
    if (!t || !t.closest) return;
    var prev = t.closest('[data-pw-slide-prev]');
    var next = t.closest('[data-pw-slide-next]');
    var to = t.closest('[data-pw-slide-to]');
    if (!prev && !next && !to) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    var cur = Number(host.getAttribute('data-pw-slide-index') || 0);
    if (prev) pwSliderGo(host, cur - 1);
    else if (next) pwSliderGo(host, cur + 1);
    else pwSliderGo(host, Number(to.getAttribute('data-pw-slide-to')));
    pwSliderRestart(host);
  });
  pwSliderGo(host, Number(host.getAttribute('data-pw-slide-index') || 0));
  pwSliderRestart(host);
}
function pwSliderBoot(){
  var nodes = document.querySelectorAll('[data-pw-slider="1"],[data-pw-banner-kind="slider"]');
  for (var i = 0; i < nodes.length; i++) pwSliderBind(nodes[i]);
}
`.trim()
