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

export const WEDDING_MUSIC_SEEDS: WeddingMusicLibraryItem[] = [
  {
    id: 'seed-heartwarming',
    title: 'Ấm áp',
    audioUrl: '/wedding-music/heartwarming.mp3',
    source: 'seed',
    credit: WEDDING_MUSIC_SEED_CREDIT,
  },
]

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

/** Dưới trần server action 10 MB, chừa chỗ cho phần form. */
export const WEDDING_LIBRARY_MUSIC_MAX_BYTES = 8 * 1024 * 1024

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
