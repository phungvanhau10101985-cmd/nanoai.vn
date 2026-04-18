'use client'

import { useEffect, useState } from 'react'

/**
 * Khoảng bị che giữa đáy layout viewport và đáy visual viewport (thường do bàn phím ảo).
 * Dùng tăng padding-bottom cho khung nhập chat trên mobile / Facebook in-app browser.
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
