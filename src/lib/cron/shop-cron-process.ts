/** PM2 `nanoai-shop-cron` sets this. The Next process on :3000 must not. */
/** Production: vòng nặng chỉ trong PM2 nanoai-shop-cron. Dev local vẫn chạy trong Next. */
export function shopBackgroundRunsHere(): boolean {
  if (process.env.NANOAI_SHOP_CRON_WORKER === '1') return true
  return process.env.NODE_ENV !== 'production'
}
