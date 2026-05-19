import { sendSmtpMail } from '@/lib/email/smtp'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function emailCustomerBirthdayPromo(input: {
  toEmail: string
  shopDisplayName: string
  chatUrl: string
  discountPercent: number
  /** Ngày sinh nhật sắp tới (YYYY-MM-DD) — hiển thị lịch. */
  nextBirthdayLabel: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const pct = Math.max(0, Math.min(100, Math.floor(Number(input.discountPercent) || 0)))
  const origin = getPublicAppUrlForServer().replace(/\/$/, '')
  const title = `${input.shopDisplayName} — Ưu đãi sinh nhật ${pct}%`
  const text = [
    `Xin chào,`,
    ``,
    `${input.shopDisplayName} gửi lời chúc mừng sinh nhật — trong khung ưu đãi (thường là tuần trước sinh nhật, theo cài đặt shop), giá các sản phẩm trong kho trên chat được giảm ${pct}% tự động (không cần mã).`,
    `Sinh nhật sắp tới (tham khảo): ${input.nextBirthdayLabel}.`,
    ``,
    `Mở chat để xem các sản phẩm bạn đã quan tâm / đặt qua tin nhắn:`,
    input.chatUrl,
    ``,
    `Trân trọng,`,
    input.shopDisplayName,
    ``,
    `—`,
    `Tin nhắn tự động từ NanoAI · ${origin}`,
  ].join('\n')

  const safeShop = escapeHtml(input.shopDisplayName)
  const safeUrl = escapeHtml(input.chatUrl)
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#111827;max-width:560px;">
<p>Xin chào,</p>
<p><strong>${safeShop}</strong> gửi lời chúc mừng sinh nhật — trong khung ưu đãi (thường là tuần trước sinh nhật, theo cài đặt shop), giá sản phẩm trong kho trên chat giảm <strong>${pct}%</strong> tự động, không cần mã giảm giá.</p>
<p style="color:#4b5563;font-size:14px;">Sinh nhật sắp tới (tham khảo): ${escapeHtml(input.nextBirthdayLabel)}.</p>
<p style="margin:20px 0 12px;"><a href="${safeUrl}" style="display:inline-block;padding:12px 22px;background:#7c3aed;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;">Mở chat &amp; xem sản phẩm</a></p>
<p style="font-size:12px;color:#6b7280;word-break:break-all;">Hoặc sao chép liên kết: <a href="${safeUrl}">${safeUrl}</a></p>
<p style="margin-top:24px;">Trân trọng,<br/>${safeShop}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
<p style="font-size:12px;color:#9ca3af;">Tin nhắn tự động từ NanoAI</p>
</div>`

  return sendSmtpMail({
    to: input.toEmail,
    subject: title,
    text,
    html,
  })
}
