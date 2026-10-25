type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext || w.webkitAudioContext || null
}

/** Giữ context từ cú bấm Bắt đầu để hết giờ vẫn phát được tiếng. */
export function unlockExamBellAudio(): AudioContext | null {
  const Ctor = audioContextCtor()
  if (!Ctor) return null
  const ctx = new Ctor()
  void ctx.resume().catch(() => {})
  const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  src.start()
  return ctx
}

function strike(ctx: AudioContext, when: number) {
  const fundamental = ctx.createOscillator()
  const fundamentalGain = ctx.createGain()
  fundamental.type = 'sine'
  fundamental.frequency.setValueAtTime(880, when)
  fundamental.frequency.exponentialRampToValueAtTime(523.25, when + 1.4)
  fundamentalGain.gain.setValueAtTime(0.0001, when)
  fundamentalGain.gain.exponentialRampToValueAtTime(0.32, when + 0.015)
  fundamentalGain.gain.exponentialRampToValueAtTime(0.0001, when + 1.7)
  fundamental.connect(fundamentalGain)
  fundamentalGain.connect(ctx.destination)
  fundamental.start(when)
  fundamental.stop(when + 1.75)

  const partial = ctx.createOscillator()
  const partialGain = ctx.createGain()
  partial.type = 'triangle'
  partial.frequency.setValueAtTime(1760, when)
  partialGain.gain.setValueAtTime(0.0001, when)
  partialGain.gain.exponentialRampToValueAtTime(0.08, when + 0.012)
  partialGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.9)
  partial.connect(partialGain)
  partialGain.connect(ctx.destination)
  partial.start(when)
  partial.stop(when + 1)
}

/** Chuông báo hết giờ: ba tiếng, dùng context đã mở lúc bấm Bắt đầu nếu có. */
export function playExamEndBell(existing?: AudioContext | null) {
  const ctx = existing && existing.state !== 'closed' ? existing : unlockExamBellAudio()
  if (!ctx) return
  void ctx.resume().catch(() => {})
  const t0 = ctx.currentTime + 0.05
  strike(ctx, t0)
  strike(ctx, t0 + 0.45)
  strike(ctx, t0 + 0.9)
}
