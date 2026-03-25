/**
 * Một lần patch history + popstate; nhiều subscriber — tránh dùng `usePathname` (Next bailout/hydrate).
 */
const listeners = new Set<() => void>()
let patched = false

function notify() {
  queueMicrotask(() => {
    for (const cb of listeners) {
      try {
        cb()
      } catch {
        /* ignore */
      }
    }
  })
}

function ensurePatched() {
  if (typeof window === 'undefined' || patched) return
  patched = true

  window.addEventListener('popstate', notify)

  const origPush = history.pushState.bind(history)
  const origReplace = history.replaceState.bind(history)
  history.pushState = (...args: Parameters<History['pushState']>) => {
    origPush(...args)
    notify()
  }
  history.replaceState = (...args: Parameters<History['replaceState']>) => {
    origReplace(...args)
    notify()
  }
}

export function subscribeToUrlChanges(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  ensurePatched()
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}
