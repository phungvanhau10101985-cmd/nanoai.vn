/** COD đã về shop: file đối soát khớp, hoặc shop xác nhận EMS đã trả đủ sau khi lệch. */
export function isCodSettlementPaid(status: string | null | undefined): boolean {
  const key = (status || '').trim().toLowerCase()
  return key === 'matched' || key === 'confirmed_full'
}

export function isCodAmountMismatch(status: string | null | undefined): boolean {
  return (status || '').trim().toLowerCase() === 'amount_mismatch'
}

/** Xác nhận trả đủ không bị file đối soát lệch ghi đè. File khớp sau đó thì cập nhật thành matched. */
export function shouldPreserveConfirmedFull(
  existingStatus: string | null | undefined,
  nextStatus: string | null | undefined,
): boolean {
  return (existingStatus || '').trim().toLowerCase() === 'confirmed_full' && (nextStatus || '').trim().toLowerCase() !== 'matched'
}

export function vnCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
