'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { SITE_HEADER_BACK_SLOT_ID } from '@/components/layout/site-header-back-slot'
import { cn } from '@/lib/utils'

const BackHandlerRefContext = createContext<MutableRefObject<(() => void) | null> | null>(null)

/** Bọc `CreationToolPageShell` — cho phép trang con gắn xử lý Quay lại (vd. tab nội bộ trước khi history.back). */
export function CreationToolBackOverrideProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<(() => void) | null>(null)
  return <BackHandlerRefContext.Provider value={handlerRef}>{children}</BackHandlerRefContext.Provider>
}

/** Đăng ký handler nút Quay lại của shell; cleanup khi unmount. Handler=null tắt override. */
export function useSetCreationToolBackHandler(handler: (() => void) | null) {
  const ref = useContext(BackHandlerRefContext)
  useEffect(() => {
    if (!ref) return
    ref.current = handler
    return () => {
      ref.current = null
    }
  }, [ref, handler])
}

export function CreationToolShellBackButton({
  label,
  className,
}: {
  label: ReactNode
  className?: string
}) {
  const router = useRouter()
  const handlerRef = useContext(BackHandlerRefContext)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const onClick = useCallback(() => {
    const fn = handlerRef?.current
    if (fn) fn()
    else router.back()
  }, [handlerRef, router])
  useLayoutEffect(() => {
    setSlot(document.getElementById(SITE_HEADER_BACK_SLOT_ID))
  }, [])
  const accessible = typeof label === 'string' ? label : undefined
  if (!slot) return null
  return createPortal(
    <button
      type="button"
      data-creation-tool-back=""
      aria-label={accessible}
      title={accessible}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background text-sm font-medium text-foreground shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'sm:w-auto sm:px-2.5',
        className
      )}
      onClick={onClick}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline" aria-hidden>
        {label}
      </span>
    </button>,
    slot
  )
}
