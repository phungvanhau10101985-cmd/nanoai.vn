const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='

let shared: HTMLAudioElement | null = null

export function getSharedLessonAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!shared) shared = new Audio()
  return shared
}

/**
 * Đọc lần lượt từng ý. Không nhận sự kiện ended của clip trước làm xong clip sau,
 * và lỗi một ý không chặn ý còn lại.
 */
export function playSharedLessonAudio(url: string, rate: number, queue: Promise<void>): Promise<void> {
  const run = async () => {
    const audio = getSharedLessonAudio()
    if (!audio || !url) return
    audio.onended = null
    audio.onerror = null
    audio.onplaying = null
    audio.pause()
    audio.src = url
    const speed = Number(rate)
    audio.playbackRate = Number.isFinite(speed) && speed > 0 ? speed : 1
    await new Promise<void>((resolve) => {
      let settled = false
      let started = false
      let ended = false
      const finish = () => {
        if (settled) return
        settled = true
        audio.onended = null
        audio.onerror = null
        audio.onplaying = null
        resolve()
      }
      const markStarted = () => {
        started = true
        if (ended) finish()
      }
      audio.onplaying = markStarted
      audio.onended = () => {
        ended = true
        if (started) finish()
      }
      audio.onerror = () => {
        if (started) finish()
      }
      void audio.play().then(markStarted).catch(() => finish())
    })
  }
  return queue.catch(() => {}).then(run)
}

/** Gọi ngay trong cú bấm mở bài, trước mọi await, để điện thoại không chặn tiếng đọc sau đó. */
export function primeSharedLessonAudio() {
  const audio = getSharedLessonAudio()
  if (!audio) return
  try {
    audio.src = SILENT_WAV
    const played = audio.play()
    if (played) void played.catch(() => {})
  } catch {
    // Trình duyệt chưa cho phát. Lần bấm sau sẽ thử lại.
  }
}
