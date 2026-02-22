import { ImageResponse } from 'next/og'
import { SITE_NAME } from '@/lib/seo'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || SITE_NAME
  const path = searchParams.get('path') || '/'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px',
          background:
            'linear-gradient(135deg, #0f172a 0%, #1e293b 30%, #0ea5e9 100%)',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              backgroundColor: '#22d3ee',
            }}
          />
          <div style={{ fontSize: 36, fontWeight: 700 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.15, maxWidth: 1000 }}>{title}</div>
          <div style={{ fontSize: 28, opacity: 0.85 }}>{path}</div>
        </div>

        <div style={{ fontSize: 24, opacity: 0.85 }}>AI Tools for Image & Creative Workflows</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}

