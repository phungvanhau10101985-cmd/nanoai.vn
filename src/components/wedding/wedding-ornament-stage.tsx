import { cn } from '@/lib/utils'
import { ORNAMENT_PIECE_RATIO, type OrnamentKit, type OrnamentLayout } from '@/lib/wedding/wedding-ornament-layouts'
import { WeddingOrnamentPiece } from '@/components/wedding/wedding-ornament-pieces'

/** Xếp ảnh khung và ảnh hoa văn lên một tấm thiệp. */
export function WeddingOrnamentStage(props: { kit: OrnamentKit; layout: OrnamentLayout; className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0', props.className)} aria-hidden>
      {props.layout.layers.map((layer, index) => (
        <div
          key={`${layer.piece}-${index}`}
          className="absolute"
          style={{
            left: `${layer.x}%`,
            top: layer.anchor === 'bottom' ? 'auto' : `${layer.y}%`,
            bottom: layer.anchor === 'bottom' ? `${layer.y}%` : 'auto',
            width: `${layer.w}%`,
            aspectRatio: ORNAMENT_PIECE_RATIO[layer.piece],
            opacity: layer.opacity ?? 1,
            zIndex: layer.z ?? 1,
            transform: `rotate(${layer.rotate ?? 0}deg) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
            transformOrigin: 'center',
          }}
        >
          <WeddingOrnamentPiece id={layer.piece} kit={props.kit} />
        </div>
      ))}
    </div>
  )
}
