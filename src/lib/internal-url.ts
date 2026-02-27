/**
 * URL nội bộ cho fetch server-to-server.
 * Tránh lỗi ERR_SSL_WRONG_VERSION_NUMBER khi server đứng sau proxy/nginx.
 * Dùng http://127.0.0.1 thay vì https://domain để gọi API trên chính server.
 */
export function getInternalBaseUrl(): string {
  const fromEnv = process.env.APP_INTERNAL_URL
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, '')
  const port = process.env.PORT || '3000'
  return process.env.NODE_ENV === 'production'
    ? `http://127.0.0.1:${port}`
    : `http://localhost:${port}`
}
