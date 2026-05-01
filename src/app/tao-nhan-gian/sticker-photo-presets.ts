import type { StickerPhotoExpressionId } from './actions'

/** Nhãn UI + chữ mẫu sticker (đa ngôn ngữ khớp locale trang web). */
export type StickerLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

export const PHOTO_EXPRESSION_OPTIONS: readonly {
  id: StickerPhotoExpressionId
  emoji: string
}[] = [
  { id: 'happy', emoji: '😊' },
  { id: 'love', emoji: '😍' },
  { id: 'cool', emoji: '😎' },
  { id: 'lol', emoji: '😂' },
  { id: 'sad', emoji: '😢' },
  { id: 'angry', emoji: '😤' },
  { id: 'surprised', emoji: '😮' },
  { id: 'sleepy', emoji: '😴' },
  { id: 'wink', emoji: '😉' },
  { id: 'thumbs', emoji: '👍' },
  { id: 'custom', emoji: '✏️' },
] as const

function trL<T extends Record<StickerLocale, string>>(locale: StickerLocale, row: T): string {
  return row[locale] ?? row.vi
}

/** Nút chọn biểu cảm (hiển thị ngắn). */
export function labelForExpression(locale: StickerLocale, id: StickerPhotoExpressionId): string {
  const rows: Record<StickerPhotoExpressionId, Record<StickerLocale, string>> = {
    happy: { vi: 'Vui', en: 'Happy', zh: '开心', ja: 'にっこり', ko: '행복' },
    love: { vi: 'Yêu', en: 'Love', zh: '爱慕', ja: 'ラブ', ko: '사랑' },
    cool: { vi: 'Chất', en: 'Cool', zh: '酷', ja: 'クール', ko: '멋짐' },
    lol: { vi: 'Cười xỉu', en: 'LOL', zh: '笑爆', ja: '爆笑', ko: '빵터짐' },
    sad: { vi: 'Buồn', en: 'Sad', zh: '难过', ja: '悲しい', ko: '슬픔' },
    angry: { vi: 'Cáu', en: 'Angry', zh: '生气', ja: '怒り', ko: '화남' },
    surprised: { vi: 'Bất ngờ', en: 'Surprised', zh: '吃惊', ja: 'びっくり', ko: '놀람' },
    sleepy: { vi: 'Buồn ngủ', en: 'Sleepy', zh: '困', ja: '眠い', ko: '졸림' },
    wink: { vi: 'Nháy mắt', en: 'Wink', zh: '眨眼', ja: 'ウインク', ko: '윙크' },
    thumbs: { vi: 'Đồng ý', en: 'Thumbs-up', zh: '赞', ja: 'いいね', ko: '좋아요' },
    custom: { vi: 'Tuỳ chỉnh', en: 'Custom', zh: '自定义', ja: 'カスタム', ko: '사용자' },
  }
  return trL(locale, rows[id])
}

/** Chữ mẫu hiển thị trong bong bóng sticker (preset). `custom`: chuỗi rỗng — khách nhập tay. */
export function defaultCaptionForExpression(locale: StickerLocale, id: StickerPhotoExpressionId): string {
  const rows: Record<StickerPhotoExpressionId, Record<StickerLocale, string>> = {
    happy: {
      vi: 'Tuyệt vời!',
      en: 'Awesome!',
      zh: '太棒了！',
      ja: '最高！',
      ko: '최고!',
    },
    love: {
      vi: 'Yêu ghê ❤️',
      en: 'Love it!',
      zh: '好喜欢！',
      ja: '大好き！',
      ko: '완전 좋아요!',
    },
    cool: {
      vi: 'Chất!',
      en: 'So cool!',
      zh: '很酷！',
      ja: 'かっこいい！',
      ko: '멋져!',
    },
    lol: {
      vi: 'Cười xỉu 🤣',
      en: 'LOL!',
      zh: '笑死我了！',
      ja: '爆笑！',
      ko: '빵 터짐 ㅋㅋ',
    },
    sad: {
      vi: 'Buồn quá 😢',
      en: 'So sad…',
      zh: '好难过…',
      ja: 'つらい…',
      ko: '슬퍼…',
    },
    angry: {
      vi: 'Cáu rồi!',
      en: 'Ugh!',
      zh: '气死了！',
      ja: 'ムカつく！',
      ko: '짜증!',
    },
    surprised: {
      vi: 'Hả?!',
      en: 'What?!',
      zh: '什么?!',
      ja: 'えっ?!',
      ko: '뭐야?!',
    },
    sleepy: {
      vi: 'Buồn ngủ…',
      en: 'So sleepy…',
      zh: '好困…',
      ja: '眠い…',
      ko: '졸려…',
    },
    wink: {
      vi: 'Nhớ nhé 😉',
      en: 'Miss you 😉',
      zh: '想你 😉',
      ja: 'ちゃんとね 😉',
      ko: '보고 싶어 😉',
    },
    thumbs: {
      vi: 'Đồng ý 👍',
      en: 'Yes! 👍',
      zh: '同意 👍',
      ja: 'OK 👍',
      ko: '좋아요 👍',
    },
    custom: { vi: '', en: '', zh: '', ja: '', ko: '' },
  }
  return trL(locale, rows[id])
}
