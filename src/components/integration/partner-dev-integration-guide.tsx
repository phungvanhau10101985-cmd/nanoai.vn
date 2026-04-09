'use client'

import Link from 'next/link'
import { Copy } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import type { PartnerDevIntegrationStrings } from '@/lib/integration/partner-dev-integration-copy'

/** Giới hạn tối đa «Cách đáy» (px) trong form — script vẫn clamp cùng giá trị. */
const EMBED_BOTTOM_OFFSET_MAX_PX = 800

type Props = {
  baseUrl: string
  t: PartnerDevIntegrationStrings
  partners: Array<{ id: string; display_name: string | null; slug: string }>
  labels: {
    selectShop: string
    partnerId: string
  }
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
  const { toast } = useToast()
  const showToolbar = Boolean(title || copyButtonLabel)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      if (copySuccessMessage) toast({ title: copySuccessMessage })
    } catch {
      if (copyErrorMessage) toast({ title: copyErrorMessage, variant: 'destructive' })
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
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2 text-[11px]"
              onClick={() => void handleCopy()}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copyButtonLabel}
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

export function PartnerDevIntegrationGuide({ baseUrl, t, partners, labels }: Props) {
  const [selectedPartnerId, setSelectedPartnerId] = useState(partners[0]?.id ?? '')
  const [embedSide, setEmbedSide] = useState<'left' | 'right'>('right')
  const [embedBottomPx, setEmbedBottomPx] = useState(24)
  const [embedHorizontalPx, setEmbedHorizontalPx] = useState(16)
  const [embedDesktopWidthPx, setEmbedDesktopWidthPx] = useState(380)
  const [embedDesktopHeightPx, setEmbedDesktopHeightPx] = useState(560)
  const [embedRadiusPx, setEmbedRadiusPx] = useState(12)
  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId) ?? partners[0] ?? null,
    [partners, selectedPartnerId]
  )

  const slug = selectedPartner?.slug ?? ''
  const partnerId = selectedPartner?.id ?? ''
  const guestBase = `${baseUrl}/api/messaging/guest/${slug}`
  const safeBottomPx = Math.max(0, Math.min(EMBED_BOTTOM_OFFSET_MAX_PX, Math.floor(embedBottomPx) || 24))
  const safeHorizontalPx = Math.max(0, Math.min(300, Math.floor(embedHorizontalPx) || 16))
  const safeDesktopWidthPx = Math.max(280, Math.min(1200, Math.floor(embedDesktopWidthPx) || 380))
  const safeDesktopHeightPx = Math.max(320, Math.min(1200, Math.floor(embedDesktopHeightPx) || 560))
  const safeRadiusPx = Math.max(0, Math.min(60, Math.floor(embedRadiusPx) || 12))
  const safeDesktopWidthVw = Math.max(40, Math.min(98, Math.round((safeDesktopWidthPx / 1920) * 100)))
  const safeDesktopHeightVh = Math.max(40, Math.min(95, Math.round((safeDesktopHeightPx / 1080) * 100)))

  const hostedUrl = `${baseUrl}/messaging/p/${slug}?embed=1`
  const hostedScript = `<script>
(function () {
  var CONFIG = {
    chatUrl: "${hostedUrl}",
    logoUrl: "${baseUrl}/icons/icon-192x192.png",
    widgetId: "app-chat-widget-v1",
    side: "${embedSide}",
    zIndex: 2147483000,
    desktop: {
      bottom: ${safeBottomPx},
      offsetX: ${safeHorizontalPx},
      width: ${safeDesktopWidthPx},
      height: ${safeDesktopHeightPx},
      radius: ${safeRadiusPx},
      gapAboveBubble: 14
    },
    mobile: {
      breakpoint: 768,
      fullScreen: true,
      bubbleSize: 52
    },
    bubble: { size: 56 }
  };

  if (document.getElementById(CONFIG.widgetId)) return;
  var root = document.createElement("div");
  root.id = CONFIG.widgetId;
  root.style.cssText =
    "position:fixed;z-index:" + CONFIG.zIndex + ";font-family:Arial,sans-serif;pointer-events:none;";
  document.body.appendChild(root);

  var bubble = document.createElement("button");
  bubble.type = "button";
  bubble.setAttribute("aria-label", "Mở chat NanoAI");
  bubble.style.cssText =
    "pointer-events:auto;width:" + CONFIG.bubble.size + "px;height:" + CONFIG.bubble.size + "px;border:none;border-radius:9999px;cursor:pointer;" +
    "background:linear-gradient(135deg,#7c3aed,#6366f1);" +
    "box-shadow:0 10px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;padding:0;";
  var logo = document.createElement("img");
  logo.src = CONFIG.logoUrl;
  logo.alt = "NanoAI";
  logo.style.cssText = "width:30px;height:30px;object-fit:contain;display:block;";
  logo.onerror = function () { this.style.display = "none"; bubble.textContent = "AI"; bubble.style.color = "#fff"; bubble.style.fontWeight = "700"; };
  bubble.appendChild(logo);
  root.appendChild(bubble);

  var panel = document.createElement("div");
  panel.style.cssText =
    "pointer-events:auto;display:none;position:absolute;background:#fff;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.28);border:1px solid #e5e7eb;";
  root.appendChild(panel);

  var header = document.createElement("div");
  header.style.cssText = "height:44px;background:#fff;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;padding:0 10px;";
  header.innerHTML = '<div style="font-weight:700;font-size:15px;color:#111">NanoAI</div>';
  panel.appendChild(header);

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Đóng chat");
  closeBtn.style.cssText = "width:28px;height:28px;border:none;border-radius:8px;cursor:pointer;background:#f3f4f6;color:#111;font-size:18px;line-height:1;";
  closeBtn.textContent = "×";
  header.appendChild(closeBtn);

  var body = document.createElement("div");
  body.style.cssText = "width:100%;height:calc(100% - 44px);";
  panel.appendChild(body);

  var iframe = null;
  function ensureIframe() {
    if (iframe) return;
    iframe = document.createElement("iframe");
    iframe.src = CONFIG.chatUrl;
    iframe.title = "Chat NanoAI";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.style.cssText = "width:100%;height:100%;border:0;";
    body.appendChild(iframe);
  }

  function openChat() { ensureIframe(); panel.style.display = "block"; bubble.style.display = "none"; }
  function closeChat() { panel.style.display = "none"; bubble.style.display = "flex"; }
  bubble.addEventListener("click", openChat);
  closeBtn.addEventListener("click", closeChat);

  function placeDesktop() {
    var d = CONFIG.desktop;
    root.style.top = "";
    root.style.left = "";
    root.style.right = "";
    root.style.bottom = d.bottom + "px";
    if (CONFIG.side === "left") {
      root.style.left = d.offsetX + "px";
      root.style.right = "auto";
      panel.style.position = "absolute";
      panel.style.left = "0";
      panel.style.right = "auto";
      panel.style.top = "";
    } else {
      root.style.right = d.offsetX + "px";
      root.style.left = "auto";
      panel.style.position = "absolute";
      panel.style.right = "0";
      panel.style.left = "auto";
      panel.style.top = "";
    }
    panel.style.bottom = (CONFIG.bubble.size + d.gapAboveBubble) + "px";
    panel.style.width = "min(${safeDesktopWidthVw}vw," + d.width + "px)";
    panel.style.height = "min(${safeDesktopHeightVh}vh," + d.height + "px)";
    panel.style.borderRadius = d.radius + "px";
    bubble.style.position = "";
    bubble.style.left = "";
    bubble.style.right = "";
    bubble.style.bottom = "";
    bubble.style.width = CONFIG.bubble.size + "px";
    bubble.style.height = CONFIG.bubble.size + "px";
    bubble.style.margin = "0";
  }

  function placeMobile() {
    var d = CONFIG.desktop;
    root.style.top = "0";
    root.style.left = "0";
    root.style.right = "0";
    root.style.bottom = "0";
    bubble.style.position = "absolute";
    bubble.style.bottom = d.bottom + "px";
    bubble.style.margin = "0";
    bubble.style.width = CONFIG.mobile.bubbleSize + "px";
    bubble.style.height = CONFIG.mobile.bubbleSize + "px";
    if (CONFIG.side === "left") {
      bubble.style.left = d.offsetX + "px";
      bubble.style.right = "auto";
    } else {
      bubble.style.right = d.offsetX + "px";
      bubble.style.left = "auto";
    }
    if (CONFIG.mobile.fullScreen) {
      panel.style.position = "fixed";
      panel.style.left = "0";
      panel.style.right = "0";
      panel.style.top = "0";
      panel.style.bottom = "0";
      panel.style.width = "100vw";
      panel.style.height = "100dvh";
      panel.style.borderRadius = "0";
    } else {
      placeDesktop();
    }
  }

  var resizeTimer = null;
  function applyLayout() {
    if (window.innerWidth <= CONFIG.mobile.breakpoint) placeMobile();
    else placeDesktop();
  }
  function onResize() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(applyLayout, 100);
  }
  applyLayout();
  window.addEventListener("resize", onResize, { passive: true });
})();
</script>`

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
  -F "limit=8"`

  const imageSearchJson = `{
  "ok": true,
  "products": [
    {
      "inventory_id": "uuid",
      "name": "Product name",
      "sku": "SKU-1",
      "image_url": "https://…",
      "product_url": "https://your-shop.example/p/…",
      "score": 0.92
    }
  ],
  "error": null
}`

  const tryOnCurl = `curl -sS -X POST "${baseUrl}/api/v1/partner/try-on" \\
  -H "Authorization: Bearer YOUR_PARTNER_SECRET" \\
  -F "userImage=@person.jpg" \\
  -F "garmentImage0=@shirt.jpg" \\
  -F "imageQuality=2K" \\
  -F "gender=male"`

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
        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
          <label className="text-xs font-medium text-foreground">{labels.selectShop}</label>
          <select
            className="h-9 w-full max-w-md rounded-md border border-border bg-background px-2 text-sm"
            value={selectedPartner?.id ?? ''}
            onChange={(e) => setSelectedPartnerId(e.target.value)}
          >
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.display_name?.trim() || p.slug) + ' — slug: ' + p.slug}
              </option>
            ))}
          </select>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <p className="font-mono break-all">
              {labels.partnerId}: {partnerId}
            </p>
            <p className="font-mono break-all">
              {t.shopIdentifierLabel}: {slug}
            </p>
          </div>
          <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-foreground">
            {t.hostedAutoFilledNote}
          </p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{t.snippetNote}</p>
        {section(
          t.hostedTitle,
          t.hostedBody,
          <>
            <CodeBlock>{hostedUrl}</CodeBlock>
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
                    value={safeBottomPx}
                    onChange={(e) => setEmbedBottomPx(Number.parseInt(e.target.value || '0', 10))}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{t.embedHorizontalOffsetLabel}</span>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={safeHorizontalPx}
                    onChange={(e) => setEmbedHorizontalPx(Number.parseInt(e.target.value || '0', 10))}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{t.embedDesktopWidthLabel}</span>
                  <input
                    type="number"
                    min={280}
                    max={1200}
                    value={safeDesktopWidthPx}
                    onChange={(e) => setEmbedDesktopWidthPx(Number.parseInt(e.target.value || '0', 10))}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{t.embedDesktopHeightLabel}</span>
                  <input
                    type="number"
                    min={320}
                    max={1200}
                    value={safeDesktopHeightPx}
                    onChange={(e) => setEmbedDesktopHeightPx(Number.parseInt(e.target.value || '0', 10))}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  <span>{t.embedBorderRadiusLabel}</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={safeRadiusPx}
                    onChange={(e) => setEmbedRadiusPx(Number.parseInt(e.target.value || '0', 10))}
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
          </>
        )}

        {section(
          t.guestTitle,
          t.guestBody,
          <>
            <CodeBlock>{guestGet}</CodeBlock>
            <CodeBlock>{guestPost}</CodeBlock>
            <CodeBlock>{guestImage}</CodeBlock>
            <p className="text-xs font-medium text-foreground">{t.guestVisionPickNote}</p>
            <CodeBlock>{guestVisionPick}</CodeBlock>
          </>
        )}

        {section(
          t.imageSearchTitle,
          t.imageSearchBody,
          <>
            <CodeBlock>{`${baseUrl}/api/messaging/partners/${partnerId}/image-search`}</CodeBlock>
            <CodeBlock title={t.codeLabelExampleServer}>{imageSearchCurl}</CodeBlock>
            <CodeBlock title={t.codeLabelResponseShape}>{imageSearchJson}</CodeBlock>
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">{t.imageSearchRateLimit}</p>
          </>
        )}

        {section(
          t.tryOnTitle,
          t.tryOnBody,
          <>
            <CodeBlock title={t.codeLabelExample}>{tryOnCurl}</CodeBlock>
          </>
        )}

        {section(
          t.inventoryOpenTitle,
          t.inventoryOpenBody,
          <>
            <CodeBlock>{inventoryOpenUrl}</CodeBlock>
            <CodeBlock title={t.codeLabelExampleServer}>{inventoryOpenCurl}</CodeBlock>
            <CodeBlock title={t.codeLabelResponseShape}>{inventoryOpenResponse}</CodeBlock>
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
