'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/** Trên dialog thiệp (z-240). */
const FILE_LAYER_Z = 260

/**
 * Ô chọn file gắn lên document.body, đúng vùng nút.
 * WebView Facebook (iOS) không mở thư viện ảnh khi input nằm trong transform,
 * opacity 0, hoặc touch-action: none. Nút «Chọn khung» không bị vì nó là button thường.
 */
export function WeddingDeviceFileInput(props: {
  label: ReactNode
  className?: string
  accept?: string
  multiple?: boolean
  disabled?: boolean
  inputId?: string
  onFiles: (files: File[]) => void
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const anchor = anchorRef.current
    const input = inputRef.current
    if (!anchor || !input) return
    if (props.disabled) {
      input.style.visibility = 'hidden'
      input.style.pointerEvents = 'none'
      return
    }
    let frame = 0
    const sync = () => {
      const rect = anchor.getBoundingClientRect()
      const usable = rect.width >= 8 && rect.height >= 8
      input.style.left = `${rect.left}px`
      input.style.top = `${rect.top}px`
      input.style.width = `${Math.max(0, rect.width)}px`
      input.style.height = `${Math.max(0, rect.height)}px`
      if (!usable) {
        input.style.visibility = 'hidden'
        input.style.pointerEvents = 'none'
        return
      }
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const hits = document.elementsFromPoint(cx, cy).filter((el) => el !== input)
      const top = hits[0]
      const open = top === anchor || (top != null && anchor.contains(top))
      input.style.visibility = open ? 'visible' : 'hidden'
      input.style.pointerEvents = open ? 'auto' : 'none'
    }
    const loop = () => {
      sync()
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      input.style.visibility = 'hidden'
      input.style.pointerEvents = 'none'
    }
  }, [mounted, props.disabled])

  const input = (
    <input
      ref={inputRef}
      id={props.inputId}
      type="file"
      accept={props.accept ?? 'image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif'}
      multiple={props.multiple ? true : undefined}
      disabled={props.disabled}
      tabIndex={-1}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        margin: 0,
        padding: 0,
        border: 0,
        opacity: 0.02,
        fontSize: '16px',
        zIndex: FILE_LAYER_Z,
        cursor: 'pointer',
        visibility: 'hidden',
      }}
      onChange={(event) => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        if (files.length) props.onFiles(files)
      }}
    />
  )

  return (
    <span
      ref={anchorRef}
      data-wedding-file-anchor=""
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center justify-center',
        props.className,
        props.disabled && 'pointer-events-none opacity-60',
      )}
    >
      <span className="pointer-events-none inline-flex items-center justify-center gap-2">{props.label}</span>
      {mounted ? createPortal(input, document.body) : null}
    </span>
  )
}
