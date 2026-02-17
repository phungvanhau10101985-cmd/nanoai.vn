/**
 * Chạy khi server khởi động – log chi tiết khi crash để debug.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (err) => {
      console.error('[CRASH] uncaughtException:', err?.message)
      console.error('[CRASH] stack:', err?.stack)
      console.error('[CRASH] name:', err?.name)
    })
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[CRASH] unhandledRejection:', reason)
      if (reason instanceof Error) {
        console.error('[CRASH] stack:', reason.stack)
      }
    })
  }
}
