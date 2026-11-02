export type SepayIpnDisposition = 'credit' | 'ignore' | 'retry'

const HARD_FAIL_STATUSES = new Set(['failed', 'cancelled', 'canceled', 'error', 'refunded'])

/**
 * BankAPINotify của SePay thường không có `status`, chỉ có `transferType: in`.
 * Status `processing` kèm tiền vào vẫn là báo có tiền — phải cộng, không trả HTTP 200 rồi bỏ.
 * Status chưa chốt và không phải tiền vào thì trả 503 để SePay gửi lại.
 */
export function sepayIpnDisposition(input: {
  status?: string | null
  transferType?: string | null
}): SepayIpnDisposition {
  const transferType = String(input.transferType || '').trim().toLowerCase()
  const status = String(input.status || '').trim().toLowerCase()
  if (transferType === 'out') return 'ignore'
  if (status && HARD_FAIL_STATUSES.has(status)) return 'ignore'
  if (!status || status === 'success' || status === 'completed') return 'credit'
  if (transferType === 'in') return 'credit'
  return 'retry'
}
