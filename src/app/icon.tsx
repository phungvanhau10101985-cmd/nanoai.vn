import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const contentType = 'image/png'
export const size = { width: 512, height: 512 }

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1d4ed8 0%, #0f172a 100%)',
          borderRadius: 96,
          color: '#fff',
          fontSize: 220,
          fontWeight: 800,
          fontFamily: 'sans-serif',
        }}
      >
        N
      </div>
    ),
    size
  )
}
