'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ChevronRight, Send, Smile, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINE_PX = 36
const MAX_PX = 168
const EMOJIS = ['😀', '😁', '😂', '🥰', '😊', '😉', '😎', '🤔', '😅', '😭', '👍', '👏', '🙏', '❤️', '🔥', '✨', '✅', '📚', '✏️', '📝']

export const studyComposerIconClass =
  'inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-[#0084FF] transition-colors hover:bg-black/5 active:bg-black/10 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:h-6 [&_svg]:w-6 [&_svg]:shrink-0'

type Props = {
  id: string
  inputRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder: string
  sendLabel: string
  showToolsLabel: string
  emojiLabel: string
  disabled?: boolean
  canSend: boolean
  tools: ReactNode
}

export function StudyComposerTool({
  label,
  disabled,
  onClick,
  htmlFor,
  expanded,
  children,
}: {
  label: string
  disabled?: boolean
  onClick?: () => void
  htmlFor?: string
  expanded?: boolean
  children: ReactNode
}) {
  const className = cn(studyComposerIconClass, disabled && 'pointer-events-none opacity-40')
  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={className} aria-label={label} title={label}>
        {children}
      </label>
    )
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      aria-haspopup={expanded == null ? undefined : 'dialog'}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Ô gõ một hàng kiểu Messenger. Đặt con trỏ chưa đổi gì. Có chữ thì nút gửi hiện và nút chức năng thu sang trái; mũi tên mở lại. Ô cao thêm khi chữ xuống dòng. */
export function StudyMessengerComposer({
  id,
  inputRef,
  value,
  onChange,
  onSubmit,
  placeholder,
  sendLabel,
  showToolsLabel,
  emojiLabel,
  disabled,
  canSend,
  tools,
}: Props) {
  const pinnedOpen = useRef(false)
  const emojiRootRef = useRef<HTMLDivElement | null>(null)
  const [toolsOpen, setToolsOpen] = useState(true)
  const [multi, setMulti] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const typed = value.trim().length > 0
  const showSend = typed || canSend

  useEffect(() => {
    if (!typed) {
      pinnedOpen.current = false
      setToolsOpen(true)
      setEmojiOpen(false)
      return
    }
    if (!pinnedOpen.current) setToolsOpen(false)
  }, [typed])

  useLayoutEffect(() => {
    const field = inputRef.current
    if (!field) return
    if (value.length === 0) {
      field.style.height = `${LINE_PX}px`
      field.style.overflowY = 'hidden'
      setMulti(false)
      return
    }
    field.style.height = 'auto'
    const full = field.scrollHeight
    const next = Math.min(Math.max(full, LINE_PX), MAX_PX)
    field.style.height = `${next}px`
    field.style.overflowY = full > MAX_PX ? 'auto' : 'hidden'
    setMulti(full > LINE_PX + 8)
  }, [inputRef, value])

  useEffect(() => {
    if (!emojiOpen) return
    function close(event: PointerEvent) {
      if (!emojiRootRef.current?.contains(event.target as Node)) setEmojiOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [emojiOpen])

  function insertEmoji(emoji: string) {
    const field = inputRef.current
    const start = field?.selectionStart ?? value.length
    const end = field?.selectionEnd ?? value.length
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`
    onChange(next)
    const caret = start + emoji.length
    setEmojiOpen(false)
    window.requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(caret, caret)
    })
  }

  return (
    <form
      className="relative z-10 flex shrink-0 items-end gap-0.5 border-t bg-background px-1.5 py-1.5"
      data-study-composer=""
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled && canSend) onSubmit()
      }}
    >
      <div
        className={cn(
          'flex min-w-0 shrink overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out',
          toolsOpen ? 'max-w-52 translate-x-0 opacity-100' : 'pointer-events-none max-w-0 -translate-x-2 opacity-0',
        )}
        aria-hidden={!toolsOpen}
      >
        {tools}
      </div>
      <button
        type="button"
        tabIndex={toolsOpen ? -1 : 0}
        aria-hidden={toolsOpen}
        aria-expanded={toolsOpen}
        aria-label={showToolsLabel}
        title={showToolsLabel}
        className={cn(
          'flex h-10 min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-full text-[#0084FF] transition-all duration-200',
          toolsOpen ? 'w-0 opacity-0' : 'w-10 opacity-100',
        )}
        onClick={() => {
          pinnedOpen.current = true
          setToolsOpen(true)
          inputRef.current?.focus()
        }}
      >
        <ChevronRight className="h-7 w-7" strokeWidth={2.25} aria-hidden />
      </button>
      <div
        className={cn(
          'flex min-h-9 min-w-0 flex-1 bg-[#F0F2F5] dark:bg-white/10',
          multi ? 'items-end rounded-[18px]' : 'items-center rounded-full',
        )}
      >
        <textarea
          ref={inputRef}
          id={id}
          rows={1}
          value={value}
          disabled={disabled}
          enterKeyHint="send"
          placeholder={placeholder}
          className="min-h-9 min-w-0 flex-1 resize-none break-words bg-transparent px-2.5 py-2 text-[15px] leading-5 text-foreground outline-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-[#65676B] disabled:opacity-60"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (!disabled && canSend) onSubmit()
            }
          }}
        />
        <div ref={emojiRootRef} className="relative flex shrink-0 items-center pr-1">
          {emojiOpen ? (
            <div className="absolute bottom-11 right-0 z-20 grid w-[13.5rem] grid-cols-5 gap-1 rounded-2xl border bg-background p-2 shadow-lg">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-9 items-center justify-center rounded-lg text-xl hover:bg-muted"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="flex h-9 w-8 items-center justify-center rounded-full text-[#0084FF] hover:bg-black/5 disabled:opacity-40"
            aria-label={emojiLabel}
            title={emojiLabel}
            aria-expanded={emojiOpen}
            disabled={disabled}
            onClick={() => setEmojiOpen((open) => !open)}
          >
            <Smile className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </button>
          {showSend ? (
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0084FF] text-white"
              aria-label={sendLabel}
              title={sendLabel}
              disabled={disabled || !canSend}
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <span className="flex h-9 w-8 items-center justify-center text-[#0084FF]" aria-hidden>
              <ThumbsUp className="h-6 w-6" strokeWidth={1.75} />
            </span>
          )}
        </div>
      </div>
    </form>
  )
}
