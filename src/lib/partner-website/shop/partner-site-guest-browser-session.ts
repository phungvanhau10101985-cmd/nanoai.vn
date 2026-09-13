import {
  MESSAGING_GUEST_SESSION_STORAGE_KEY,
  MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY,
  MESSAGING_GUEST_SESSION_SYNC_COOKIE,
} from '@/lib/messaging/guest-auth-session'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'

/**
 * Guest browser session like 188 `188_guest_browser_id`: mint once in localStorage
 * before any personalization POST so PDP view and `/session` share one account_key.
 */
export const PW_ENSURE_GUEST_BROWSER_SESSION_JS = `function pwGuestNewId(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}
function pwEnsureGuestSessionId(){
  var s='';
  try{s=(localStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY_LEGACY)||'');}catch(e){}
  if(!s)s=readCookie('app_guest_session_sync');
  s=String(s||'').trim();
  if(!s){
    s=pwGuestNewId();
    try{localStorage.setItem(SESSION_KEY,s);localStorage.setItem(SESSION_KEY_LEGACY,s);}catch(e){}
  }
  return s;
}`

function readCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

export function readPartnerSiteGuestBrowserSessionId(): string {
  if (typeof window === 'undefined') return ''
  const fromLs =
    window.localStorage.getItem(MESSAGING_GUEST_SESSION_STORAGE_KEY)?.trim() ||
    window.localStorage.getItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY)?.trim() ||
    ''
  if (isValidMessagingGuestSessionId(fromLs)) return fromLs
  const fromCookie = readCookie(MESSAGING_GUEST_SESSION_SYNC_COOKIE).trim()
  if (isValidMessagingGuestSessionId(fromCookie)) return fromCookie
  return ''
}

function persistGuestBrowserSessionId(sessionId: string) {
  if (typeof window === 'undefined' || !isValidMessagingGuestSessionId(sessionId)) return
  window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY, sessionId)
  window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY, sessionId)
}

function mintGuestBrowserSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Stable guest session before view_product / session POST — one key, like 188. */
export function ensurePartnerSiteGuestBrowserSessionId(): string {
  const existing = readPartnerSiteGuestBrowserSessionId()
  if (existing) return existing
  const next = mintGuestBrowserSessionId()
  persistGuestBrowserSessionId(next)
  return next
}
