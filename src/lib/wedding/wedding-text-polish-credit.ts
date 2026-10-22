/** Một lần Tối ưu AI trên thiệp cưới. 1 credit = 6.000₫; chi phí model chữ rất nhỏ. */
export const WEDDING_TEXT_POLISH_CREDIT = 0.1

/** Nhãn giá hiện trên nút và hộp Credit. */
export const WEDDING_TEXT_POLISH_CREDIT_LABEL = '0,1 credit'

/** Khớp `WEDDING_POLISH_FIELDS`. Không import file DeepSeek — component nút chạy trên trình duyệt. */
const PAID_POLISH_FIELDS = [
  'coupleIntro',
  'loveQuote',
  'eventTimeline',
  'dressCode',
  'storyText',
  'thankYouText',
] as const

export function weddingPolishFieldCostsCredit(field: string): boolean {
  return (PAID_POLISH_FIELDS as readonly string[]).includes(field)
}
