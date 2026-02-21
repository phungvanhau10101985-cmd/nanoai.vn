import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'NanoAI - Công cụ AI tạo và chỉnh sửa ảnh'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '64px',
          background:
            'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #2563eb 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 800, marginBottom: 20 }}>
          NanoAI
        </div>
        <div style={{ fontSize: 40, lineHeight: 1.25, maxWidth: 980 }}>
          Sáng tạo ảnh bằng AI: thử đồ ảo, phục dựng ảnh, làm nét và ghép ảnh
        </div>
        <div style={{ marginTop: 28, fontSize: 28, opacity: 0.9 }}>
          nanoai.vn
        </div>
      </div>
    ),
    { ...size }
  )
}
