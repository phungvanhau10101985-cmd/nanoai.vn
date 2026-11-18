import { isLocalDevHost, LOCAL_PHONE_NGROK_ORIGIN } from '@/lib/curriculum/phone-remote-public-origin'

type PhoneCommand = Record<string, unknown>

/** Máy giáo viên đang mở local thì QR phải là link ngrok để điện thoại mở được. */
export async function phoneRemoteLoginOrigin(): Promise<string> {
  if (typeof window === 'undefined') return LOCAL_PHONE_NGROK_ORIGIN
  if (!isLocalDevHost(window.location.hostname)) return window.location.origin
  try {
    const res = await fetch('/api/giao-trinh/phone-remote/public-origin', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    const origin = typeof data?.origin === 'string' ? data.origin.replace(/\/$/, '') : ''
    if (res.ok && /^https?:\/\//.test(origin) && !isLocalDevHost(new URL(origin).hostname)) return origin
  } catch {
    /* ngrok inspector không trả lời thì dùng domain cố định */
  }
  return LOCAL_PHONE_NGROK_ORIGIN
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
      if (prev && prev.type === type && (collapseMove || collapseTyping)) {
        queue[queue.length - 1] = msg
      } else {
        queue.push(msg)
      }
      const urgent = type === 'mouse-click' || type === 'control-press' || type === 'slide-go' || type === 'student-curriculum-right-mode' || type.endsWith('-open') || type.endsWith('-close') || (type === 'worksheet-answer-reveal' && msg.control === true)
      if (urgent) {
        if (timer != null) window.clearTimeout(timer)
        timer = window.setTimeout(flush, 0)
        return
      }
      if (timer != null) return
      timer = window.setTimeout(flush, 90)
    },
    stop() {
      if (timer != null) window.clearTimeout(timer)
      timer = null
      flush()
    },
  }
}
