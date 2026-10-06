import type { ReactNode } from 'react'
import './wedding-guest-name.css'

const HREF = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap'

export const WEDDING_GUEST_NAME_CLASS = 'wedding-guest-name'

/** Font thư pháp có dấu tiếng Việt. Link trong body vẫn tải được, không đi qua next/font. */
export function WeddingGuestNameFontLink() {
  return <link rel="stylesheet" href={HREF} />
}

/** Bọc đúng cụm tên khách trong một đoạn, không đổi phần chữ còn lại. */
export function renderWeddingGuestName(text: string, guestName: string, className: string): ReactNode {
  const needle = guestName.trim()
  if (!needle || !text.includes(needle) && !text.toLocaleLowerCase('vi').includes(needle.toLocaleLowerCase('vi'))) {
    return text
  }
  const lowerText = text.toLocaleLowerCase('vi')
  const lowerNeedle = needle.toLocaleLowerCase('vi')
  const nodes: ReactNode[] = []
  let cursor = 0
  let found = lowerText.indexOf(lowerNeedle, cursor)
  let key = 0
  while (found >= 0) {
    if (found > cursor) nodes.push(text.slice(cursor, found))
    const end = found + needle.length
    nodes.push(
      <span key={`guest-name-${key}`} className={className}>
        {text.slice(found, end)}
      </span>,
    )
    key += 1
    cursor = end
    found = lowerText.indexOf(lowerNeedle, cursor)
  }
  if (nodes.length === 0) return text
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}
