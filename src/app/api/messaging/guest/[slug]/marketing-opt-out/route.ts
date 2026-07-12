import { NextRequest, NextResponse } from 'next/server'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { insertMarketingOptOutFromPg } from '@/lib/db/messaging-partner-marketing-campaigns-pg'
import { verifyMarketingOptOutToken } from '@/lib/messaging/marketing-opt-out-token'
import { isPgConfigured } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function htmlPage(title: string, message: string, ok: boolean): string {
  const color = ok ? '#059669' : '#b91c1c'
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title}</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f9fafb;">
<div style="max-width:480px;margin:64px auto;padding:28px 24px;background:#fff;border-radius:16px;border:1px solid #e5e7eb;">
<h1 style="font-size:18px;color:${color};margin:0 0 12px;">${title}</h1>
<p style="font-size:15px;color:#374151;line-height:1.6;margin:0;">${message}</p>
</div></body></html>`
}

async function handleOptOut(slug: string, token: string): Promise<{ ok: boolean; title: string; message: string }> {
  const payload = verifyMarketingOptOutToken(token)
  if (!payload) {
    return {
      ok: false,
      title: 'Liên kết không hợp lệ / Invalid link',
      message: 'Liên kết hủy nhận đã hết hạn hoặc không hợp lệ. The unsubscribe link is invalid or expired.',
    }
  }

  const partner = await resolveFashionMessagingPartnerBySlug(slug)
  if (!partner || partner.id !== payload.partnerId || !isPgConfigured()) {
    return {
      ok: false,
      title: 'Không thực hiện được / Failed',
      message: 'Không xác định được cửa hàng. Could not resolve the shop.',
    }
  }

  const done = await insertMarketingOptOutFromPg({
    partnerId: payload.partnerId,
    recipientKey: payload.recipientKey,
    emailNormalized: payload.email || null,
  })
  if (!done) {
    return {
      ok: false,
      title: 'Không thực hiện được / Failed',
      message: 'Vui lòng thử lại sau. Please try again later.',
    }
  }

  return {
    ok: true,
    title: 'Đã hủy nhận email / Unsubscribed',
    message:
      'Bạn sẽ không nhận email gợi ý sản phẩm từ cửa hàng này nữa. Email đơn hàng và tin nhắn vẫn hoạt động bình thường. You will no longer receive marketing emails from this shop.',
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const token = request.nextUrl.searchParams.get('token')?.trim() || ''
  const res = await handleOptOut(slug, token)
  return new NextResponse(htmlPage(res.title, res.message, res.ok), {
    status: res.ok ? 200 : 400,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

// One-Click unsubscribe (RFC 8058): mail clients POST here directly.
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const token =
    request.nextUrl.searchParams.get('token')?.trim() ||
    (await request
      .formData()
      .then((f) => String(f.get('token') ?? '').trim())
      .catch(() => '')) ||
    ''
  const res = await handleOptOut(slug, token)
  return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 400 })
}
