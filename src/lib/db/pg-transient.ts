/** Lỗi pool/kết nối Postgres tạm thời — personalization fail-open, Chat mua retry. */

const TRANSIENT_MESSAGE =
  /timeout exceeded when trying to connect|Connection terminated|too many clients|remaining connection slots|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|57P01|53300|connection timed out/i

export function isPgTransientError(error: unknown): boolean {
  if (!error) return false
  if (typeof error === 'string') return TRANSIENT_MESSAGE.test(error)
  if (typeof error !== 'object') return false
  const code = 'code' in error ? String(error.code) : ''
  if (code === '53300' || code === '57P01' || code === 'ETIMEDOUT' || code === 'ECONNRESET') return true
  const message = 'message' in error ? String(error.message) : String(error)
  return TRANSIENT_MESSAGE.test(message)
}
