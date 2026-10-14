import {
  PASTE_IMAGE_MAX_BYTES,
  PasteImageError,
  clipboardImageFiles,
  clipboardPlainText,
  fileNameForImage,
  mightBeRemoteImage,
  normalizeImageMime,
  singleHttpUrl,
  singleImageDataUrl,
  type ClipboardLike,
} from '@/lib/chat/paste-image'

export type PasteOutcome =
  | { action: 'files'; files: File[] }
  | { action: 'insert'; text: string }
  | { action: 'ignore' }
  | { action: 'error'; code: 'failed' | 'too-large' | 'blocked' }

function fileFromBlob(source: string, blob: Blob, mime: string): File {
  if (blob.size > PASTE_IMAGE_MAX_BYTES) throw new PasteImageError('too-large')
  return new File([blob], fileNameForImage(source, mime), { type: mime, lastModified: Date.now() })
}

async function fileFromDirectResponse(source: string, response: Response): Promise<File> {
  if (!response.ok) throw new PasteImageError('failed')
  const declared = response.headers.get('content-type') || blobTypeFallback(response)
  const blob = await response.blob()
  const mime = normalizeImageMime(declared || blob.type, new Uint8Array(await blob.arrayBuffer()))
  if (!mime) throw new PasteImageError('not-image')
  return fileFromBlob(source, blob, mime)
}

function blobTypeFallback(response: Response): string {
  return response.headers.get('content-type') || ''
}

async function fileFromPasteApi(url: string): Promise<File> {
  let response: Response
  try {
    response = await fetch('/api/chat/paste-image', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    throw new PasteImageError('failed')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    const code = body?.error
    if (code === 'not-image' || code === 'too-large' || code === 'blocked' || code === 'failed') {
      throw new PasteImageError(code)
    }
    throw new PasteImageError('failed')
  }
  const blob = await response.blob()
  const mime = normalizeImageMime(blob.type || response.headers.get('content-type') || '', new Uint8Array(await blob.arrayBuffer()))
  if (!mime) throw new PasteImageError('not-image')
  return fileFromBlob(url, blob, mime)
}

export async function fileFromImageUrl(url: string): Promise<File> {
  const dataUrl = singleImageDataUrl(url)
  if (dataUrl) {
    try {
      const response = await fetch(dataUrl)
      return await fileFromDirectResponse(dataUrl, response)
    } catch (error) {
      if (error instanceof PasteImageError) throw error
      throw new PasteImageError('failed')
    }
  }
  const httpUrl = singleHttpUrl(url)
  if (!httpUrl) throw new PasteImageError('failed')
  try {
    const direct = await fetch(httpUrl, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
    if (direct.ok) {
      const blob = await direct.blob()
      const header = direct.headers.get('content-type') || blob.type
      const mime = normalizeImageMime(header, new Uint8Array(await blob.slice(0, 16).arrayBuffer()))
      if (mime) return fileFromBlob(httpUrl, blob, mime)
      if (header && !header.toLowerCase().startsWith('image/') && header !== 'application/octet-stream') {
        throw new PasteImageError('not-image')
      }
    }
  } catch (error) {
    if (error instanceof PasteImageError && error.code === 'not-image') throw error
    if (error instanceof PasteImageError && error.code === 'too-large') throw error
  }
  return fileFromPasteApi(httpUrl)
}

/** File ảnh trên clipboard, hoặc một link — link không phải ảnh thì trả lại chữ để dán như thường. */
export async function resolvePastedImages(data: ClipboardLike | null): Promise<PasteOutcome> {
  const files = clipboardImageFiles(data)
  if (files.length) return { action: 'files', files }
  const text = clipboardPlainText(data).trim()
  if (!mightBeRemoteImage(text)) return { action: 'ignore' }
  const source = singleImageDataUrl(text) || singleHttpUrl(text)
  if (!source) return { action: 'ignore' }
  try {
    return { action: 'files', files: [await fileFromImageUrl(source)] }
  } catch (error) {
    if (error instanceof PasteImageError && error.code === 'not-image') {
      if (source.startsWith('data:')) return { action: 'error', code: 'failed' }
      return { action: 'insert', text: source }
    }
    if (error instanceof PasteImageError && (error.code === 'too-large' || error.code === 'blocked' || error.code === 'failed')) {
      return { action: 'error', code: error.code }
    }
    return { action: 'error', code: 'failed' }
  }
}

export function clipboardHasImagePayload(data: ClipboardLike | null): boolean {
  if (clipboardImageFiles(data).length) return true
  return mightBeRemoteImage(clipboardPlainText(data))
}
