'use client'

export async function preloadImageUrl(url: string, timeoutMs = 15000): Promise<void> {
  if (!url || typeof window === 'undefined') return

  await new Promise<void>((resolve) => {
    const img = new window.Image()
    const timeout = window.setTimeout(() => resolve(), timeoutMs)
    const done = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    img.onload = done
    img.onerror = done
    img.src = url
  })
}
