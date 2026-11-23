import { isLocalDevHost, isPrivateLanHost, phonePublicHref } from '@/lib/curriculum/phone-remote-public-origin'

type PhoneCommand = Record<string, unknown>

function isNgrokHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  return host.endsWith('.ngrok-free.dev') || host.endsWith('.ngrok.io') || host.endsWith('.ngrok.app') || host.endsWith('.ngrok.dev')
}

function phoneCanOpenOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (!isLocalDevHost(url.hostname)) return true
    return isPrivateLanHost(url.hostname)
  } catch {
    return false
  }
}

function withOrigin(raw: string, origin: string): string {
  if (raw.startsWith('/')) return `${origin}${raw}`
  const url = new URL(raw)
  const next = new URL(origin)
  url.protocol = next.protocol
  url.host = next.host
  return url.href
}

/** Link điện thoại quét. Máy giáo viên đang test local thì mọi mã đều mở tunnel Cloudflare đang chạy. */
export async function phoneOpenableUrl(input: string): Promise<string> {
  const raw = input.trim()
  if (!raw) return ''
  const pageIsLocal = typeof window !== 'undefined' && isLocalDevHost(window.location.hostname)
  if (!pageIsLocal) {
    if (raw.startsWith('/')) return typeof window === 'undefined' ? '' : phonePublicHref(`${window.location.origin}${raw}`)
    try {
      const url = new URL(raw)
      if (typeof window !== 'undefined' && (isLocalDevHost(url.hostname) || isNgrokHost(url.hostname))) {
        return phonePublicHref(withOrigin(raw, window.location.origin))
      }
      return phonePublicHref(url.href)
    } catch {
      return ''
    }
  }
  const origin = await phoneRemoteLoginOrigin()
  if (!origin) return ''
  try {
    return phonePublicHref(withOrigin(raw, origin))
  } catch {
    return ''
  }
}

/** Máy giáo viên mở local thì QR điện thoại là tunnel Cloudflare đang chạy. */
export async function phoneRemoteLoginOrigin(): Promise<string> {
  if (typeof window === 'undefined') return ''
  if (!isLocalDevHost(window.location.hostname)) return window.location.origin
  try {
    const res = await fetch('/api/giao-trinh/phone-remote/public-origin', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    const origin = typeof data?.origin === 'string' ? data.origin.replace(/\/$/, '') : ''
    if (!res.ok || !phoneCanOpenOrigin(origin)) return ''
    if (isNgrokHost(new URL(origin).hostname)) return ''
    return phonePublicHref(origin)
  } catch {
    return ''
  }
}

/** Xếp lệnh điện thoại, gộp chuột di chuyển, gửi theo cụm ngắn. */
export function createPhoneCommandQueue(sessionId: string) {
  let queue: PhoneCommand[] = []
  let timer: number | null = null

  const flush = () => {
    timer = null
    if (queue.length === 0) return
    const commands = queue.splice(0, 40)
    void fetch('/api/giao-trinh/phone-remote/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({ id: sessionId, commands }),
    }).catch(() => {
      /* mạng chập chờn: lần bấm sau vẫn gửi tiếp */
    })
    if (queue.length > 0) timer = window.setTimeout(flush, 0)
  }

  return {
    push(msg: PhoneCommand) {
      const type = typeof msg.type === 'string' ? msg.type : ''
      const prev = queue.length > 0 ? queue[queue.length - 1] : null
      const collapseMove = type === 'mouse-pos' || type === 'chain-pane-scroll'
      const collapseTyping =
        type === 'worksheet-answer-reveal' &&
        prev?.type === type &&
        (prev.control === true) === (msg.control === true)
      const collapseTimer = type === 'teacher-timer-sync' && prev?.type === type
      const collapseSim = type === 'whiteboard-sim' && prev?.type === type
      const collapseDrawSync = type === 'infographic-draw-sync' && prev?.type === type
      const prevPoints = Array.isArray(prev?.points) ? prev.points : []
      const nextPoints = Array.isArray(msg.points) ? msg.points : []
      const collapseDrawPoints = type === 'infographic-draw-points'
        && prev?.type === type
        && prev.strokeId === msg.strokeId
        && prev.slideIndex === msg.slideIndex
        && prevPoints.length + nextPoints.length <= 300
      if (prev && collapseDrawPoints) {
        queue[queue.length - 1] = { ...msg, points: [...prevPoints, ...nextPoints] }
      } else if (prev && prev.type === type && (collapseMove || collapseTyping || collapseTimer || collapseDrawSync || collapseSim)) {
        queue[queue.length - 1] = msg
      } else {
        queue.push(msg)
      }
      const urgent = type === 'mouse-click' || type === 'control-press' || type === 'slide-go' || type === 'student-curriculum-right-mode' || type === 'student-curriculum-left-pane' || type === 'set-auto-play' || type === 'set-auto-play-interval' || type.startsWith('teacher-timer-') || (type.startsWith('whiteboard-') && type !== 'whiteboard-sim') || type.endsWith('-open') || type.endsWith('-close') || type === 'infographic-draw-undo' || type === 'infographic-draw-clear' || (type === 'worksheet-answer-reveal' && msg.control === true)
      if (urgent) {
        if (timer != null) window.clearTimeout(timer)
        timer = window.setTimeout(flush, 0)
        return
      }
      if (timer != null) return
      const delay = type === 'mouse-pos' || type === 'chain-pane-scroll' || type === 'whiteboard-sim' ? 32 : 90
      timer = window.setTimeout(flush, delay)
    },
    stop() {
      if (timer != null) window.clearTimeout(timer)
      timer = null
      flush()
    },
  }
}
