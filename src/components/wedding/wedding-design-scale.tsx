'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { weddingDesignWidth, type WeddingDesignDevice } from '@/lib/wedding/wedding-design-viewport'

/** Thu khổ giấy 1440 hoặc 390 vào cột sửa, không đổi tỷ lệ bên trong. */
export function WeddingDesignScale(props: { device: WeddingDesignDevice; children: ReactNode }) {
  const width = weddingDesignWidth(props.device)
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return
    const fit = () => {
      const nextScale = box.clientWidth > 0 ? box.clientWidth / width : 1
      const nextHeight = inner.offsetHeight
      setScale((current) => (Math.abs(current - nextScale) < 0.004 ? current : nextScale))
      setHeight((current) => (Math.abs(current - nextHeight) < 1 ? current : nextHeight))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [width])

  return (
    <div ref={boxRef} className="relative w-full overflow-hidden" style={{ height: height > 0 ? Math.round(height * scale) : undefined }}>
      <div ref={innerRef} className="absolute left-0 top-0" data-wedding-stage="" style={{ width, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {props.children}
      </div>
    </div>
  )
}
