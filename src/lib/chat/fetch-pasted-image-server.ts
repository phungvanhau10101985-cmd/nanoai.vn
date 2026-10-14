import { lookup } from 'node:dns/promises'

import {
  PASTE_IMAGE_MAX_BYTES,
  PasteImageError,
  fileNameForImage,
  isBlockedIp,
  isBlockedPasteHost,
  normalizeImageMime,
  singleHttpUrl,
} from '@/lib/chat/paste-image'

const MAX_REDIRECTS = 3

async function assertPublicHttpUrl(raw: string): Promise<URL> {
  const printed = singleHttpUrl(raw)
  if (!printed) throw new PasteImageError('blocked')
  const url = new URL(printed)
  if (isBlockedPasteHost(url.hostname)) throw new PasteImageError('blocked')
  const bare = url.hostname.replace(/^\[|\]$/g, '')
  if (bare.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(bare)) return url
  let records: Array<{ address: string }>
  try {
    records = await lookup(url.hostname, { all: true, verbatim: true })
  } catch {
    throw new PasteImageError('failed')
  }
  if (!records.length || records.some((record) => isBlockedIp(record.address))) throw new PasteImageError('blocked')
  return url
}

export async function fetchPastedImage(rawUrl: string): Promise<{ bytes: Uint8Array; mimeType: string; fileName: string }> {
  let current = await assertPublicHttpUrl(rawUrl)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: Response
    try {
      response = await fetch(current, {
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
        headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.1' },
      })
    } catch {
      throw new PasteImageError('failed')
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || hop === MAX_REDIRECTS) throw new PasteImageError('failed')
      current = await assertPublicHttpUrl(new URL(location, current).toString())
      continue
    }
    if (!response.ok) throw new PasteImageError('failed')
    const buf = new Uint8Array(await response.arrayBuffer())
    if (buf.byteLength > PASTE_IMAGE_MAX_BYTES) throw new PasteImageError('too-large')
    const mime = normalizeImageMime(response.headers.get('content-type') || '', buf)
    if (!mime) throw new PasteImageError('not-image')
    return { bytes: buf, mimeType: mime, fileName: fileNameForImage(current.toString(), mime) }
  }
  throw new PasteImageError('failed')
}
