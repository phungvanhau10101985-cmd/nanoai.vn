/**
 * Browser preview of product pages this visitor already opened.
 * Soft-nav paints the last HTML immediately; the server page still replaces it
 * with live price and stock. Not a checkout source. Not shared Redis HTML.
 */

export const PW_VIEWED_PDP_CACHE_PREFIX = 'pw-viewed-pdp-v1:'
export const PW_VIEWED_PDP_INDEX_KEY = 'pw-viewed-pdp-index-v1'
export const PW_VIEWED_PDP_SNAP_ID = 'pw-viewed-pdp-snap'
/** Same window as the account profile cache. The copy never leaves this browser. */
export const PW_VIEWED_PDP_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Matches the recently-viewed list. Older pages drop when this or the byte budget is hit. */
export const PW_VIEWED_PDP_MAX_ENTRIES = 24
/** Leave room in the origin's ~5MB localStorage for the account cache and search history. */
export const PW_VIEWED_PDP_BUDGET_CHARS = 2_500_000

const MIN_BODY_CHARS = 40
const MAX_BODY_CHARS = 400_000
const MAX_CSS_CHARS = 500_000
const SNAP_HOLD_MS = 12_000

export type ViewedProductStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type ViewedProductRecord = {
  savedAt: number
  css: string
  body: string
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

export function extractViewedProductSnapshot(html: string): { css: string; body: string } | null {
  if (!html || !/data-pw-page=["']product["']|data-pw-region=["']pdp-info["']/i.test(html)) return null
  const cssParts: string[] = []
  html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_full, css: string) => {
    const text = String(css || '').trim()
    if (text) cssParts.push(text)
    return ''
  })
  const css = cssParts.join('\n')
  const bodyRaw = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() || html
  const body = bodyRaw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/(^|[\s])href=/gi, '$1data-pw-snap-href=')
  if (body.length < MIN_BODY_CHARS || body.length > MAX_BODY_CHARS || css.length > MAX_CSS_CHARS) return null
  return { css, body }
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
  const snap = extractViewedProductSnapshot(html)
  if (!snap) return false
  const key = storageKey(host || browserHost(), path)
  const record: ViewedProductRecord = { savedAt: Date.now(), css: snap.css, body: snap.body }
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
): { css: string; body: string } | null {
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
    return { css: String(parsed.css || ''), body: parsed.body }
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

/** Paint the last opened product over the current page. Returns false on a miss. */
export function showViewedProductSnapshot(pathname: string): boolean {
  if (typeof document === 'undefined' || editorOff()) return false
  const path = viewedProductPathname(pathname)
  if (!path) return false
  const snap = readViewedProductPage(path)
  if (!snap) return false
  let host = document.getElementById(PW_VIEWED_PDP_SNAP_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = PW_VIEWED_PDP_SNAP_ID
    host.setAttribute('data-pw-viewed-pdp-snap', '1')
    const swallow = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
    }
    host.addEventListener('pointerdown', swallow, true)
    host.addEventListener('pointerup', swallow, true)
    host.addEventListener('click', swallow, true)
    document.body.appendChild(host)
  }
  host.setAttribute('data-pw-snap-path', path)
  host.innerHTML = `<style>#${PW_VIEWED_PDP_SNAP_ID}{position:fixed;inset:0;z-index:10040;overflow:auto;background:#fff;-webkit-overflow-scrolling:touch}${snap.css}</style>${snap.body}`
  if (snapHoldTimer) window.clearTimeout(snapHoldTimer)
  snapHoldTimer = window.setTimeout(() => {
    const current = document.getElementById(PW_VIEWED_PDP_SNAP_ID)
    if (current?.getAttribute('data-pw-snap-path') === path) current.remove()
    snapHoldTimer = 0
  }, SNAP_HOLD_MS)
  return true
}

export function clearViewedProductSnapshot(): void {
  if (snapHoldTimer) {
    window.clearTimeout(snapHoldTimer)
    snapHoldTimer = 0
  }
  if (typeof document === 'undefined') return
  document.getElementById(PW_VIEWED_PDP_SNAP_ID)?.remove()
}
