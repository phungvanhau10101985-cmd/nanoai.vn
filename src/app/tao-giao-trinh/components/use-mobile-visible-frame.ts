'use client'

import { useEffect, useState } from 'react'

/** Vùng màn hình còn nhìn thấy. Bàn phím mobile không được đẩy cả trang lên. */
export function useMobileVisibleFrame() {
  const [frame, setFrame] = useState({ narrow: false, top: 0, height: 800 })
  useEffect(() => {
    const read = () => {
      const vv = window.visualViewport
      const narrow = window.matchMedia('(max-width: 767px)').matches
      const top = vv?.offsetTop ?? 0
      const height = vv?.height ?? window.innerHeight
      setFrame((prev) => (
        prev.narrow === narrow && prev.top === top && Math.abs(prev.height - height) < 1
          ? prev
          : { narrow, top, height }
      ))
      if (narrow && (window.scrollY !== 0 || document.documentElement.scrollTop !== 0)) {
        window.scrollTo(0, 0)
      }
    }
    read()
    const vv = window.visualViewport
    vv?.addEventListener('resize', read)
    vv?.addEventListener('scroll', read)
    window.addEventListener('resize', read)
    return () => {
      vv?.removeEventListener('resize', read)
      vv?.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [])
  return frame
}

/** Ô đang gõ nằm trong thẻ, không kéo cả trang. */
export function keepEntryFieldInCard(event: { currentTarget: HTMLElement }) {
  const field = event.currentTarget
  const card = field.closest('[data-wb-entry]') as HTMLElement | null
  if (card) {
    const top = field.offsetTop - card.offsetTop
    const bottom = top + field.offsetHeight
    if (top < card.scrollTop) card.scrollTop = Math.max(0, top - 8)
    else if (bottom > card.scrollTop + card.clientHeight) {
      card.scrollTop = bottom - card.clientHeight + 8
    }
  }
  window.scrollTo(0, 0)
}
