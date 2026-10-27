import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { weddingOrnamentFilter, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import './wedding-layer.css'

const DRIFT_TRAVEL = [78, -56, 96, -48, 70]

function pageCanScroll() {
  const root = document.scrollingElement || document.documentElement
  return root.scrollHeight > window.innerHeight + 80
}

/** Hoa văn thêm: dưới chữ, trên khung ảnh. Trôi khi khách cuộn nội dung thiệp. */
export function WeddingBackgroundOrnamentLayer(props: {
  ornaments: readonly WeddingBackgroundOrnament[]
  className?: string
  /** Tắt trôi khi đang sửa vị trí hoa. */
  drift?: boolean
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const drift = props.drift !== false
  useEffect(() => {
    const layer = layerRef.current
    if (!layer || !drift) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const images = [...layer.querySelectorAll<HTMLImageElement>('img')]
    let frame = 0
    const apply = () => {
      frame = 0
      if (!pageCanScroll()) {
        images.forEach((img) => {
          img.style.translate = ''
        })
        return
      }
      const view = window.innerHeight || 800
      images.forEach((img) => {
        img.style.translate = '0px 0px'
      })
      images.forEach((img, index) => {
        const rect = img.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const progress = (view * 0.5 - center) / view
        const travel = DRIFT_TRAVEL[index % DRIFT_TRAVEL.length]
        const along = progress * travel
        const sway = progress * 26 * (index % 2 === 0 ? 1 : -1)
        img.style.translate = `${sway}px ${along}px`
      })
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(apply)
    }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    const observer = new ResizeObserver(onScroll)
    observer.observe(document.documentElement)
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('scroll', onScroll, true)
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [drift, props.ornaments])
  if (!props.ornaments.length) return null
  return (
    <div
      ref={layerRef}
      data-wedding-ornaments=""
      className={cn('pointer-events-none absolute inset-0', drift ? 'overflow-hidden' : 'overflow-visible', props.className)}
      style={{ zIndex: 36 }}
      aria-hidden
    >
      {props.ornaments.map((item, index) => (
        <img
          key={`${item.src}-${index}`}
          src={item.src}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{
            left: `${item.x}%`,
            top: item.anchor === 'bottom' ? 'auto' : `${item.y}%`,
            bottom: item.anchor === 'bottom' ? `${item.y}%` : 'auto',
            width: `${item.w}%`,
            opacity: item.opacity ?? 1,
            filter: weddingOrnamentFilter(item),
            transform: `rotate(${item.rotate ?? 0}deg) scaleX(${item.flipX ? -1 : 1})`,
          }}
        />
      ))}
    </div>
  )
}
