'use client'

import Link from 'next/link'
import { AlertCircle, Check, Copy } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PartnerDevIntegrationStrings } from '@/lib/integration/partner-dev-integration-copy'

/** Giới hạn tối đa «Cách đáy» (px) trong form — script vẫn clamp cùng giá trị. */
const EMBED_BOTTOM_OFFSET_MAX_PX = 800

function parsePxInput(raw: string, fallback: number, min: number, max: number): number {
  const text = String(raw ?? '').trim()
  const parsed = Number.parseInt(text, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

type Props = {
  baseUrl: string
  t: PartnerDevIntegrationStrings
  partners: Array<{ id: string; display_name: string | null; slug: string; logo_url: string | null }>
  /** Đồng bộ với ô chọn shop ở mục khóa API phía trên */
  selectedPartnerId?: string
}

function CodeBlock({
  children,
  title,
  copyButtonLabel,
  copySuccessMessage,
  copyErrorMessage,
}: {
  children: string
  title?: string
  copyButtonLabel?: string
  copySuccessMessage?: string
  copyErrorMessage?: string
}) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const showToolbar = Boolean(title || copyButtonLabel)

  useEffect(() => {
    if (copyStatus === 'idle') return
    const ms = copyStatus === 'ok' ? 2200 : 3200
    const id = window.setTimeout(() => setCopyStatus('idle'), ms)
    return () => window.clearTimeout(id)
  }, [copyStatus])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      if (copySuccessMessage) setCopyStatus('ok')
    } catch {
      if (copyErrorMessage) setCopyStatus('err')
    }
  }

  return (
    <div className="space-y-1">
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          {copyButtonLabel ? (
            <Button
              type="button"
              variant={copyStatus === 'ok' ? 'default' : 'outline'}
              size="sm"
              className={`h-auto min-h-8 max-w-[min(100%,20rem)] shrink-0 gap-1.5 whitespace-normal px-2 py-1.5 text-left text-[11px] leading-snug sm:max-w-xs sm:text-right ${
                copyStatus === 'ok'
                  ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600/90 dark:border-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-700/90'
                  : copyStatus === 'err'
                    ? 'border-destructive/70 bg-destructive/10 text-destructive hover:bg-destructive/15 dark:hover:bg-destructive/20'
                    : ''
              }`}
              onClick={() => void handleCopy()}
              aria-live="polite"
            >
              {copyStatus === 'ok' ? (
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : copyStatus === 'err' ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span className="min-w-0">
                {copyStatus === 'ok' && copySuccessMessage
                  ? copySuccessMessage
                  : copyStatus === 'err' && copyErrorMessage
                    ? copyErrorMessage
                    : copyButtonLabel}
              </span>
            </Button>
          ) : null}
        </div>
      ) : null}
      <pre className="overflow-x-auto rounded-md border bg-muted/60 p-3 text-[10px] leading-relaxed whitespace-pre-wrap break-all sm:text-[11px] sm:whitespace-pre">
        {children}
      </pre>
    </div>
  )
}

export function PartnerDevIntegrationGuide({ baseUrl, t, partners, selectedPartnerId }: Props) {
  const effectivePid = useMemo(() => {
    if (!partners.length) return ''
    if (selectedPartnerId && partners.some((p) => p.id === selectedPartnerId)) return selectedPartnerId
    return partners[0]?.id ?? ''
  }, [partners, selectedPartnerId])

  const [embedSide, setEmbedSide] = useState<'left' | 'right'>('right')
  const [embedBottomPxInput, setEmbedBottomPxInput] = useState('24')
  const [embedHorizontalPxInput, setEmbedHorizontalPxInput] = useState('16')
  const [embedDesktopWidthPxInput, setEmbedDesktopWidthPxInput] = useState('340')
  const [embedDesktopHeightPxInput, setEmbedDesktopHeightPxInput] = useState('560')
  const [embedRadiusPxInput, setEmbedRadiusPxInput] = useState('12')
  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === effectivePid) ?? partners[0] ?? null,
    [partners, effectivePid]
  )

  const slug = selectedPartner?.slug ?? ''
  const logoUrl = selectedPartner?.logo_url?.trim() || `${baseUrl}/icons/icon-192x192.png`
  const partnerId = selectedPartner?.id ?? ''
  const guestBase = `${baseUrl}/api/messaging/guest/${slug}`
  const safeBottomPx = parsePxInput(embedBottomPxInput, 24, 0, EMBED_BOTTOM_OFFSET_MAX_PX)
  const safeHorizontalPx = parsePxInput(embedHorizontalPxInput, 16, 0, 300)
  const safeDesktopWidthPx = parsePxInput(embedDesktopWidthPxInput, 340, 280, 1200)
  const safeDesktopHeightPx = parsePxInput(embedDesktopHeightPxInput, 560, 320, 1200)
  const safeRadiusPx = parsePxInput(embedRadiusPxInput, 12, 0, 60)

  const hostedUrl = `${baseUrl}/messaging/p/${slug}?embed=1`
  const hostedPageUrl = `${baseUrl}/messaging/p/${slug}`
  const shopNameForEmbed = (selectedPartner?.display_name ?? '').trim() || 'Chat'
  const shopNameAttr = shopNameForEmbed.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const hostedScript = `<script
  src="${baseUrl}/embed/nanoai-chat-widget.js"
  data-chat-url="${hostedUrl}"
  data-shop-name="${shopNameAttr}"
  data-orders-label="Đơn hàng của tôi"
  data-cart-label="Giỏ hàng"
  data-logo-url="${logoUrl}"
  data-side="${embedSide}"
  data-bottom="${safeBottomPx}"
  data-offset-x="${safeHorizontalPx}"
  data-width="${safeDesktopWidthPx}"
  data-height="${safeDesktopHeightPx}"
  data-radius="${safeRadiusPx}"
  data-mobile-breakpoint="768"
  data-bubble-size="56"
  data-mobile-bubble-size="52"
  data-widget-id="nanoai-chat-widget-v1"
  defer
></script>`
  const fashionProductPageButtons = `<!-- Trang chi tiết SP — shop thời trang / mua sắm (cùng widget script phía trên) -->
<button type="button" data-nanoai-consult>Tư vấn nhắn tin</button>
<button type="button" data-nanoai-try-on>Thử đồ</button>`
  const hostedIframe = `<iframe
  src="${hostedUrl}"
  title="${shopNameAttr} — Chat"
  width="100%"
  height="${safeDesktopHeightPx}"
  style="border:0;border-radius:${safeRadiusPx}px;max-width:100%;"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>`
  const hostedLinkButton = `<a
  href="${hostedPageUrl}"
  target="_blank"
  rel="noopener noreferrer"
  style="display:inline-block;padding:10px 16px;border-radius:9999px;background:#7c3aed;color:#fff;text-decoration:none;font:600 14px/1 Arial,sans-serif;"
>Mở chat NanoAI</a>`
  const hostedCompatNote =
    'Nếu web/CMS chặn <script> (hoặc chỉ cho dán URL/iframe), dùng mã iframe hoặc nút link bên dưới.'

  const guestGet = `GET ${guestBase}
Cookie: <auth_session_cookie>`

  const guestPost = `POST ${guestBase}
Content-Type: application/json
Cookie: <auth_session_cookie>

{ "text": "…", "imageStoragePath": "…" }`

  const guestImage = `POST ${guestBase}/image
Content-Type: multipart/form-data
Cookie: <auth_session_cookie>

file = (image binary)`

  const guestVisionPick = `POST ${guestBase}/vision-pick
Content-Type: application/json
Cookie: <auth_session_cookie>

{
  "messageId": "<id_from_conversation>",
  "inventoryId": "<inventory_uuid>"
}`

  const imageSearchCurl = `curl -sS -X POST \\
  "${baseUrl}/api/messaging/partners/${partnerId}/image-search" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "image=@/path/to/photo.jpg" \\
  -F "limit=68"`

  const textSearchCurl = `curl -sS -X POST \\
  "${baseUrl}/api/messaging/partners/${partnerId}/text-search" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"q":"black dress size M","limit":68}'`

  const imageSearchJson = `{
  "ok": true,
  "products": [
    {
      "inventory_id": "uuid",
      "name": "Product name",
      "sku": "SKU-1",
      "image_url": "https://…",
      "product_url": "https://your-shop.example/p/…",
      "score": 0.92,
      "price_hint": "199000 VND",
      "color_variants": [
        { "name": "Đen", "img": "https://cdn…/ao-thun-den.jpg" },
        { "name": "Trắng", "img": "https://cdn…/ao-thun-trang.jpg" }
      ],
      "color_image_urls": [
        "https://cdn…/detail-1.jpg",
        "https://cdn…/lifestyle-1.jpg"
      ]
    },
    {
      "inventory_id": "uuid-2",
      "name": "Item without link in catalog",
      "sku": null,
      "image_url": "https://…",
      "product_url": null,
      "score": null,
      "price_hint": null,
      "color_variants": [],
      "color_image_urls": []
    }
  ],
  "error": null
}`

  const imageSearchJsonEmpty = `{
  "ok": true,
  "products": [],
  "error": "No matching products (example message)"
}`

  const tryOnCurl = `curl -sS -X POST "${baseUrl}/api/v1/partner/try-on" \\
  -H "Authorization: Bearer YOUR_PARTNER_SECRET" \\
  -F "userImage=@person.jpg" \\
  -F "garmentImage0=@shirt.jpg" \\
  -F "garmentImage1=@shirt-back.jpg" \\
  -F "imageQuality=2K" \\
  -F "gender=female" \\
  -F "customPrompt=Keep hem length as in product photo"`

  const tryOnExampleJson = `{
  "ok": true,
  "result_url": "https://…/uploads/…/result_….png",
  "history_id": "550e8400-e29b-41d4-a716-446655440000",
  "credits_remaining": 42.5
}`

  const inventoryOpenUrl = `${baseUrl}/api/messaging/partners/${partnerId}/inventory/open-sync`

  const inventoryOpenCurl = `curl -sS -X POST "${inventoryOpenUrl}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"request_id":"trace-001","items":[{"item_sku":"SKU-001","item_name":"Cotton T-shirt","description":"Sizes M–XL","stock_note":"In stock","price":"199000","image":{"image_url_list":["https://cdn.example.com/1.jpg"]},"item_url":"https://shop.example.com/p/1","consult_note":"7-day exchange","sort_order":100,"item_status":"NORMAL"}]}'`

  const inventoryOpenResponse = `{
  "ok": true,
  "request_id": "trace-001",
  "count": 1,
  "inserted": 1,
  "updated": 0
}`

  const codeBlockCopyProps = {
    copyButtonLabel: t.copyCodeButton,
    copySuccessMessage: t.copyCodeToast,
    copyErrorMessage: t.copyCodeError,
  }

  const section = (title: string, body: string, children?: ReactNode) => (
    <div className="space-y-3 border-b border-border/60 pb-4 last:border-0 last:pb-0">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {children}
    </div>
  )

  if (!partners.length) {
    return (
      <Card className="border-primary/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.noWorkspaceTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="leading-relaxed text-muted-foreground">{t.noWorkspaceBody}</p>
          <Button size="sm" asChild>
            <Link href="/dashboard/messaging/settings">{t.noWorkspaceCta}</Link>
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">{t.snippetNote}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/15">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-foreground">
          {t.hostedAutoFilledNote}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{t.snippetNote}</p>
        {section(
          t.hostedTitle,
          t.hostedBody,
          <>
            <CodeBlock {...codeBlockCopyProps}>{hostedUrl}</CodeBlock>
            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-medium text-foreground">{t.embedWidgetSettingsTitle}</p>
              <p className="text-[11px] text-muted-foreground">{t.embedWidgetSettingsBody}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{t.embedPositionLabel}</span>
                  <select
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                    value={embedSide}
                    onChange={(e) => setEmbedSide(e.target.value === 'left' ? 'left' : 'right')}
                  >
                    <option value="right">{t.embedPositionRight}</option>
                    <option value="left">{t.embedPositionLeft}</option>
                  </select>
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{t.embedBottomOffsetLabel}</span>
                  <input
                    type="number"
                    min={0}
                    max={EMBED_BOTTOM_OFFSET_MAX_PX}
                    value={embedBottomPxInput}
                    onChange={(e) => setEmbedBottomPxInput(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{t.embedHorizontalOffsetLabel}</span>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={embedHorizontalPxInput}
                    onChange={(e) => setEmbedHorizontalPxInput(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{t.embedDesktopWidthLabel}</span>
                  <input
                    type="number"
                    min={280}
                    max={1200}
                    value={embedDesktopWidthPxInput}
                    onChange={(e) => setEmbedDesktopWidthPxInput(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{t.embedDesktopHeightLabel}</span>
                  <input
                    type="number"
                    min={320}
                    max={1200}
                    value={embedDesktopHeightPxInput}
                    onChange={(e) => setEmbedDesktopHeightPxInput(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{t.embedBorderRadiusLabel}</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={embedRadiusPxInput}
                    onChange={(e) => setEmbedRadiusPxInput(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  />
                </label>
              </div>
            </div>
            <CodeBlock
              title={t.codeLabelExample}
              copyButtonLabel={t.copyHostedScriptButton}
              copySuccessMessage={t.copyHostedScriptToast}
              copyErrorMessage={t.copyHostedScriptError}
            >
              {hostedScript}
            </CodeBlock>
            <div className="space-y-2 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
              <p className="text-xs font-medium text-foreground">{t.fashionEmbedConsultTryOnTitle}</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t.fashionEmbedConsultTryOnBody}</p>
              <CodeBlock title={t.codeLabelExample} {...codeBlockCopyProps}>
                {fashionProductPageButtons}
              </CodeBlock>
            </div>
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">{hostedCompatNote}</p>
            <CodeBlock title="Fallback #1 — iframe (không cần script)" {...codeBlockCopyProps}>
              {hostedIframe}
            </CodeBlock>
            <CodeBlock title="Fallback #2 — nút mở chat tab mới" {...codeBlockCopyProps}>
              {hostedLinkButton}
            </CodeBlock>
          </>
        )}

        {section(
          t.guestTitle,
          t.guestBody,
          <>
            <CodeBlock {...codeBlockCopyProps}>{guestGet}</CodeBlock>
            <CodeBlock {...codeBlockCopyProps}>{guestPost}</CodeBlock>
            <CodeBlock {...codeBlockCopyProps}>{guestImage}</CodeBlock>
            <p className="text-xs font-medium text-foreground">{t.guestVisionPickNote}</p>
            <CodeBlock {...codeBlockCopyProps}>{guestVisionPick}</CodeBlock>
          </>
        )}

        {section(
          t.imageSearchTitle,
          t.imageSearchBody,
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.imageSearchPrereq}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.imageSearchResponseEdgeCases}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.imageSearchHttpErrors}</p>
            <CodeBlock {...codeBlockCopyProps}>{`${baseUrl}/api/messaging/partners/${partnerId}/image-search`}</CodeBlock>
            <CodeBlock title={t.codeLabelExampleServer} {...codeBlockCopyProps}>
              {imageSearchCurl}
            </CodeBlock>
            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">{t.textSearchVectorBody}</p>
            <CodeBlock {...codeBlockCopyProps}>{`${baseUrl}/api/messaging/partners/${partnerId}/text-search`}</CodeBlock>
            <CodeBlock title={t.codeLabelExampleServer} {...codeBlockCopyProps}>
              {textSearchCurl}
            </CodeBlock>
            <CodeBlock title={t.codeLabelResponseShape} {...codeBlockCopyProps}>
              {imageSearchJson}
            </CodeBlock>
            <CodeBlock title={t.codeLabelResponseEmpty} {...codeBlockCopyProps}>
              {imageSearchJsonEmpty}
            </CodeBlock>
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">{t.imageSearchRateLimit}</p>
          </>
        )}

        {section(
          t.tryOnTitle,
          t.tryOnBody,
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.tryOnDocDetailNote}</p>
            <CodeBlock title={t.codeLabelExampleServer} {...codeBlockCopyProps}>
              {tryOnCurl}
            </CodeBlock>
            <CodeBlock title={t.codeLabelResponseShape} {...codeBlockCopyProps}>
              {tryOnExampleJson}
            </CodeBlock>
          </>
        )}

        {section(
          t.inventoryOpenTitle,
          t.inventoryOpenBody,
          <>
            <CodeBlock {...codeBlockCopyProps}>{inventoryOpenUrl}</CodeBlock>
            <CodeBlock title={t.codeLabelExampleServer} {...codeBlockCopyProps}>
              {inventoryOpenCurl}
            </CodeBlock>
            <CodeBlock title={t.codeLabelResponseShape} {...codeBlockCopyProps}>
              {inventoryOpenResponse}
            </CodeBlock>
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">{t.inventoryOpenRateLimit}</p>
          </>
        )}

        <div className="rounded-lg border border-dashed bg-muted/30 p-3">
          <p className="text-sm font-medium text-foreground">{t.checklistTitle}</p>
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{t.checklistBody}</p>
        </div>
      </CardContent>
    </Card>
  )
}
