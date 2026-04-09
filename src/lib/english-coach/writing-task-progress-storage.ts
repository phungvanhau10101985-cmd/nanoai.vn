const PREFIX = 'app_writing_task_progress:'
const PREFIX_LEGACY = 'nanoai_writing_task_progress:'

function keysForSession(sid: string): [string, string] {
  return [`${PREFIX}${sid}`, `${PREFIX_LEGACY}${sid}`]
}

export function getWritingTaskProgressLocal(sessionId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const [k, leg] = keysForSession(sessionId)
    return window.localStorage.getItem(k) ?? window.localStorage.getItem(leg)
  } catch {
    return null
  }
}

export function setWritingTaskProgressLocal(sessionId: string, json: string): void {
  if (typeof window === 'undefined') return
  try {
    const [k, leg] = keysForSession(sessionId)
    window.localStorage.setItem(k, json)
    window.localStorage.setItem(leg, json)
  } catch {
    /* quota / private mode */
  }
}

export function clearWritingTaskProgressLocal(sessionId: string): void {
  if (typeof window === 'undefined') return
  try {
    for (const k of keysForSession(sessionId)) window.localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}
