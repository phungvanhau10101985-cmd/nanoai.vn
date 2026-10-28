import { cn } from '@/lib/utils'
import { weddingOrnamentFrameStyle, weddingOrnamentImageStyle, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import './wedding-layer.css'

/** Hoa văn thêm: cùng chỗ trên bản sửa, bản xem thử và bản khách. Đứng yên, không trôi theo cuộn. */
export function WeddingBackgroundOrnamentLayer(props: {
  ornaments: readonly WeddingBackgroundOrnament[]
  className?: string
}) {
  if (!props.ornaments.length) return null
  return (
    <div
      data-wedding-ornaments=""
      className={cn('pointer-events-none absolute inset-0 overflow-visible', props.className)}
      style={{ zIndex: 36 }}
      aria-hidden
    >
      {props.ornaments.map((item, index) => (
        <div key={`${item.src}-${index}`} className="absolute max-w-none" style={weddingOrnamentFrameStyle(item)}>
          <img
            src={item.src}
            alt=""
            draggable={false}
            className="block w-full max-w-none select-none"
            style={weddingOrnamentImageStyle(item)}
          />
        </div>
      ))}
    </div>
  )
}
