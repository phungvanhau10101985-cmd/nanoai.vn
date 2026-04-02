import type { Json } from '@/types/database.types'

type Row = { body: string; raw_payload: Json | null }

function imageUrlFromPayload(raw: Json | null): string | null {
  if (!raw || typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const gm = o.guest_media ?? o.partner_media
  if (!gm || typeof gm !== 'object' || gm === null) return null
  const m = gm as Record<string, unknown>
  if (m.kind !== 'image' || typeof m.url !== 'string') return null
  return m.url
}

export type CustomerCareMessageBodyTone = 'default' | 'onViolet'

/** Hiển thị nội dung tin (chữ + ảnh khách/shop widget nếu có). */
export function CustomerCareMessageBody({
  row,
  tone = 'default',
}: {
  row: Row
  tone?: CustomerCareMessageBodyTone
}) {
  const url = imageUrlFromPayload(row.raw_payload)
  const caption = row.body.replace(/^📷\s*/u, '').trim()
  const onViolet = tone === 'onViolet'

  return (
    <div className={`space-y-2 ${onViolet ? '[&_a]:text-white/90 [&_img]:border-white/25' : ''}`}>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block max-w-sm">
          <img
            src={url}
            alt=""
            className={`max-h-52 w-full rounded-lg border object-contain ${onViolet ? 'border-white/25 bg-white/10' : 'border-border/60 bg-muted/30'}`}
            loading="lazy"
          />
        </a>
      ) : null}
      {caption ? (
        <div className={`whitespace-pre-wrap break-words ${onViolet ? 'text-white' : ''}`}>{caption}</div>
      ) : null}
      {!url && !caption && row.body ? (
        <div className={`whitespace-pre-wrap break-words ${onViolet ? 'text-white' : ''}`}>{row.body}</div>
      ) : null}
    </div>
  )
}
