import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  API_KEYS_HUB_COPY,
  isApiHubBaseUrlPlaceholder,
  type ApiKeysHubLocale,
} from '@/lib/integration/api-keys-hub-copy'
import { pickApiKeysHubLocale } from '@/lib/integration/api-keys-hub-locale-server'
import { PartnerApiIntegrationWorkspace } from '@/components/integration/partner-api-integration-workspace'

export type ApiKeysHubVariant = 'partner' | 'operator'

type Props = {
  variant: ApiKeysHubVariant
  baseUrl: string
  /** Override locale (e.g. from server dictionary) */
  locale?: ApiKeysHubLocale
  /** Workspaces của user — để quản lý khóa trên trang đối tác */
  partnerWorkspaces?: { id: string; display_name: string | null; slug: string; logo_url: string | null }[]
  /** `?partner=` từ URL — đã khớp owner trên server */
  initialSelectedPartnerId?: string | null
}

export function ApiKeysHub({
  variant,
  baseUrl,
  locale: localeProp,
  partnerWorkspaces,
  initialSelectedPartnerId = null,
}: Props) {
  const locale = localeProp ?? pickApiKeysHubLocale()
  const t = API_KEYS_HUB_COPY[locale]
  const isPartner = variant === 'partner'

  const backHref = isPartner ? '/dashboard' : '/admin'
  const backLabel = isPartner ? t.backPartner : t.backAdmin
  const title = isPartner ? t.pageTitlePartner : t.pageTitle
  const lead = isPartner ? t.partnerPageLead : t.pageLead
  const ruleBody = isPartner ? t.partnerRuleBody : t.ruleBody
  const footer = isPartner ? t.partnerExtendNote : t.extendNote

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href={backHref}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {backLabel}
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{lead}</p>
          {isPartner && isApiHubBaseUrlPlaceholder(baseUrl) ? (
            <p
              role="status"
              className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:text-amber-100"
            >
              {t.partnerBaseUrlFallbackWarning}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/dashboard/messaging">{t.openDashboard}</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/messaging/settings">{t.openMessagingSettings}</Link>
            </Button>
            {!isPartner ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/integrations">{t.openIntegrations}</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/customer-care">{t.openCustomerCare}</Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {isPartner ? (
        <Suspense
          fallback={<div className="h-40 animate-pulse rounded-xl border border-border/60 bg-muted/30" aria-hidden />}
        >
          <PartnerApiIntegrationWorkspace
            partners={partnerWorkspaces ?? []}
            initialSelectedPartnerId={initialSelectedPartnerId}
            baseUrl={baseUrl}
            locale={locale}
            betweenKeysAndGuide={
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.ruleTitle}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">{ruleBody}</CardDescription>
                </CardHeader>
              </Card>
            }
          />
        </Suspense>
      ) : null}

      {!isPartner ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.ruleTitle}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{ruleBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!isPartner ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.s1Title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">{t.s1Lead}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <div>
                <p className="font-medium text-foreground">{t.embedTitle}</p>
                <p className="mt-1 text-muted-foreground">{t.embedBody}</p>
                <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/50 p-3 text-[11px] leading-relaxed">
                  {`${baseUrl}/messaging/p/{slug}?embed=1`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-foreground">{t.imageSearchTitle}</p>
                <p className="mt-1 text-muted-foreground">{t.imageSearchBody}</p>
                <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/50 p-3 text-[11px] leading-relaxed">
                  {`POST ${baseUrl}/api/messaging/partners/{partnerId}/image-search`}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.s2Title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">{t.s2Lead}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p className="text-muted-foreground">{t.tryOnBody}</p>
              <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 text-[11px] leading-relaxed">
                {`POST ${baseUrl}/api/v1/partner/try-on`}
              </pre>
            </CardContent>
          </Card>
        </>
      ) : null}

      {isPartner ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.partnerOpsNoteTitle}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{t.partnerOpsNoteBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.s3Title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">{t.s3Lead}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <div>
                <p className="font-medium text-foreground">{t.envCronTitle}</p>
                <p className="mt-1 text-muted-foreground">{t.envCronBody}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">{t.envInternalTitle}</p>
                <p className="mt-1 text-muted-foreground">{t.envInternalBody}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.s4Title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">{t.s4Lead}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{t.webhookBody}</p>
            </CardContent>
          </Card>
        </>
      )}

      <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">{footer}</p>
    </div>
  )
}
