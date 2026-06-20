import type { Json } from '@/types/database.types'
import { DEFAULT_WEB_LOCALE, type WebLocale, normalizeWebLocale } from '@/lib/i18n/config'

function localeFromMetadata(metadata: Json | null | undefined): WebLocale {
  if (metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const raw = (metadata as Record<string, unknown>).ui_locale
    if (typeof raw === 'string') {
      const n = normalizeWebLocale(raw)
      if (n) return n
    }
  }
  return DEFAULT_WEB_LOCALE
}

function previewLine(body: string, max = 220): string {
  const t = String(body || '')
    .replace(/📷/g, '')
    .replace(/📦/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function formatOfflineShopReplyEmailContent(input: {
  shopDisplayName: string
  chatUrl: string
  replyPreview: string
  metadata?: Json | null
}): { subject: string; text: string; html: string } {
  const locale = localeFromMetadata(input.metadata ?? null)
  const shop = input.shopDisplayName.trim() || (locale === 'vi' ? 'Cửa hàng' : 'Shop')
  const preview = previewLine(input.replyPreview)
  const safeShop = shop.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const safeUrl = input.chatUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const safePreview = preview.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const copy: Record<
    WebLocale,
    {
      subject: (s: string) => string
      hello: string
      body: (s: string) => string
      previewLabel: string
      cta: string
      linkHint: string
      signOff: (s: string) => string
      footer: string
    }
  > = {
    vi: {
      subject: (s) => `${s} — Có tin nhắn mới cho bạn`,
      hello: 'Xin chào,',
      body: (s) =>
        `${s} vừa trả lời tin nhắn của bạn trong cuộc trò chuyện. Bạn đang không mở chat nên chúng tôi gửi email để bạn quay lại đọc.`,
      previewLabel: 'Nội dung gần nhất:',
      cta: 'Mở cuộc trò chuyện',
      linkHint: 'Hoặc sao chép liên kết:',
      signOff: (s) => `Trân trọng,\n${s}`,
      footer: 'Tin nhắn tự động từ NanoAI',
    },
    en: {
      subject: (s) => `${s} — New message for you`,
      hello: 'Hello,',
      body: (s) =>
        `${s} replied in your chat conversation. You were not on the chat page, so we are sending this email so you can come back and read it.`,
      previewLabel: 'Latest message:',
      cta: 'Open conversation',
      linkHint: 'Or copy this link:',
      signOff: (s) => `Best regards,\n${s}`,
      footer: 'Automated message from NanoAI',
    },
    zh: {
      subject: (s) => `${s} — 您有新消息`,
      hello: '您好，',
      body: (s) => `${s} 在对话中回复了您。您当前未打开聊天页面，因此我们发送此邮件以便您返回查看。`,
      previewLabel: '最新消息：',
      cta: '打开对话',
      linkHint: '或复制链接：',
      signOff: (s) => `此致\n${s}`,
      footer: 'NanoAI 自动发送',
    },
    ja: {
      subject: (s) => `${s} — 新しいメッセージがあります`,
      hello: 'こんにちは、',
      body: (s) =>
        `${s} がチャットで返信しました。現在チャット画面を開いていないため、お戻りいただけるようこのメールをお送りしています。`,
      previewLabel: '最新のメッセージ：',
      cta: '会話を開く',
      linkHint: 'またはリンクをコピー：',
      signOff: (s) => `よろしくお願いいたします。\n${s}`,
      footer: 'NanoAI からの自動メッセージ',
    },
    ko: {
      subject: (s) => `${s} — 새 메시지가 있습니다`,
      hello: '안녕하세요,',
      body: (s) =>
        `${s} 님이 채팅에서 답장을 보냈습니다. 채팅 페이지를 열고 있지 않아 다시 확인하실 수 있도록 이메일을 보냅니다.`,
      previewLabel: '최근 메시지:',
      cta: '대화 열기',
      linkHint: '또는 링크 복사:',
      signOff: (s) => `감사합니다.\n${s}`,
      footer: 'NanoAI 자동 발송',
    },
  }

  const c = copy[locale] ?? copy[DEFAULT_WEB_LOCALE]
  const subject = c.subject(shop)
  const textParts = [c.hello, '', c.body(shop)]
  if (preview) textParts.push('', `${c.previewLabel}`, preview)
  textParts.push('', c.cta, input.chatUrl, '', c.signOff(shop), '', '—', c.footer)
  const text = textParts.join('\n')

  const previewHtml = preview
    ? `<p style="margin:16px 0 8px;font-size:14px;color:#374151;"><strong>${c.previewLabel}</strong></p>
<p style="margin:0 0 16px;padding:12px 14px;background:#f3f4f6;border-radius:8px;font-size:14px;color:#111827;">${safePreview}</p>`
    : ''

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#111827;max-width:560px;">
<p>${c.hello}</p>
<p>${c.body(safeShop)}</p>
${previewHtml}
<p style="margin:20px 0 12px;"><a href="${safeUrl}" style="display:inline-block;padding:12px 22px;background:#7c3aed;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;">${c.cta}</a></p>
<p style="font-size:12px;color:#6b7280;word-break:break-all;">${c.linkHint} <a href="${safeUrl}">${safeUrl}</a></p>
<p style="margin-top:24px;white-space:pre-line;">${c.signOff(safeShop).replace(/\n/g, '<br/>')}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
<p style="font-size:12px;color:#9ca3af;">${c.footer}</p>
</div>`

  return { subject, text, html }
}
