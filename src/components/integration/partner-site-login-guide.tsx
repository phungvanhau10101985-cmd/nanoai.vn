'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Check, Copy, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PARTNER_SITE_LOGIN_GUIDE_COPY,
  type PartnerSiteLoginGuideStrings,
} from '@/lib/integration/partner-site-login-guide-copy'
import type { ApiKeysHubLocale } from '@/lib/integration/partner-dev-integration-copy'

type Partner = {
  id: string
  display_name: string | null
  slug: string
  logo_url: string | null
  embed_key?: string
}

type Props = {
  baseUrl: string
  locale: ApiKeysHubLocale
  partners: Partner[]
  initialSelectedPartnerId: string | null
}

function CodeBlock({
  children,
  title,
  t,
}: {
  children: string
  title?: string
  t: PartnerSiteLoginGuideStrings
}) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  useEffect(() => {
    if (copyStatus === 'idle') return
    const ms = copyStatus === 'ok' ? 2200 : 3200
    const id = window.setTimeout(() => setCopyStatus('idle'), ms)
    return () => window.clearTimeout(id)
  }, [copyStatus])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopyStatus('ok')
    } catch {
      setCopyStatus('err')
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? (
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-[11px]"
          onClick={() => void handleCopy()}
        >
          {copyStatus === 'ok' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copyStatus === 'ok' ? t.copyCodeToast : copyStatus === 'err' ? t.copyCodeError : t.copyCodeButton}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border bg-muted/60 p-3 text-[10px] leading-relaxed whitespace-pre-wrap break-all sm:text-[11px] sm:whitespace-pre">
        {children}
      </pre>
    </div>
  )
}

function resolveInitialPartnerId(partners: Partner[], preferred: string | null): string {
  if (preferred && partners.some((p) => p.id === preferred)) return preferred
  return partners[0]?.id ?? ''
}

export function PartnerSiteLoginGuide({
  baseUrl,
  locale,
  partners,
  initialSelectedPartnerId,
}: Props) {
  const t = PARTNER_SITE_LOGIN_GUIDE_COPY[locale]
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [partnerId, setPartnerIdState] = useState(() =>
    resolveInitialPartnerId(partners, initialSelectedPartnerId)
  )

  const setPartnerId = useCallback(
    (id: string) => {
      const nextId = id.trim()
      if (!nextId || !partners.some((p) => p.id === nextId)) return
      setPartnerIdState(nextId)
      const next = new URLSearchParams(searchParams.toString())
      next.set('partner', nextId)
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [partners, pathname, router, searchParams]
  )

  useEffect(() => {
    const urlPid = searchParams.get('partner')?.trim() ?? ''
    if (urlPid && partners.some((p) => p.id === urlPid) && urlPid !== partnerId) {
      setPartnerIdState(urlPid)
    }
  }, [searchParams, partners, partnerId])

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === partnerId) ?? partners[0] ?? null,
    [partners, partnerId]
  )

  const slug = selectedPartner?.slug ?? '{slug}'
  const shopLabel = (selectedPartner?.display_name ?? '').trim() || 'Shop'
  const embedKeyForExamples = (selectedPartner?.embed_key ?? '').trim() || 'YOUR_EMBED_KEY'
  const hostedUrl = `${baseUrl}/messaging/p/${slug}?embed=1`
  const guestBase = `${baseUrl}/api/messaging/guest/${slug}`

  const partnerSiteAuthPayload = `{
  "email": "customer@example.com",
  "name": "Display name for inbox",
  "phone": "0901234567",
  "exp": 1730000300,
  "sig": "64-char hex HMAC-SHA256(embed_key, email|exp)"
}`

  const shopTokenApiPath = 'GET /api/v1/nanoai/customer-token'

  const shopEnvDeploy = `# On shop web VPS (not NanoAI VPS)
NANOAI_EMBED_KEY=${embedKeyForExamples}
# Restart API + web after setting env

# Smoke test (logged in):
curl -b cookies.txt https://YOUR-SHOP/api/v1/nanoai/customer-token
# 200 + {"token":"...","expires_at":...} → OK
# 503 → missing NANOAI_EMBED_KEY
# 401 → not logged in`

  const partnerSiteAuthWidget = `<!-- SPA / CSR (e.g. 188 Next.js) — after login -->
<script>
  const res = await fetch('/api/v1/nanoai/customer-token', { credentials: 'include' })
  if (!res.ok) return
  const { token } = await res.json()
  window.NanoAIMessagingGateway?.setCustomer?.({ token })
  // On shop logout:
  window.NanoAIMessagingGateway?.clearCustomer?.()
</script>

<!-- Optional SSR: data-partner-customer-token on widget script -->`

  const partnerSiteAuthApi = `POST ${guestBase}/auth/partner-site
Content-Type: application/json

{ "token": "<base64url from shop server>" }
// Called automatically by chat iframe — manual call optional.`

  const nextJsSnippet = `export async function syncNanoAiCustomerAfterLogin() {
  const res = await fetch('/api/v1/nanoai/customer-token', { credentials: 'include' })
  if (!res.ok) return
  const { token } = await res.json()
  window.NanoAIMessagingGateway?.setCustomer?.({ token })
}`

  const testCurl = `# Shop API (logged in)
curl -s -b cookies.txt https://YOUR-SHOP/api/v1/nanoai/customer-token

# Browser console (after login)
document.querySelector('script[src*="nanoai-chat-widget"]')?.getAttribute('data-partner-customer-token')

# NanoAI auth debug (replace TOKEN):
curl -s -X POST "${guestBase}/auth/partner-site" \\
  -H "Content-Type: application/json" \\
  -d '{"token":"TOKEN"}'`

  const nanoaiRepoTest = `npm run test:partner-site-token
# Spec: src/lib/messaging/partner-site-customer-auth.ts`

  if (!partners.length) {
    return (
      <Card className="border-primary/15">
        <CardHeader>
          <CardTitle className="text-base">{t.noWorkspaceTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">{t.noWorkspaceBody}</p>
          <Button size="sm" asChild>
            <Link href="/dashboard/messaging/settings">{t.noWorkspaceCta}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/messaging/settings">{t.backMessagingSettings}</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link
            href={
              selectedPartner?.id
                ? `/dashboard/api-integration?partner=${encodeURIComponent(selectedPartner.id)}`
                : '/dashboard/api-integration'
            }
          >
            {t.backApiIntegration}
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm dark:from-slate-900 dark:to-slate-950">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
          <UserCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t.pageTitle}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.pageLead}</p>
        </div>
      </div>

      <Card className="border-primary/15">
        <CardContent className="space-y-4 pt-6 text-sm">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground">{t.selectShopHint}</span>
            <select
              className="h-9 w-full max-w-md rounded-md border border-border bg-background px-2 text-sm"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.display_name ?? '').trim() || p.slug} — {p.slug}
                </option>
              ))}
            </select>
          </label>
          <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed">
            {t.hostedAutoFilledNote}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Slug:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{slug}</code>
            {' · '}
            <span className="font-medium text-foreground">Chat URL:</span>{' '}
            <code className="break-all rounded bg-muted px-1 py-0.5 text-[11px]">{hostedUrl}</code>
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            {t.problemTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t.problemBody}</p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[320px] text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.inboxTableTitle}</th>
                  <th className="px-3 py-2 font-medium">Inbox</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-3 py-2">{t.inboxRowGuest}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.inboxRowGuestOk.replace('{shop}', shopLabel)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">{t.inboxRowLoggedNoToken}</td>
                  <td className="px-3 py-2 text-amber-800 dark:text-amber-200">
                    {t.inboxRowLoggedNoTokenBad.replace('{shop}', shopLabel)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">{t.inboxRowWithToken}</td>
                  <td className="px-3 py-2 text-emerald-800 dark:text-emerald-200">
                    {t.inboxRowWithTokenGoal.replace('{shop}', shopLabel).replace('{Customer name}', 'Nguyễn Văn A').replace('{顾客名}', 'Nguyễn Văn A').replace('{顧客名}', 'Nguyễn Văn A').replace('{고객명}', 'Nguyễn Văn A')}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">{t.inboxRowEmailOnly}</td>
                  <td className="px-3 py-2 text-muted-foreground">user · {shopLabel}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.flowTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed">
{`[Server shop]  Sign token (email + name + exp) with Embed Key
      ↓
[Web shop]     data-partner-customer-token or setCustomer({ token })
      ↓
[Widget]       Opens iframe with pc_token
      ↓
[Iframe]       POST ${guestBase}/auth/partner-site
      ↓
[NanoAI]       Guest account + inbox name sync`}
          </pre>
          <p className="text-muted-foreground">{t.flowBody}</p>
          <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
            <li>{t.prepEmbedKey}</li>
            <li>{t.prepSlug}</li>
            <li>{t.prepWidget}</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.opsNoteTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t.opsNoteBody}</p>
          <CodeBlock title={t.apiPathLabel} t={t}>
            {shopTokenApiPath}
          </CodeBlock>
          <CodeBlock title={t.checklistTitle} t={t}>
            {shopEnvDeploy}
          </CodeBlock>
        </CardContent>
      </Card>

      <Card className="border-rose-500/30 bg-rose-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.troubleshootTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{t.troubleshootBody}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.tokenTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t.tokenBody}</p>
          {selectedPartner?.embed_key?.trim() ? (
            <p className="text-xs text-muted-foreground">
              {t.partnerSiteAuthEmbedKeyHint}{' '}
              <code className="break-all rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                {selectedPartner.embed_key.trim()}
              </code>
            </p>
          ) : null}
          <CodeBlock title={t.codeLabelTokenPayload} t={t}>
            {partnerSiteAuthPayload}
          </CodeBlock>
          <CodeBlock title={t.codeLabelWidgetPassToken} t={t}>
            {partnerSiteAuthWidget}
          </CodeBlock>
          <CodeBlock title={t.codeLabelExampleServer} t={t}>
            {partnerSiteAuthApi}
          </CodeBlock>
          <div>
            <p className="mb-2 text-xs font-medium">{t.nextJsTitle}</p>
            <p className="mb-2 text-xs text-muted-foreground">{t.nextJsBody}</p>
            <CodeBlock title={t.codeLabelNextJs} t={t}>
              {nextJsSnippet}
            </CodeBlock>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">{t.testTitle}</p>
            <p className="mb-2 text-xs text-muted-foreground">{t.testBody}</p>
            <CodeBlock title={t.codeLabelTest} t={t}>
              {testCurl}
            </CodeBlock>
          </div>
          <CodeBlock title={t.nanoaiTestCmd} t={t}>
            {nanoaiRepoTest}
          </CodeBlock>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.checklistTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{t.checklistBody}</p>
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">{t.fullGuideNote}</p>
    </div>
  )
}
