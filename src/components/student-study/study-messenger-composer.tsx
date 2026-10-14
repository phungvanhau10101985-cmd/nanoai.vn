'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { ChevronRight, Loader2, Send, Smile, ThumbsUp } from 'lucide-react'
import { clipboardHasImagePayload, resolvePastedImages } from '@/lib/chat/paste-image-client'
import type { WebLocale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

const LINE_PX = 36
const MAX_PX = 168
const EMOJIS = ['😀', '😁', '😂', '🥰', '😊', '😉', '😎', '🤔', '😅', '😭', '👍', '👏', '🙏', '❤️', '🔥', '✨', '✅', '📚', '✏️', '📝']

export const studyComposerIconClass =
  'relative inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-[#0084FF] transition-colors hover:bg-black/5 active:bg-black/10 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:h-6 [&_svg]:w-6 [&_svg]:shrink-0'

export function messengerComposerLabels(locale: WebLocale): { showTools: string; emoji: string } {
  switch (locale) {
    case 'en':
      return { showTools: 'Show buttons', emoji: 'Emoji' }
    case 'zh':
      return { showTools: '显示按钮', emoji: '表情' }
    case 'ja':
      return { showTools: 'ボタンを表示', emoji: '絵文字' }
    case 'ko':
      return { showTools: '버튼 표시', emoji: '이모티콘' }
    default:
      return { showTools: 'Hiện nút', emoji: 'Biểu cảm' }
  }
}

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
  sending?: boolean
  tools: ReactNode
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  /** Ctrl+V ảnh, hoặc dán một link http(s). Link không phải ảnh được giữ lại thành chữ. */
  onPasteImages?: (files: File[]) => void | Promise<void>
  onPasteImageError?: (code: 'failed' | 'too-large' | 'blocked') => void
  onFocus?: (event: FocusEvent<HTMLTextAreaElement>) => void
  onBlur?: () => void
  /** Đánh dấu ô khách để khung chat không kéo thêm khi bàn phím mở. */
  guestComposerInput?: boolean
  formClassName?: string
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
  sending = false,
  tools,
  onPaste,
  onPasteImages,
  onPasteImageError,
  onFocus,
  onBlur,
  guestComposerInput = false,
  formClassName,
}: Props) {
  const pinnedOpen = useRef(false)
  const emojiRootRef = useRef<HTMLDivElement | null>(null)
  const pasteLock = useRef(false)
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

  function insertAtCaret(snippet: string) {
    const field = inputRef.current
    const current = field?.value ?? value
    const start = field?.selectionStart ?? current.length
    const end = field?.selectionEnd ?? current.length
    const next = `${current.slice(0, start)}${snippet}${current.slice(end)}`
    onChange(next)
    const caret = start + snippet.length
    window.requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(caret, caret)
    })
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (disabled || !onPasteImages) {
      onPaste?.(event)
      return
    }
    if (!clipboardHasImagePayload(event.clipboardData)) {
      onPaste?.(event)
      return
    }
    event.preventDefault()
    if (pasteLock.current) return
    pasteLock.current = true
    void resolvePastedImages(event.clipboardData)
      .then(async (outcome) => {
        if (outcome.action === 'files') await onPasteImages(outcome.files)
        else if (outcome.action === 'insert') insertAtCaret(outcome.text)
        else if (outcome.action === 'error') onPasteImageError?.(outcome.code)
      })
      .catch(() => onPasteImageError?.('failed'))
      .finally(() => {
        pasteLock.current = false
      })
  }

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
      className={cn(
        'relative z-10 flex shrink-0 items-end gap-0.5 border-t bg-background px-1.5 py-1.5',
        formClassName,
      )}
      data-study-composer=""
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled && !sending && canSend) onSubmit()
      }}
    >
      <div
        className={cn(
          'flex min-w-0 shrink overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out',
          toolsOpen ? 'max-w-[17rem] translate-x-0 opacity-100' : 'pointer-events-none max-w-0 -translate-x-2 opacity-0',
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
          data-guest-composer-input={guestComposerInput ? '1' : undefined}
          className="min-h-9 min-w-0 flex-1 resize-none break-words bg-transparent px-2.5 py-2 text-[15px] leading-5 text-foreground outline-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-[#65676B] disabled:opacity-60"
          onChange={(event) => onChange(event.target.value)}
          onPaste={handlePaste}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (!disabled && !sending && canSend) onSubmit()
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
              disabled={disabled || sending || !canSend}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
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
