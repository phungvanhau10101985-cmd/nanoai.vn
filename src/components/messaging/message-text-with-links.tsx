'use client'

import type { ReactNode } from 'react'

/** Bắt URL trong tin nhắn (không dùng markdown). */
const URL_CHUNK = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

function hrefFromRaw(raw: string): string | null {
  let s = raw
  while (s.length > 0) {
    try {
      const u = new URL(s)
      if (u.protocol === 'http:' || u.protocol === 'https:') return s
    } catch {
      /* thử bỏ ký tự gắn cuối câu */
    }
    s = s.slice(0, -1)
  }
  return null
}

export type MessageTextWithLinksProps = {
  text: string
  className?: string
  linkClassName?: string
}

/**
 * Giữ nguyên xuống dòng; các đoạn `https://...` thành thẻ `<a>` (tab mới).
 */
export function MessageTextWithLinks({ text, className, linkClassName }: MessageTextWithLinksProps): ReactNode {
  const nodes: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of text.matchAll(URL_CHUNK)) {
    const full = m[0]
    const start = m.index ?? 0
    if (start > last) {
      nodes.push(<span key={`t-${k++}`}>{text.slice(last, start)}</span>)
    }
    const href = hrefFromRaw(full)
    if (href) {
      const tail = full.slice(href.length)
      nodes.push(
        <a
          key={`a-${k++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName ?? 'break-all underline underline-offset-2'}
        >
          {href}
        </a>
      )
      if (tail) {
        nodes.push(<span key={`t-${k++}`}>{tail}</span>)
      }
      last = start + full.length
    } else {
      nodes.push(<span key={`t-${k++}`}>{full}</span>)
      last = start + full.length
    }
  }
  if (last < text.length) {
    nodes.push(<span key={`t-${k++}`}>{text.slice(last)}</span>)
  }
  return <div className={className}>{nodes}</div>
}
