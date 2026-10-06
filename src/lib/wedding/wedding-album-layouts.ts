import type { WebLocale } from '@/lib/i18n/config'

export type WeddingAlbumLayoutId =
  | 'coverflow'
  | 'slide'
  | 'fade'
  | 'stack'
  | 'film'
  | 'polaroid'
  | 'book'
  | 'story'

export type WeddingAlbumLayout = {
  id: WeddingAlbumLayoutId
  label: Record<WebLocale, string>
}

export const WEDDING_ALBUM_LAYOUTS: WeddingAlbumLayout[] = [
  {
    id: 'coverflow',
    label: { vi: 'Xòe thẻ', en: 'Cover flow', zh: '扇形卡片', ja: 'カバーフロー', ko: '커버플로' },
  },
  {
    id: 'slide',
    label: { vi: 'Trượt ngang', en: 'Slide', zh: '横向滑动', ja: 'スライド', ko: '슬라이드' },
  },
  {
    id: 'fade',
    label: { vi: 'Mờ dần', en: 'Fade', zh: '淡入淡出', ja: 'フェード', ko: '페이드' },
  },
  {
    id: 'stack',
    label: { vi: 'Chồng thẻ', en: 'Card stack', zh: '叠卡', ja: 'カード重ね', ko: '카드 스택' },
  },
  {
    id: 'film',
    label: { vi: 'Dải phim', en: 'Film strip', zh: '胶片条', ja: 'フィルム', ko: '필름' },
  },
  {
    id: 'polaroid',
    label: { vi: 'Polaroid', en: 'Polaroid', zh: '拍立得', ja: 'ポラロイド', ko: '폴라로이드' },
  },
  {
    id: 'book',
    label: { vi: 'Lật sách', en: 'Page turn', zh: '翻页', ja: 'ページめくり', ko: '책장 넘기기' },
  },
  {
    id: 'story',
    label: { vi: 'Story dọc', en: 'Vertical story', zh: '竖向故事', ja: '縦ストーリー', ko: '세로 스토리' },
  },
]

export const DEFAULT_WEDDING_ALBUM_LAYOUT_ID: WeddingAlbumLayoutId = 'coverflow'

export function resolveWeddingAlbumLayoutId(raw: string | null | undefined): WeddingAlbumLayoutId {
  const id = raw?.trim()
  return WEDDING_ALBUM_LAYOUTS.some((layout) => layout.id === id) ? (id as WeddingAlbumLayoutId) : DEFAULT_WEDDING_ALBUM_LAYOUT_ID
}
