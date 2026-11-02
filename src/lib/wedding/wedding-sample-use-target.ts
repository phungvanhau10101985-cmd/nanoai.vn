import { findWeddingSampleCard } from '@/lib/wedding/wedding-sample-cards'

export const WEDDING_PENDING_SAMPLE_KEY = 'wedding-use-sample'
const WEDDING_PENDING_ASK_KEY = 'wedding-use-sample-ask'

export type WeddingSampleUseStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Đường về trang tạo thiệp với đúng mẫu. Null khi id không phải mẫu. */
export function weddingSampleEditorPath(sampleId: string | null | undefined, cardId?: string | null): string | null {
  const sample = findWeddingSampleCard(sampleId)
  if (!sample) return null
  const params = new URLSearchParams()
  const card = cardId?.trim() || ''
  if (card) params.set('cardId', card)
  params.set('useSample', sample.id)
  return `/tao-thiep-moi-cuoi-ai?${params.toString()}`
}

/** Khách chưa đăng nhập: trang đăng nhập, rồi về đúng mẫu và bắt nhập tên để AI soạn. */
export function weddingGuestSampleLoginPath(sampleId: string | null | undefined): string | null {
  const editor = weddingSampleEditorPath(sampleId)
  if (!editor) return null
  return `/auth/login?next=${encodeURIComponent(`${editor}&askNames=1`)}`
}

/** Khách chưa đăng nhập thì vào trang đăng nhập, xong quay lại đúng mẫu. */
export function weddingSampleUseTarget(input: {
  sampleId: string
  signedIn: boolean
  cardId?: string | null
}): string | null {
  if (!input.signedIn) return weddingGuestSampleLoginPath(input.sampleId)
  return weddingSampleEditorPath(input.sampleId, input.cardId)
}

export type PendingWeddingSampleUse = { id: string; askNames: boolean }

/** Giữ id mẫu sau khi query bị gỡ, để đăng nhập xong vẫn mở đúng mẫu. */
export function readPendingWeddingSampleUse(
  search: string,
  storage?: WeddingSampleUseStorage | null,
): PendingWeddingSampleUse {
  const query = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(query)
  const fromUrl = findWeddingSampleCard(params.get('useSample'))?.id || ''
  if (fromUrl) {
    const askNames = params.get('askNames') === '1'
    storage?.setItem(WEDDING_PENDING_SAMPLE_KEY, fromUrl)
    if (askNames) storage?.setItem(WEDDING_PENDING_ASK_KEY, '1')
    else storage?.removeItem(WEDDING_PENDING_ASK_KEY)
    return { id: fromUrl, askNames }
  }
  const stored = findWeddingSampleCard(storage?.getItem(WEDDING_PENDING_SAMPLE_KEY))?.id || ''
  return { id: stored, askNames: Boolean(stored) && storage?.getItem(WEDDING_PENDING_ASK_KEY) === '1' }
}

export function clearPendingWeddingSampleUse(storage?: WeddingSampleUseStorage | null): void {
  storage?.removeItem(WEDDING_PENDING_SAMPLE_KEY)
  storage?.removeItem(WEDDING_PENDING_ASK_KEY)
}
