'use client'

import { useEffect, useLayoutEffect, useState } from 'react'

/**
 * Khoảng bị che giữa đáy layout viewport và đáy visual viewport (thường do bàn phím ảo).
 * Dùng tăng padding-bottom cho khung nhập chat trên mobile / Facebook in-app browser
 * **khi không** ép chiều cao shell theo `useVisualViewportClientHeight` (tránh cộng dồn).
 */
export function useVisualViewportBottomInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const layoutH = window.innerHeight
        const visualBottom = vv.offsetTop + vv.height
        const next = Math.max(0, Math.round(layoutH - visualBottom))
        setInset((prev) => (prev === next ? prev : next))
      })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)

    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return inset
}

/**
 * Chiều cao visual viewport (vùng còn nhìn thấy khi bàn phím mở).
 * Một số WebView / Facebook in-app không co `100dvh`/`innerHeight` đúng — ép khung chat
 * bằng giá trị này để ô nhập không nằm dưới bàn phím.
 * `null` đến khi mount (tránh lệch hydration với SSR).
 */
export function useVisualViewportClientHeight(): number | null {
  const [h, setH] = useState<number | null>(null)

  useLayoutEffect(() => {
    const vv = window.visualViewport
    if (!vv) {
      setH(Math.round(window.innerHeight))
      return
    }

    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const next = Math.round(vv.height)
        setH((prev) => (prev === next ? prev : next))
      })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)

    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return h
}
