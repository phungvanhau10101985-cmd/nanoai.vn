/** Một lần cải thiện dress code hoặc lời cảm ơn. 1 credit = 6.000₫; chi phí model chữ rất nhỏ. */
export const WEDDING_TEXT_POLISH_CREDIT = 0.1

export function weddingPolishFieldCostsCredit(field: string): boolean {
  return field === 'dressCode' || field === 'thankYouText'
}
