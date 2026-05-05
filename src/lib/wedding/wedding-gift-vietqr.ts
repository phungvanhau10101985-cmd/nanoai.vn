import type { WeddingCard } from '@/lib/db/wedding-cards-pg'

/** URL ảnh QR VietQR (compact2), tương thích app tạo mã vạch. */
export function buildVietQrCompactImageUrl(
  bankCode: string,
  accountNo: string,
  options?: { accountName?: string },
): string | null {
  const bank = bankCode.trim()
  const acc = accountNo.trim()
  if (!bank || !acc) return null
  const base = `https://img.vietqr.io/image/${bank}-${acc}-compact2.png`
  const name = options?.accountName?.trim()
  if (!name) return base
  return `${base}?${new URLSearchParams({ accountName: name }).toString()}`
}

export function isVietGiftSideComplete(bankId: string, accountNo: string, accountName: string): boolean {
  return Boolean(bankId.trim() && accountNo.trim() && accountName.trim())
}

export function isTwinVietGiftReady(card: WeddingCard): boolean {
  return (
    isVietGiftSideComplete(card.groomGiftBankId, card.groomGiftAccountNo, card.groomGiftAccountName) &&
    isVietGiftSideComplete(card.brideGiftBankId, card.brideGiftAccountNo, card.brideGiftAccountName)
  )
}

export function isLegacySingleGiftImage(card: WeddingCard): boolean {
  return Boolean(card.giftQrImageUrl?.trim())
}

/** Hiển thị hộp mừng cưới khi bật và đã cấu hình VietQR đôi hoặc ảnh QR cũ. */
export function shouldShowPublicGiftBox(card: WeddingCard): boolean {
  return card.giftQrEnabled && (isTwinVietGiftReady(card) || isLegacySingleGiftImage(card))
}
