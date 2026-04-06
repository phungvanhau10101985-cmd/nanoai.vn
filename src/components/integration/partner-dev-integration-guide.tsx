import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PartnerDevIntegrationStrings } from '@/lib/integration/partner-dev-integration-copy'

type Props = {
  baseUrl: string
  t: PartnerDevIntegrationStrings
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="space-y-1">
      {title ? <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p> : null}
      <pre className="overflow-x-auto rounded-md border bg-muted/60 p-3 text-[10px] leading-relaxed whitespace-pre-wrap break-all sm:text-[11px] sm:whitespace-pre">
        {children}
      </pre>
    </div>
  )
}

export function PartnerDevIntegrationGuide({ baseUrl, t }: Props) {
  const slug = '{slug}'
  const partnerId = '{partnerId}'
  const guestBase = `${baseUrl}/api/messaging/guest/${slug}`

  const hostedUrl = `${baseUrl}/messaging/p/${slug}?embed=1`
  const hostedIframe = `<iframe
  src="${hostedUrl}"
  title="Chat NanoAI"
  width="100%"
  height="560"
  style="border:0;border-radius:12px;max-width:100%"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade">
</iframe>`

  const guestGet = `GET ${guestBase}
Cookie: <supabase_auth_session>`

  const guestPost = `POST ${guestBase}
Content-Type: application/json
Cookie: <supabase_auth_session>

{ "text": "…", "imageStoragePath": "…" }`

  const guestImage = `POST ${guestBase}/image
Content-Type: multipart/form-data
Cookie: <supabase_auth_session>

file = (image binary)`

  const guestVisionPick = `POST ${guestBase}/vision-pick
Content-Type: application/json
Cookie: <supabase_auth_session>

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

  return (
    <Card className="border-primary/15">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <p className="text-xs leading-relaxed text-muted-foreground">{t.snippetNote}</p>
        {section(
          t.hostedTitle,
          t.hostedBody,
          <>
            <CodeBlock>{hostedUrl}</CodeBlock>
            <CodeBlock title={t.codeLabelExample}>{hostedIframe}</CodeBlock>
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
