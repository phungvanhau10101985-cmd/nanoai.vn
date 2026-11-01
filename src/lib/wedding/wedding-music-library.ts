/** Nhạc nền thiệp có sẵn. Kevin MacLeod, CC BY 4.0 — phải ghi công khi phát. */
export const WEDDING_MUSIC_SEED_CREDIT =
  'Kevin MacLeod (incompetech.com) — CC BY 4.0'

export type WeddingMusicLibraryItem = {
  id: string
  title: string
  audioUrl: string
  source: 'seed' | 'upload'
  credit: string
}

export const WEDDING_MUSIC_SEEDS: WeddingMusicLibraryItem[] = []

const SEED_URLS = new Set(WEDDING_MUSIC_SEEDS.map((item) => item.audioUrl))

export function isWeddingMusicSeedUrl(url: string) {
  return SEED_URLS.has(url.trim())
}

export function weddingMusicTitleFromFileName(name: string) {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (base || 'Nhạc thiệp').slice(0, 80)
}

/** Mỗi bài tối đa 20 MB. Form server action để 24 MB cho phần bọc ngoài file. */
export const WEDDING_LIBRARY_MUSIC_MAX_BYTES = 20 * 1024 * 1024

const LIBRARY_AUDIO_EXT = /\.(mp3|mpeg|m4a|wav|aac|ogg)$/i

export type WeddingLibraryMusicFileError = 'too_large' | 'invalid_type'

export function weddingLibraryMusicFileError(file: {
  name: string
  type: string
  size: number
}): WeddingLibraryMusicFileError | null {
  const typeOk = file.type.startsWith('audio/') || LIBRARY_AUDIO_EXT.test(file.name)
  if (!typeOk || file.size <= 0) return 'invalid_type'
  if (file.size > WEDDING_LIBRARY_MUSIC_MAX_BYTES) return 'too_large'
  return null
}

/** Khóa so trùng tên bài: bỏ đuôi file, gạch, hoa thường. */
export function weddingMusicLibraryMatchKey(titleOrFileName: string) {
  return weddingMusicTitleFromFileName(titleOrFileName).toLocaleLowerCase('vi-VN')
}

export function findWeddingMusicInLibrary<T extends { title: string; audioUrl: string }>(
  items: T[],
  titleOrFileName: string,
): T | null {
  const key = weddingMusicLibraryMatchKey(titleOrFileName)
  if (!key) return null
  return items.find((item) => weddingMusicLibraryMatchKey(item.title) === key) ?? null
}

/** Bỏ URL trống và trùng. Giữ thứ tự kho. */
export function weddingMusicQueue(urls: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls ?? []) {
    const url = raw.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

/** Xáo thứ tự phát. `random` trả về [0, 1). */
export function shuffleWeddingMusicUrls(urls: readonly string[], random: () => number = Math.random): string[] {
  const next = weddingMusicQueue(urls)
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)))
    const swap = next[i]
    next[i] = next[j]
    next[j] = swap
  }
  return next
}

/** Bài kế trong bản ghép. Hết vòng thì xáo lại, không mở đầu bằng bài vừa phát. */
export function nextWeddingMusicMix(
  order: readonly string[],
  index: number,
  random: () => number = Math.random,
): { order: string[]; index: number } {
  const queue = weddingMusicQueue(order)
  if (queue.length === 0) return { order: [], index: 0 }
  const at = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0
  if (at + 1 < queue.length) return { order: queue, index: at + 1 }
  const next = shuffleWeddingMusicUrls(queue, random)
  const last = queue[Math.min(at, queue.length - 1)]
  if (next.length > 1 && next[0] === last) {
    const swap = next[0]
    next[0] = next[1]
    next[1] = swap
  }
  return { order: next, index: 0 }
}
