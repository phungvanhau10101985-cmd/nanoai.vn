'use client'

import { useEffect } from 'react'
import { DEFAULT_WEB_LOCALE } from '@/lib/i18n/config'
import { reportCustomerErrorClient } from '@/lib/client/report-customer-error'
import { reloadOnceForStaleChunk } from '@/lib/client/recover-chunk-load'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const chunkReloading = reloadOnceForStaleChunk(error)
  useEffect(() => {
    if (chunkReloading) return
    console.error(error)
    reportCustomerErrorClient({
      source: 'boundary',
      message: error.message || 'Unhandled global error',
      detail: error.stack,
      digest: error.digest,
    })
  }, [error, chunkReloading])

  if (chunkReloading) {
    return (
      <html lang={DEFAULT_WEB_LOCALE}>
        <body />
      </html>
    )
  }

  return (
    <html lang={DEFAULT_WEB_LOCALE}>
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Đã xảy ra lỗi nghiêm trọng
          </h2>
          <p style={{ color: '#666', marginBottom: '1rem', textAlign: 'center' }}>
            {error.message || 'Vui lòng tải lại trang.'}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  )
}
