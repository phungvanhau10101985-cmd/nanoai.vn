'use client'

import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { capitalizeInvitationPersonName } from '@/lib/wedding/capitalize-person-name'
import { WEDDING_EDIT_SIDE, type WeddingEditSide } from '@/lib/wedding/wedding-side-edit-color'
import './wedding-cover-intro.css'

/** Cỡ chữ tạm để tên dài không tràn trước khi đo. Tên ngắn vẫn chạm trần của class. */
function coupleNameFallbackSize(groomName: string, brideName: string): string {
  const chars = Math.max(groomName.length + (brideName ? brideName.length + 4 : 0), 1)
  const cqi = (100 / (chars * 0.66)).toFixed(2)
  return `clamp(1.05rem, min(8cqi, ${cqi}cqi), 4.25rem)`
}

/** Thu nhỏ từ cỡ class cho đến khi cả dòng nằm trong khung. */
function tightenCoupleName(el: HTMLHeadingElement) {
  if (el.clientWidth < 8) return
  const previous = el.style.fontSize
  el.style.fontSize = ''
  const cap = parseFloat(getComputedStyle(el).fontSize)
  if (!Number.isFinite(cap) || cap <= 0) {
    el.style.fontSize = previous
    return
  }
  let size = cap
  el.style.fontSize = `${size}px`
  for (let step = 0; step < 10 && el.scrollWidth > el.clientWidth + 2 && size > 15; step += 1) {
    const next = Math.max(15, Math.floor((size * el.clientWidth) / Math.max(el.scrollWidth, 1)))
    if (next === size) break
    size = next
    el.style.fontSize = `${size}px`
  }
}

export type WeddingCoupleNameEdit = {
  value: string
  onChange: (value: string) => void
  onFocus?: () => void
  label: string
}

function CoupleNameField(props: {
  edit?: WeddingCoupleNameEdit
  text: string
  flyIn?: boolean
  from?: 'left' | 'right'
  side?: WeddingEditSide
}) {
  if (props.edit) {
    const side = props.side ?? (props.from === 'right' ? 'bride' : 'groom')
    const tone = WEDDING_EDIT_SIDE[side]
    const shown = props.edit.value.trim() || props.edit.label
    return (
      <span className="relative inline-block max-w-[46%] min-w-[3rem] text-center">
        <span className="invisible inline-block max-w-full whitespace-nowrap">{shown}</span>
        <input
          aria-label={props.edit.label}
          data-wedding-text={side === 'bride' ? 'brideName' : 'groomName'}
          data-wedding-side={side}
          value={props.edit.value}
          onChange={(event) => props.edit?.onChange(event.target.value)}
          onBlur={(event) => {
            const raw = event.target.value
            const next = capitalizeInvitationPersonName(raw)
            if (next !== raw) props.edit?.onChange(next)
          }}
          onFocus={props.edit.onFocus}
          style={{ color: tone.ink }}
          className={cn('absolute inset-0 m-0 w-full truncate border-0 bg-transparent p-0 text-center outline-none ring-1 ring-dashed [font:inherit]', tone.ring)}
        />
      </span>
    )
  }
  return (
    <span className={cn('inline-block max-w-full whitespace-nowrap', props.flyIn && (props.from === 'right' ? 'wedding-couple-from-right' : 'wedding-couple-from-left'))}>
      {props.text}
    </span>
  )
}

/** Tên hiện bằng nét sâu theo chủ đề, gặp nhau ở dấu &. */
export function WeddingCoupleNames(props: {
  groomName: string
  brideName: string
  /** primary = một tên. Tên phụ không đứng ngang hàng với dấu &. */
  layout?: 'pair' | 'primary'
  flyIn?: boolean
  /** reveal = chạy vào lúc cửa thiệp chính mở. opened = tên bay vào rồi từng câu hiện tiếp. */
  pace?: 'cover' | 'reveal' | 'opened'
  className?: string
  groomEdit?: WeddingCoupleNameEdit
  brideEdit?: WeddingCoupleNameEdit
}) {
  const editing = Boolean(props.groomEdit || props.brideEdit)
  const groomName = (props.groomEdit?.value ?? props.groomName).trim()
  const brideName = props.layout === 'primary' ? '' : (props.brideEdit?.value ?? props.brideName).trim()
  const flyIn = props.flyIn && !editing
  const ref = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) tightenCoupleName(el)
  })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (el.scrollWidth > el.clientWidth + 2) tightenCoupleName(el)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [brideName, editing, groomName])

  const frame = cn(
    'w-full min-w-0 max-w-full',
    flyIn && props.pace === 'reveal' && 'wedding-couple-pace-reveal',
    flyIn && props.pace === 'opened' && 'wedding-couple-pace-opened',
    props.className,
  )
  const fitStyle = { fontSize: coupleNameFallbackSize(groomName, brideName) }

  if (!brideName && !props.brideEdit) {
    return (
      <h1 ref={ref} className={cn('flex items-baseline justify-center', frame)} style={fitStyle}>
        {props.groomEdit ? (
          <CoupleNameField edit={props.groomEdit} text={groomName} side="groom" />
        ) : (
          <span className={cn('inline-block max-w-full', flyIn ? 'whitespace-nowrap' : 'break-words', flyIn && 'wedding-couple-from-left')}>{groomName}</span>
        )}
      </h1>
    )
  }
  return (
    <h1
      ref={ref}
      className={cn('flex flex-nowrap items-baseline justify-center gap-x-[0.35em]', frame)}
      style={fitStyle}
    >
      <CoupleNameField edit={props.groomEdit} text={groomName} flyIn={flyIn} from="left" side="groom" />
      <span className={cn('shrink-0', flyIn && 'wedding-couple-amp')}>&</span>
      <CoupleNameField edit={props.layout === 'primary' ? undefined : props.brideEdit} text={brideName} flyIn={flyIn} from="right" side="bride" />
    </h1>
  )
}
