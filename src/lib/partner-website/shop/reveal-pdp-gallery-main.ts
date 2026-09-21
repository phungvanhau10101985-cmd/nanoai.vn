/**
 * Mobile PDP: tap a gallery thumb → scroll so the large hero image is on screen
 * (under the sticky head). Shared by HTML bootstrap + React fallback.
 */

export type RevealPdpGalleryMainEnv = {
  document: Document
  window: Window
}

function readAttr(el: Element | null, name: string): string {
  return String(el?.getAttribute?.(name) || '').trim().toLowerCase()
}

export function pdpGalleryIsMobileFace(env: RevealPdpGalleryMainEnv): boolean {
  const html = env.document.documentElement
  const stamp =
    readAttr(html, 'data-pw-edit-device') ||
    readAttr(html, 'data-pw-scene-lock') ||
    readAttr(html, 'data-pw-visual-device')
  if (stamp === 'mobile') return true
  if (stamp === 'tablet' || stamp === 'laptop' || stamp === 'desktop') return false
  try {
    const q = new URLSearchParams(env.window.location.search).get('pw-device') || ''
    if (q === 'mobile') return true
    if (q === 'tablet' || q === 'laptop' || q === 'desktop') return false
  } catch {
    /* ignore */
  }
  return (env.window.innerWidth || 0) < 768
}

function stickyHeadPx(env: RevealPdpGalleryMainEnv): number {
  try {
    const cs = env.window.getComputedStyle(env.document.documentElement)
    const fromVar = parseFloat(cs.getPropertyValue('--pw-sticky-head') || '')
    if (fromVar > 0) return fromVar
  } catch {
    /* ignore */
  }
  const header = env.document.querySelector('.pw-header, .pw-shop-header, [data-pw-region="header"]')
  if (header && typeof (header as HTMLElement).getBoundingClientRect === 'function') {
    return (header as HTMLElement).getBoundingClientRect().height || 0
  }
  return 56
}

function isShown(el: Element, env: RevealPdpGalleryMainEnv): boolean {
  const html = el as HTMLElement
  if (!html) return false
  if (html.hidden || el.hasAttribute('hidden')) return false
  if (html.classList?.contains('pw-pdp-hero-img-hidden')) return false
  if (el.getAttribute('data-pw-deferred-src') && !el.getAttribute('src')) return false
  try {
    const cs = env.window.getComputedStyle(html)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
  } catch {
    /* ignore */
  }
  return true
}

export function pickPdpGalleryMainEl(env: RevealPdpGalleryMainEnv): HTMLElement | null {
  const nodes = env.document.querySelectorAll(
    [
      '.pw-pdp-hero [data-pw-pdp-hero-video]',
      '.pw-pdp-hero img[data-pw-el="main-image"]',
      '.pw-pdp-hero .pw-pdp-hero-img',
      '.pw-pdp-hero .pw-shop-product-img',
      '[data-pw-region="gallery"] img[data-pw-el="main-image"]',
      '[data-pw-region="gallery"] .pw-pdp-hero-img',
    ].join(',')
  )
  let video: HTMLElement | null = null
  let img: HTMLElement | null = null
  nodes.forEach((node) => {
    const el = node as HTMLElement
    if (!isShown(el, env)) return
    const host = (el.closest('.pw-pdp-hero, .pw-pdp-gallery-desktop, [data-pw-region="gallery"]') as HTMLElement | null) || el
    if (!isShown(host, env)) return
    if (el.hasAttribute('data-pw-pdp-hero-video')) {
      if (!video) video = el
      return
    }
    if (!img) img = el
  })
  return video || img
}

/** @returns true when the page actually scrolled */
export function revealPdpGalleryMainImage(env?: Partial<RevealPdpGalleryMainEnv>): boolean {
  const documentRef = env?.document ?? (typeof document !== 'undefined' ? document : undefined)
  const windowRef = env?.window ?? (typeof window !== 'undefined' ? window : undefined)
  if (!documentRef || !windowRef) return false
  const full: RevealPdpGalleryMainEnv = { document: documentRef, window: windowRef }
  if (!pdpGalleryIsMobileFace(full)) return false
  const media = pickPdpGalleryMainEl(full)
  const target = (media?.closest('.pw-pdp-hero') as HTMLElement | null) || media
  if (!target || typeof target.getBoundingClientRect !== 'function') return false
  const rect = target.getBoundingClientRect()
  const head = stickyHeadPx(full)
  const vh = windowRef.innerHeight || 0
  const visibleTop = Math.max(rect.top, head)
  const visibleBottom = Math.min(rect.bottom, vh)
  const visible = visibleBottom - visibleTop
  if (rect.top >= head - 12 && visible >= Math.min(Math.max(rect.height, 1), 160)) return false
  const y = Math.max(0, (windowRef.scrollY || windowRef.pageYOffset || 0) + rect.top - head - 4)
  if (typeof windowRef.scrollTo === 'function') {
    windowRef.scrollTo({ top: y, behavior: 'smooth' })
    return true
  }
  return false
}

/** Injected into live PDP HTML bootstrap (Sửa nhanh strips this script). */
export const PW_REVEAL_PDP_GALLERY_MAIN_JS = `
function pdpGalleryIsMobileFace(){
  var html=document.documentElement;
  var stamp=String((html.getAttribute('data-pw-edit-device')||html.getAttribute('data-pw-scene-lock')||html.getAttribute('data-pw-visual-device')||'')).toLowerCase();
  if(stamp==='mobile')return true;
  if(stamp==='tablet'||stamp==='laptop'||stamp==='desktop')return false;
  try{
    var q=new URLSearchParams(location.search).get('pw-device')||'';
    if(q==='mobile')return true;
    if(q==='tablet'||q==='laptop'||q==='desktop')return false;
  }catch(e){}
  return (window.innerWidth||0)<768;
}
function revealPdpGalleryMainImage(){
  if(!pdpGalleryIsMobileFace())return;
  var media=null,nodes=document.querySelectorAll('.pw-pdp-hero [data-pw-pdp-hero-video],.pw-pdp-hero img[data-pw-el="main-image"],.pw-pdp-hero .pw-pdp-hero-img,.pw-pdp-hero .pw-shop-product-img,[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img');
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i];
    if(typeof galleryFaceVisible==='function'&&!galleryFaceVisible(el))continue;
    if(el.hidden||el.hasAttribute('hidden')||(el.classList&&el.classList.contains('pw-pdp-hero-img-hidden')))continue;
    if(!media)media=el;
    if(el.getAttribute&&el.hasAttribute('data-pw-pdp-hero-video')){media=el;break;}
  }
  var target=(media&&media.closest&&media.closest('.pw-pdp-hero'))||media;
  if(!target||!target.getBoundingClientRect)return;
  var rect=target.getBoundingClientRect();
  var head=56;
  try{
    var fromVar=parseFloat((window.getComputedStyle(document.documentElement).getPropertyValue('--pw-sticky-head')||'').trim());
    if(fromVar>0)head=fromVar;
  }catch(e){}
  if(!(head>0)){
    var header=document.querySelector('.pw-header,.pw-shop-header,[data-pw-region="header"]');
    if(header&&header.getBoundingClientRect)head=header.getBoundingClientRect().height||56;
  }
  var vh=window.innerHeight||0;
  var visible=Math.min(rect.bottom,vh)-Math.max(rect.top,head);
  if(rect.top>=head-12&&visible>=Math.min(Math.max(rect.height,1),160))return;
  var y=Math.max(0,(window.scrollY||window.pageYOffset||0)+rect.top-head-4);
  if(window.scrollTo)window.scrollTo({top:y,behavior:'smooth'});
}
`.trim()
