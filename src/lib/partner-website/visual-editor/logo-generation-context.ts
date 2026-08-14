const VE_MESSAGE = 'nanoai-visual-editor'

export type LogoContextCapture = {
  dataUrl: string
  bgColor: string
  bgImageUrl: string
  themePrimary: string
  themeAccent: string
  themeBuy: string
}

export function collectHttpImageUrls(urls: Array<string | null | undefined>, max = 6): string[] {
  const out: string[] = []
  for (const raw of urls) {
    const s = String(raw || '').trim()
    if (!/^https?:\/\//i.test(s)) continue
    if (out.includes(s)) continue
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

export function dataUrlToPngFile(dataUrl: string, filename: string): File | null {
  const m = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i)
  if (!m) return null
  const mime = m[1]
  const bin = atob(m[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

export function makeThemeSwatchDataUrl(input: {
  bgColor: string
  primaryColor: string
  accentColor: string
  buyButtonColor: string
}): string {
  if (typeof document === 'undefined') return ''
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = input.bgColor || '#ffffff'
  ctx.fillRect(0, 0, 360, 160)
  ctx.fillStyle = input.primaryColor || '#111827'
  ctx.fillRect(360, 0, 152, 54)
  ctx.fillStyle = input.accentColor || input.primaryColor || '#111827'
  ctx.fillRect(360, 54, 152, 53)
  ctx.fillStyle = input.buyButtonColor || input.primaryColor || '#111827'
  ctx.fillRect(360, 107, 152, 53)
  return canvas.toDataURL('image/png')
}

export function requestLogoContextFromIframe(
  iframe: HTMLIFrameElement | null
): Promise<LogoContextCapture | null> {
  const win = iframe?.contentWindow
  if (!win) return Promise.resolve(null)
  const requestId = `logo-ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMsg)
      resolve(null)
    }, 2500)
    function onMsg(ev: MessageEvent) {
      const data = ev.data as Partial<LogoContextCapture> & { source?: string; type?: string; requestId?: string }
      if (data?.source !== VE_MESSAGE || data.type !== 'logoContext') return
      if (data.requestId && data.requestId !== requestId) return
      window.clearTimeout(timer)
      window.removeEventListener('message', onMsg)
      resolve({
        dataUrl: String(data.dataUrl || ''),
        bgColor: String(data.bgColor || ''),
        bgImageUrl: String(data.bgImageUrl || ''),
        themePrimary: String(data.themePrimary || ''),
        themeAccent: String(data.themeAccent || ''),
        themeBuy: String(data.themeBuy || ''),
      })
    }
    window.addEventListener('message', onMsg)
    win.postMessage({ source: VE_MESSAGE, type: 'captureLogoContext', requestId }, '*')
  })
}
