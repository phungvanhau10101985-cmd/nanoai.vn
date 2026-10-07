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
  {
    id: 'seed-a-little-faith',
    title: 'Nhẹ nhàng',
    audioUrl: '/wedding-music/a-little-faith.mp3',
    source: 'seed',
    credit: WEDDING_MUSIC_SEED_CREDIT,
  },
  {
    id: 'seed-water-lily',
    title: 'Hoa nước',
    audioUrl: '/wedding-music/water-lily.mp3',
    source: 'seed',
    credit: WEDDING_MUSIC_SEED_CREDIT,
  },
  {
    id: 'seed-frost-waltz',
    title: 'Valse',
    audioUrl: '/wedding-music/frost-waltz.mp3',
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
