/**
 * Browser preview of product pages this visitor already opened.
 * Soft-nav paints the last HTML immediately; the server page still replaces it
 * with live price and stock. Not a checkout source. Not shared Redis HTML.
 */

export const PW_VIEWED_PDP_CACHE_PREFIX = 'pw-viewed-pdp-v1:'
export const PW_VIEWED_PDP_INDEX_KEY = 'pw-viewed-pdp-index-v1'
export const PW_VIEWED_PDP_SNAP_ID = 'pw-viewed-pdp-snap'
/** Set on the click that paints the snapshot, cleared when the live PDP takes over. */
export const PW_VIEWED_PDP_HANDOFF_KEY = 'pw-viewed-pdp-handoff-v1'
/** Scroll inside the snapshot, restored on the next document so the reload does not jump. */
export const PW_VIEWED_PDP_SCROLL_KEY = 'pw-viewed-pdp-scroll-v1'
/** Same window as the account profile cache. The copy never leaves this browser. */
export const PW_VIEWED_PDP_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Matches the recently-viewed list. Older pages drop when this or the byte budget is hit. */
export const PW_VIEWED_PDP_MAX_ENTRIES = 24
/** Leave room in the origin's ~5MB localStorage for the account cache and search history. */
export const PW_VIEWED_PDP_BUDGET_CHARS = 2_500_000

const MIN_BODY_CHARS = 40
const MAX_BODY_CHARS = 400_000
const MAX_CSS_CHARS = 500_000
const MAX_DOC_CHARS = 450_000
const SNAP_HOLD_MS = 12_000
const SCROLL_LOCK_MS = 1_200
const HTML_ATTRS = [
  'data-pw-page',
  'data-pw-look',
  'data-pw-coordinate-version',
  'data-pw-edit-device',
  'data-pw-scene-lock',
] as const

const SNAP_GUARD_JS = `try{var y=0;try{y=+sessionStorage.getItem(${JSON.stringify(PW_VIEWED_PDP_SCROLL_KEY)})||0}catch(e){}if(y>0){var go=function(){try{scrollTo(0,y)}catch(e2){}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();}document.addEventListener('click',function(e){e.preventDefault();e.stopPropagation()},true);document.addEventListener('pointerdown',function(e){var t=e.target;if(t&&t.closest&&t.closest('a,button,input,textarea,select,label'))e.preventDefault()},true);document.addEventListener('submit',function(e){e.preventDefault();e.stopPropagation()},true)}catch(err){}`

export type ViewedProductStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type ViewedProductRecord = {
  savedAt: number
  css: string
  body: string
  /** Full document (theme links + hoisted chrome) so the preview matches the live page. */
  doc?: string
}

let snapHoldTimer = 0

export function viewedProductPathname(input: string): string | null {
  let path = String(input || '').trim()
  if (!path) return null
  try {
    if (path.includes('://')) path = new URL(path).pathname
  } catch {
    return null
  }
  path = path.split('?')[0]?.split('#')[0] || ''
  if (!path.startsWith('/')) return null
  const parts = path.split('/').filter(Boolean)
  const productAt = parts.lastIndexOf('products')
  if (productAt < 0 || productAt !== parts.length - 2) return null
  const key = parts[productAt + 1] || ''
  if (!key || key === 'outfit') return null
  return `/${parts.join('/')}`
}

function storageKey(host: string, pathname: string): string {
  return `${PW_VIEWED_PDP_CACHE_PREFIX}${host.toLowerCase()}${pathname}`
}

function readIndex(storage: ViewedProductStorage): string[] {
  try {
    const raw = storage.getItem(PW_VIEWED_PDP_INDEX_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeIndex(storage: ViewedProductStorage, keys: string[]) {
  storage.setItem(PW_VIEWED_PDP_INDEX_KEY, JSON.stringify(keys.slice(-PW_VIEWED_PDP_MAX_ENTRIES)))
}

function dropKey(storage: ViewedProductStorage, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    /* quota or private mode */
  }
  writeIndex(
    storage,
    readIndex(storage).filter((item) => item !== key)
  )
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function neutralizeSnapshotAnchors(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (_full, attrs: string) => {
    return `<a${String(attrs).replace(/\shref\s*=/gi, ' data-pw-snap-href=')}>`
  })
}

/** Drop shop scripts and clicks. Keep stylesheet `href` so the preview is not unstyled. */
export function finalizeViewedProductDocument(html: string): string | null {
  if (!html || !/data-pw-page=["']product["']|data-pw-region=["']pdp-info["']/i.test(html)) return null
  let doc = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  doc = doc.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  doc = neutralizeSnapshotAnchors(doc)
  if (!/<html[\s>]/i.test(doc)) {
    doc = `<!doctype html><html data-pw-page="product"><head><meta charset="utf-8"></head><body>${doc}</body></html>`
  }
  if (!/name=["']viewport["']/i.test(doc)) {
    doc = doc.replace(
      /<head([^>]*)>/i,
      '<head$1><meta name="viewport" content="width=device-width, initial-scale=1">'
    )
  }
  const guard = `<script data-pw-snap-guard="1">${SNAP_GUARD_JS}</script>`
  if (/<\/body>/i.test(doc)) doc = doc.replace(/<\/body>/i, `${guard}</body>`)
  else doc += guard
  if (doc.length > MAX_DOC_CHARS) {
    const slim = doc.replace(/<style\b(?![^>]*\bdata-pw-snap-guard\b)[^>]*>[\s\S]*?<\/style>/gi, '')
    if (slim.length > MAX_DOC_CHARS) return null
    doc = slim
  }
  return doc
}

export function extractViewedProductSnapshot(html: string): { css: string; body: string } | null {
  if (!html || !/data-pw-page=["']product["']|data-pw-region=["']pdp-info["']/i.test(html)) return null
  const cssParts: string[] = []
  html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_full, css: string) => {
    const text = String(css || '').trim()
    if (text && !/data-pw-snap-guard/i.test(_full)) cssParts.push(text)
    return ''
  })
  const css = cssParts.join('\n')
  const bodyRaw = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() || html
  const body = neutralizeSnapshotAnchors(bodyRaw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''))
  if (body.length < MIN_BODY_CHARS || body.length > MAX_BODY_CHARS || css.length > MAX_CSS_CHARS) return null
  return { css, body }
}

function liveHeadAssets(): string {
  if (typeof document === 'undefined') return ''
  const parts: string[] = []
  document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
    const id = el.id || ''
    if (/nanoai-visual-editor|^pw-viewed-pdp/i.test(id)) return
    parts.push(el.outerHTML)
  })
  return parts.join('')
}

function liveHtmlOpenTag(): string {
  if (typeof document === 'undefined') return '<html data-pw-page="product">'
  const attrs = HTML_ATTRS.map((name) => {
    const value = document.documentElement.getAttribute(name)
    return value ? `${name}="${escapeAttr(value)}"` : ''
  }).filter(Boolean)
  if (!attrs.some((item) => item.startsWith('data-pw-page='))) attrs.unshift('data-pw-page="product"')
  return `<html ${attrs.join(' ')}>`
}

/** What the visitor actually sees: theme CSS, hoisted head, dock, and the product shell. */
export function captureLiveViewedProductDocument(): string | null {
  if (typeof document === 'undefined' || editorOff()) return null
  const root = document.querySelector('[data-pw-inline-visual-root]')
  if (!root) return null
  const parts: string[] = []
  const chrome = document.querySelector('[data-pw-live-chrome]')
  const dock = document.querySelector('[data-pw-live-dock]')
  const fixed = document.querySelector('[data-pw-live-fixed-layer]')
  if (chrome) parts.push(chrome.outerHTML)
  parts.push(root.outerHTML)
  if (dock) parts.push(dock.outerHTML)
  if (fixed) parts.push(fixed.outerHTML)
  const html = `<!doctype html>${liveHtmlOpenTag()}<head><meta charset="utf-8">${liveHeadAssets()}</head><body>${parts.join('')}</body></html>`
  return finalizeViewedProductDocument(html)
}

export function rememberViewedProductPage(
  pathname: string,
  html: string,
  storage?: ViewedProductStorage | null,
  host?: string
): boolean {
  const path = viewedProductPathname(pathname)
  const box = storage ?? browserStorage()
  if (!path || !box) return false
  const doc = finalizeViewedProductDocument(html)
  const snap = extractViewedProductSnapshot(doc || html)
  if (!snap && !doc) return false
  const key = storageKey(host || browserHost(), path)
  const record: ViewedProductRecord = {
    savedAt: Date.now(),
    css: snap?.css || '',
    body: snap?.body || '',
    ...(doc ? { doc } : {}),
  }
  const payload = JSON.stringify(record)
  let nextIndex = readIndex(box).filter((item) => item !== key)
  nextIndex.push(key)
  nextIndex = trimViewedProductIndex(box, nextIndex, key, payload.length)
  try {
    box.setItem(key, payload)
    writeIndex(box, nextIndex)
    return true
  } catch {
    nextIndex = trimViewedProductIndex(box, nextIndex, key, payload.length, true)
    try {
      box.setItem(key, payload)
      writeIndex(box, nextIndex)
      return true
    } catch {
      return false
    }
  }
}

function trimViewedProductIndex(
  storage: ViewedProductStorage,
  keys: string[],
  incomingKey: string,
  incomingChars: number,
  forceDropOldest = false
): string[] {
  const next = keys.slice()
  const used = () =>
    incomingChars +
    next.reduce((sum, item) => {
      if (item === incomingKey) return sum
      return sum + (storage.getItem(item)?.length ?? 0)
    }, 0)
  if (forceDropOldest && next.length > 1) {
    const oldest = next.shift()
    if (oldest) {
      try {
        storage.removeItem(oldest)
      } catch {
        /* quota or private mode */
      }
    }
  }
  while (
    next.length > 1 &&
    (next.length > PW_VIEWED_PDP_MAX_ENTRIES || used() > PW_VIEWED_PDP_BUDGET_CHARS)
  ) {
    const oldest = next.shift()
    if (!oldest) break
    try {
      storage.removeItem(oldest)
    } catch {
      /* quota or private mode */
    }
  }
  return next
}

export function readViewedProductPage(
  pathname: string,
  storage?: ViewedProductStorage | null,
  host?: string,
  now = Date.now()
): { css: string; body: string; doc: string } | null {
  const path = viewedProductPathname(pathname)
  const box = storage ?? browserStorage()
  if (!path || !box) return null
  const key = storageKey(host || browserHost(), path)
  try {
    const raw = box.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ViewedProductRecord
    if (!parsed || typeof parsed.body !== 'string' || typeof parsed.savedAt !== 'number') {
      dropKey(box, key)
      return null
    }
    if (now - parsed.savedAt > PW_VIEWED_PDP_TTL_MS) {
      dropKey(box, key)
      return null
    }
    return {
      css: String(parsed.css || ''),
      body: parsed.body,
      doc: typeof parsed.doc === 'string' ? parsed.doc : '',
    }
  } catch {
    return null
  }
}

function browserStorage(): ViewedProductStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function browserHost(): string {
  try {
    return window.location.host || ''
  } catch {
    return ''
  }
}

function editorOff(): boolean {
  try {
    return document.body.classList.contains('nanoai-ve-active')
  } catch {
    return false
  }
}

function sessionBox(): ViewedProductStorage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage
  } catch {
    return null
  }
}

function snapshotDocumentFor(snap: { css: string; body: string; doc: string }): string | null {
  if (snap.doc && snapshotIsFaithful(snap.doc)) return snap.doc
  const head = liveHeadAssets()
  const html = `<!doctype html>${liveHtmlOpenTag()}<head><meta charset="utf-8">${head}<style>${snap.css}</style></head><body>${snap.body}</body></html>`
  const doc = finalizeViewedProductDocument(html)
  return doc && snapshotIsFaithful(doc) ? doc : null
}

/** A headless or unstyled fragment looks like a second, broken page. Skip it. */
export function snapshotIsFaithful(html: string): boolean {
  if (!html) return false
  const hasChrome = /pw-header|pw-shop-header|data-pw-region=["']header["']/i.test(html)
  const hasCss = /rel=["']stylesheet["']|<style\b/i.test(html)
  return hasChrome && hasCss
}

function writeSnapshotDoc(pathname: string, doc: string) {
  const box = browserStorage()
  const path = viewedProductPathname(pathname)
  if (!box || !path || !doc) return
  const key = storageKey(browserHost(), path)
  try {
    const raw = box.getItem(key)
    if (!raw) return
    const parsed = JSON.parse(raw) as ViewedProductRecord
    if (!parsed || (parsed.doc && snapshotIsFaithful(parsed.doc))) return
    parsed.doc = doc
    box.setItem(key, JSON.stringify(parsed))
  } catch {
    /* quota — the in-memory frame still paints */
  }
}

function mountSnapshotFrame(path: string, doc: string) {
  const previous = document.getElementById(PW_VIEWED_PDP_SNAP_ID)
  previous?.remove()
  const frame = document.createElement('iframe')
  frame.id = PW_VIEWED_PDP_SNAP_ID
  frame.setAttribute('data-pw-viewed-pdp-snap', '1')
  frame.setAttribute('data-pw-snap-path', path)
  frame.setAttribute('sandbox', 'allow-same-origin allow-scripts')
  frame.setAttribute('aria-hidden', 'true')
  frame.title = ''
  frame.style.cssText =
    'position:fixed;inset:0;z-index:10040;width:100%;height:100%;border:0;background:#fff'
  frame.srcdoc = doc
  frame.addEventListener('load', () => {
    try {
      frame.contentWindow?.addEventListener(
        'scroll',
        () => {
          const y = frame.contentWindow?.scrollY || 0
          if (y > 0) sessionBox()?.setItem(PW_VIEWED_PDP_SCROLL_KEY, String(Math.round(y)))
        },
        { passive: true }
      )
    } catch {
      /* sandbox or cross-document */
    }
  })
  ;(document.body || document.documentElement).appendChild(frame)
}

function armSnapshotHold(path: string) {
  if (snapHoldTimer) window.clearTimeout(snapHoldTimer)
  snapHoldTimer = window.setTimeout(() => {
    const current = document.getElementById(PW_VIEWED_PDP_SNAP_ID)
    if (current?.getAttribute('data-pw-snap-path') === path) current.remove()
    snapHoldTimer = 0
  }, SNAP_HOLD_MS)
}

/** Paint the last opened product over the current page. Returns false on a miss. */
export function showViewedProductSnapshot(pathname: string): boolean {
  if (typeof document === 'undefined' || editorOff()) return false
  const path = viewedProductPathname(pathname)
  if (!path) return false
  const snap = readViewedProductPage(path)
  if (!snap) return false
  const doc = snapshotDocumentFor(snap)
  if (!doc) return false
  if (!snap.doc || !snapshotIsFaithful(snap.doc)) writeSnapshotDoc(path, doc)
  const session = sessionBox()
  const previousHandoff = session?.getItem(PW_VIEWED_PDP_HANDOFF_KEY) || ''
  if (previousHandoff !== path) session?.removeItem(PW_VIEWED_PDP_SCROLL_KEY)
  session?.setItem(PW_VIEWED_PDP_HANDOFF_KEY, path)
  try {
    history.scrollRestoration = 'manual'
  } catch {
    /* ignore */
  }
  mountSnapshotFrame(path, doc)
  armSnapshotHold(path)
  return true
}

export function persistViewedProductSnapshotScroll(): void {
  if (typeof document === 'undefined') return
  const frame = document.getElementById(PW_VIEWED_PDP_SNAP_ID) as HTMLIFrameElement | null
  if (!frame) return
  try {
    const y = frame.contentWindow?.scrollY || 0
    if (y > 0) sessionBox()?.setItem(PW_VIEWED_PDP_SCROLL_KEY, String(Math.round(y)))
  } catch {
    /* ignore */
  }
}

function frameScrollY(frame: HTMLIFrameElement): number {
  try {
    const y = frame.contentWindow?.scrollY || frame.contentDocument?.documentElement.scrollTop || 0
    if (y > 0) return y
  } catch {
    /* sandbox */
  }
  try {
    return Number(sessionBox()?.getItem(PW_VIEWED_PDP_SCROLL_KEY) || 0)
  } catch {
    return 0
  }
}

function pinWindowScroll(y: number) {
  if (y <= 1) return
  try {
    history.scrollRestoration = 'manual'
  } catch {
    /* ignore */
  }
  const until = Date.now() + SCROLL_LOCK_MS
  let userMoved = false
  const unlock = () => {
    userMoved = true
  }
  window.addEventListener('wheel', unlock, { passive: true, once: true })
  window.addEventListener('touchmove', unlock, { passive: true, once: true })
  window.addEventListener('keydown', unlock, { once: true })
  const apply = () => {
    if (!userMoved) window.scrollTo(0, y)
  }
  apply()
  const onScroll = () => {
    if (userMoved || Date.now() > until) {
      window.removeEventListener('scroll', onScroll)
      return
    }
    if (window.scrollY + 8 < y) apply()
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.setTimeout(() => window.removeEventListener('scroll', onScroll), SCROLL_LOCK_MS + 40)
}

/**
 * Live PDP is in the document. Drop the preview without sending the viewport
 * back to the top — the visitor should not see a second load.
 */
export function releaseViewedProductSnapshot(): boolean {
  if (typeof document === 'undefined') return false
  const frame = document.getElementById(PW_VIEWED_PDP_SNAP_ID) as HTMLIFrameElement | null
  if (!frame) return false
  const path = viewedProductPathname(window.location.pathname)
  if (!path || frame.getAttribute('data-pw-snap-path') !== path) return false
  const root = document.querySelector('[data-pw-inline-visual-root]')
  if (!root?.querySelector('[data-pw-region="pdp-info"], [data-pw-region="gallery"]')) return false
  const y = frameScrollY(frame)
  let painted = false
  try {
    painted = Boolean(
      frame.contentDocument?.querySelector('[data-pw-region="pdp-info"], [data-pw-region="gallery"]')
    )
  } catch {
    painted = false
  }
  if (!painted && y > 1) {
    if (frame.getAttribute('data-pw-snap-wait') !== '1') {
      frame.setAttribute('data-pw-snap-wait', '1')
      frame.addEventListener('load', () => releaseViewedProductSnapshot(), { once: true })
      return false
    }
  }
  if (snapHoldTimer) {
    window.clearTimeout(snapHoldTimer)
    snapHoldTimer = 0
  }
  if (y > 1) pinWindowScroll(y)
  frame.remove()
  try {
    sessionBox()?.removeItem(PW_VIEWED_PDP_HANDOFF_KEY)
  } catch {
    /* ignore */
  }
  return true
}

/** After the live product shell has painted, peel the preview off at the same scroll. */
export function scheduleViewedProductSnapshotRelease(): () => void {
  if (typeof window === 'undefined') return () => {}
  let cancelled = false
  let raf = 0
  raf = window.requestAnimationFrame(() => {
    if (cancelled) return
    raf = window.requestAnimationFrame(() => {
      if (!cancelled) releaseViewedProductSnapshot()
    })
  })
  return () => {
    cancelled = true
    if (raf) window.cancelAnimationFrame(raf)
  }
}

/**
 * Parser-blocking paint for the destination document. The full navigation
 * would otherwise flash a blank page and jump to the top.
 */
export function buildViewedProductSnapshotBootScript(): string {
  return `(()=>{try{
    var handoff=${JSON.stringify(PW_VIEWED_PDP_HANDOFF_KEY)};
    var wanted=sessionStorage.getItem(handoff);
    if(!wanted) return;
    var path=(window.location.pathname||'').split('?')[0].split('#')[0];
    var parts=path.split('/').filter(Boolean);
    var at=parts.lastIndexOf('products');
    if(at<0||at!==parts.length-2||!parts[at+1]||parts[at+1]==='outfit'){sessionStorage.removeItem(handoff);return;}
    var norm='/'+parts.join('/');
    if(wanted!==norm) return;
    var raw=localStorage.getItem(${JSON.stringify(PW_VIEWED_PDP_CACHE_PREFIX)}+(window.location.host||'').toLowerCase()+norm);
    if(!raw){sessionStorage.removeItem(handoff);return;}
    var parsed=JSON.parse(raw);
    var doc=parsed&&typeof parsed.doc==='string'?parsed.doc:'';
    if(!doc){sessionStorage.removeItem(handoff);return;}
    var faithful=/pw-header|pw-shop-header|data-pw-region=["']header["']/i.test(doc)&&/rel=["']stylesheet["']|<style\\b/i.test(doc);
    if(!faithful){sessionStorage.removeItem(handoff);return;}
    if(document.getElementById(${JSON.stringify(PW_VIEWED_PDP_SNAP_ID)})) return;
    var frame=document.createElement('iframe');
    frame.id=${JSON.stringify(PW_VIEWED_PDP_SNAP_ID)};
    frame.setAttribute('data-pw-viewed-pdp-snap','1');
    frame.setAttribute('data-pw-snap-path',norm);
    frame.setAttribute('sandbox','allow-same-origin allow-scripts');
    frame.setAttribute('aria-hidden','true');
    frame.title='';
    frame.style.cssText='position:fixed;inset:0;z-index:10040;width:100%;height:100%;border:0;background:#fff';
    frame.srcdoc=doc;
    (document.body||document.documentElement).appendChild(frame);
    try{history.scrollRestoration='manual'}catch(e){}
    setTimeout(function(){var el=document.getElementById(${JSON.stringify(PW_VIEWED_PDP_SNAP_ID)});if(el)el.remove();},12000);
  }catch(err){}})();`
}

export function clearViewedProductSnapshot(): void {
  if (snapHoldTimer) {
    window.clearTimeout(snapHoldTimer)
    snapHoldTimer = 0
  }
  if (typeof document === 'undefined') return
  document.getElementById(PW_VIEWED_PDP_SNAP_ID)?.remove()
  try {
    sessionBox()?.removeItem(PW_VIEWED_PDP_HANDOFF_KEY)
  } catch {
    /* ignore */
  }
}
