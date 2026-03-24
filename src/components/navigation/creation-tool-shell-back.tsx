'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const onClick = useCallback(() => {
    const fn = handlerRef?.current
    if (fn) fn()
    else router.back()
  }, [handlerRef, router])
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'w-full touch-manipulation justify-start gap-2 lg:w-auto lg:shrink-0 lg:border-border/80 lg:bg-background/90',
        className
      )}
      onClick={onClick}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Button>
  )
}
