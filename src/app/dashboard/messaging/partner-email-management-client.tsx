'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { MessagingPartnerDashboardRow } from '@/lib/db/messaging-partners-pg'
import type { PartnerEmailManagementOverview, PartnerNewsletterSubscriberRow } from '@/lib/db/messaging-partner-email-management-pg'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  deactivatePartnerNewsletterSubscriberAction,
  exportPartnerNewsletterCsvAction,
  getPartnerEmailManagementOverviewAction,
  importPartnerNewsletterEmailsAction,
  listPartnerNewsletterSubscribersAction,
  runPartnerBirthdayPromoNowAction,
  savePartnerEmailSendSettingsAction,
  sendPartnerNewsletterBroadcastAction,
  sendPartnerPromoTestEmailAction,
  type PartnerPromoTestKind,
} from '@/app/dashboard/messaging/email-actions'
import { Mail } from 'lucide-react'

type Props = {
  initialPartners: MessagingPartnerDashboardRow[]
  t: Dictionary['partnerMessagingEmail']
  lockedPartnerId?: string
}

type Tab = 'manage' | 'list'

const PAGE_SIZE = 50

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

export function PartnerEmailManagementClient({ initialPartners, t, lockedPartnerId }: Props) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const partnerId = lockedPartnerId?.trim() || initialPartners[0]?.id || ''
  const [tab, setTab] = useState<Tab>('manage')
  const [overview, setOverview] = useState<PartnerEmailManagementOverview | null>(null)
  const [warmupEnabled, setWarmupEnabled] = useState(true)
  const [startLimit, setStartLimit] = useState(5)
  const [dailyIncrement, setDailyIncrement] = useState(5)
  const [maxLimit, setMaxLimit] = useState('')
  const [birthdayCron, setBirthdayCron] = useState(true)
  const [cartEmail, setCartEmail] = useState(true)
  const [comebackEmail, setComebackEmail] = useState(true)
  const [newsletterWelcome, setNewsletterWelcome] = useState(true)
  const [testEmail, setTestEmail] = useState('')
  const [testKind, setTestKind] = useState<PartnerPromoTestKind>('birthday')

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(0)
  const [subs, setSubs] = useState<{
    items: PartnerNewsletterSubscriberRow[]
    total: number
    activeTotal: number
  } | null>(null)
  const [importText, setImportText] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const loadOverview = useCallback(async () => {
    if (!partnerId) return
    const res = await getPartnerEmailManagementOverviewAction(partnerId)
    if ('overview' in res && res.overview) {
      setOverview(res.overview)
      setWarmupEnabled(res.overview.warmup_enabled)
      setStartLimit(res.overview.start_limit)
      setDailyIncrement(res.overview.daily_increment)
      setMaxLimit(res.overview.max_limit != null ? String(res.overview.max_limit) : '')
      setBirthdayCron(res.overview.birthday_cron_enabled)
      setCartEmail(res.overview.cart_abandon_email_enabled)
      setComebackEmail(res.overview.comeback_email_enabled)
      setNewsletterWelcome(res.overview.newsletter_welcome_email_enabled)
    }
  }, [partnerId])

  const loadSubs = useCallback(async () => {
    if (!partnerId) return
    const res = await listPartnerNewsletterSubscribersAction({
      partnerId,
      q,
      activeOnly: filter === 'all' ? null : filter === 'active',
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
    if ('items' in res && Array.isArray(res.items)) {
      setSubs({ items: res.items, total: res.total, activeTotal: res.activeTotal })
    }
  }, [filter, page, partnerId, q])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    if (tab === 'list') void loadSubs()
  }, [loadSubs, tab])

  function mapError(code: string | undefined): string {
    if (code === 'smtp_not_configured') return t.errorSmtp
    if (code === 'warmup_quota') return t.errorWarmup
    if (code === 'invalid_email') return t.errorInvalidEmail
    if (code === 'Forbidden.') return t.errorGeneric
    return t.errorGeneric
  }

  function saveSettings() {
    if (!partnerId) return
    startTransition(async () => {
      const res = await savePartnerEmailSendSettingsAction({
        partnerId,
        warmupEnabled,
        startLimit,
        dailyIncrement,
        maxLimit: maxLimit.trim() ? Number(maxLimit) : null,
        birthdayCronEnabled: birthdayCron,
        cartAbandonEmailEnabled: cartEmail,
        comebackEmailEnabled: comebackEmail,
        newsletterWelcomeEmailEnabled: newsletterWelcome,
      })
      if ('error' in res) {
        toast({ variant: 'destructive', title: mapError(res.error) })
        return
      }
      toast({ title: t.saved })
      void loadOverview()
    })
  }

  function runBirthday() {
    if (!partnerId) return
    startTransition(async () => {
      const res = await runPartnerBirthdayPromoNowAction(partnerId)
      if ('error' in res) {
        toast({ variant: 'destructive', title: mapError(res.error) })
        return
      }
      toast({
        title: fill(t.birthdayRunOk, { sent: res.sent, skipped: res.skipped, deferred: res.deferredQuota }),
      })
      void loadOverview()
    })
  }

  function sendTest() {
    if (!partnerId) return
    startTransition(async () => {
      const res = await sendPartnerPromoTestEmailAction({
        partnerId,
        toEmail: testEmail,
        kind: testKind,
        subject,
        message,
      })
      if ('error' in res) {
        toast({ variant: 'destructive', title: mapError(res.error) })
        return
      }
      toast({ title: t.testOk })
      void loadOverview()
    })
  }

  async function readImportLines(): Promise<string[]> {
    const fromText = importText.split(/\r?\n/)
    if (!importFile) return fromText
    const text = await importFile.text()
    return [...fromText, ...text.split(/\r?\n/)]
  }

  function doImport() {
    if (!partnerId) return
    startTransition(async () => {
      const lines = await readImportLines()
      const res = await importPartnerNewsletterEmailsAction({ partnerId, lines })
      if ('error' in res) {
        toast({ variant: 'destructive', title: mapError(res.error) })
        return
      }
      const r = res.result
      toast({
        title: fill(t.importResult, {
          parsed: r.parsed,
          created: r.created,
          reactivated: r.reactivated,
          skipped: r.skipped_active,
          corrected: r.corrected,
          invalid: r.invalid,
          dup: r.duplicate_in_file,
        }),
      })
      setImportText('')
      setImportFile(null)
      void loadSubs()
      void loadOverview()
    })
  }

  function doExport() {
    if (!partnerId) return
    startTransition(async () => {
      const res = await exportPartnerNewsletterCsvAction(partnerId)
      if ('error' in res) {
        toast({ variant: 'destructive', title: mapError(res.error) })
        return
      }
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'newsletter-subscribers.csv'
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  function doBroadcast() {
    if (!partnerId) return
    const count = subs?.activeTotal ?? overview?.active_subscribers ?? 0
    if (!window.confirm(fill(t.confirmBroadcast, { count }))) return
    startTransition(async () => {
      const res = await sendPartnerNewsletterBroadcastAction({ partnerId, subject, message })
      if ('error' in res) {
        toast({ variant: 'destructive', title: mapError(res.error) })
        return
      }
      toast({ title: fill(t.broadcastOk, { sent: res.sent, skipped: res.skipped, failed: res.failed }) })
      void loadOverview()
    })
  }

  const pages = useMemo(() => Math.max(1, Math.ceil((subs?.total || 0) / PAGE_SIZE)), [subs?.total])

  if (!partnerId) {
    return <p className="text-sm text-muted-foreground">{t.noWorkspace}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Mail className="h-5 w-5" aria-hidden />
          {t.pageTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.pageDescription}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant={tab === 'manage' ? 'default' : 'outline'} onClick={() => setTab('manage')}>
          {t.tabManage}
        </Button>
        <Button size="sm" variant={tab === 'list' ? 'default' : 'outline'} onClick={() => setTab('list')}>
          {t.tabList}
        </Button>
      </div>

      {tab === 'manage' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.warmupTitle}</CardTitle>
              <CardDescription>{t.warmupHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview && !overview.smtp_configured ? (
                <p className="text-sm text-amber-700">{t.smtpMissing}</p>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={warmupEnabled} onChange={(e) => setWarmupEnabled(e.target.checked)} />
                {t.warmupEnabled}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>{t.startLimit}</Label>
                  <Input type="number" min={1} value={startLimit} onChange={(e) => setStartLimit(Number(e.target.value))} />
                </div>
                <div>
                  <Label>{t.dailyIncrement}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={dailyIncrement}
                    onChange={(e) => setDailyIncrement(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>{t.maxLimit}</Label>
                  <Input value={maxLimit} onChange={(e) => setMaxLimit(e.target.value)} placeholder={t.maxLimitHint} />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{t.channelsTitle}</p>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={birthdayCron} onChange={(e) => setBirthdayCron(e.target.checked)} />
                  {t.birthdayCron}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={cartEmail} onChange={(e) => setCartEmail(e.target.checked)} />
                  {t.cartEmail}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={comebackEmail} onChange={(e) => setComebackEmail(e.target.checked)} />
                  {t.comebackEmail}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newsletterWelcome}
                    onChange={(e) => setNewsletterWelcome(e.target.checked)}
                  />
                  {t.newsletterWelcome}
                </label>
              </div>
              <Button size="sm" onClick={saveSettings} disabled={pending}>
                {pending ? t.saving : t.saveSettings}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.statsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <p>
                {t.warmupDay}: <strong>{overview?.warmup_day ?? '—'}</strong>
              </p>
              <p>
                {t.dailyLimit}:{' '}
                <strong>{overview?.daily_limit == null ? t.unlimited : overview.daily_limit}</strong>
              </p>
              <p>
                {t.sentToday}: <strong>{overview?.daily_sent_total ?? 0}</strong>
              </p>
              <p>
                {t.remainingToday}:{' '}
                <strong>{overview?.remaining_today == null ? t.unlimited : overview.remaining_today}</strong>
              </p>
              <p>
                {t.birthdayToday}: <strong>{overview?.daily_birthday_sent ?? 0}</strong>
              </p>
              <p>
                {t.marketingToday}: <strong>{overview?.daily_marketing_sent ?? 0}</strong>
              </p>
              <p>
                {t.birthdayAllTime}: <strong>{overview?.birthday_sent_all_time ?? 0}</strong>
              </p>
              <p>
                {t.activeSubscribers}: <strong>{overview?.active_subscribers ?? 0}</strong>
              </p>
              <div className="col-span-2 space-y-2 pt-2">
                <p className="font-medium">{t.cronTitle}</p>
                <Button size="sm" variant="outline" onClick={runBirthday} disabled={pending}>
                  {pending ? t.runningBirthday : t.runBirthdayNow}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.testTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label>{t.testEmail}</Label>
              <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              <Label>{t.testKind}</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={testKind}
                onChange={(e) => setTestKind(e.target.value as PartnerPromoTestKind)}
              >
                <option value="birthday">{t.testBirthday}</option>
                <option value="cart_abandon">{t.testCart}</option>
                <option value="comeback">{t.testComeback}</option>
                <option value="newsletter_welcome">{t.testNewsletter}</option>
                <option value="broadcast">{t.testBroadcast}</option>
              </select>
              <Button size="sm" onClick={sendTest} disabled={pending}>
                {t.sendTest}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.logTitle}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {!overview?.recent_sent?.length ? (
                <p className="text-sm text-muted-foreground">{t.logEmpty}</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="py-1 pr-2">{t.logWhen}</th>
                      <th className="py-1 pr-2">{t.logKind}</th>
                      <th className="py-1 pr-2">{t.logTo}</th>
                      <th className="py-1 pr-2">{t.logStatus}</th>
                      <th className="py-1">{t.logSubject}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recent_sent.map((row) => (
                      <tr key={row.id} className="border-b border-border/60">
                        <td className="py-1 pr-2 whitespace-nowrap">
                          {row.sent_at ? new Date(row.sent_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-1 pr-2">{row.kind}</td>
                        <td className="py-1 pr-2">{row.recipient_email}</td>
                        <td className="py-1 pr-2">
                          {row.status === 'sent' ? t.statusSent : row.status === 'failed' ? t.statusFailed : t.statusSkipped}
                        </td>
                        <td className="py-1">{row.subject || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.subscribersTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  placeholder={t.searchPlaceholder}
                  value={q}
                  onChange={(e) => {
                    setPage(0)
                    setQ(e.target.value)
                  }}
                />
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={filter}
                  onChange={(e) => {
                    setPage(0)
                    setFilter(e.target.value as typeof filter)
                  }}
                >
                  <option value="all">{t.filterAll}</option>
                  <option value="active">{t.filterActive}</option>
                  <option value="inactive">{t.filterInactive}</option>
                </select>
                <Button size="sm" variant="outline" onClick={doExport} disabled={pending}>
                  {t.exportCsv}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="py-1 pr-2">{t.colEmail}</th>
                      <th className="py-1 pr-2">{t.colName}</th>
                      <th className="py-1 pr-2">{t.colSource}</th>
                      <th className="py-1 pr-2">{t.colStatus}</th>
                      <th className="py-1 pr-2">{t.colWhen}</th>
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {(subs?.items || []).map((row) => (
                      <tr key={row.id} className="border-b border-border/60">
                        <td className="py-1 pr-2">{row.email_normalized}</td>
                        <td className="py-1 pr-2">{row.subscriber_name || '—'}</td>
                        <td className="py-1 pr-2">{row.source}</td>
                        <td className="py-1 pr-2">{row.is_active ? t.active : t.inactive}</td>
                        <td className="py-1 pr-2 whitespace-nowrap">
                          {row.subscribed_at ? new Date(row.subscribed_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-1">
                          {row.is_active ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                startTransition(async () => {
                                  await deactivatePartnerNewsletterSubscriberAction({
                                    partnerId,
                                    email: row.email_normalized,
                                  })
                                  void loadSubs()
                                  void loadOverview()
                                })
                              }}
                            >
                              {t.unsubscribe}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  ‹
                </Button>
                <span>
                  {page + 1} / {pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.importTitle}</CardTitle>
              <CardDescription>{t.importHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={5}
                placeholder={t.importTextPlaceholder}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <Label>{t.importFile}</Label>
              <Input type="file" accept=".txt,.csv,.tsv" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
              <Button size="sm" onClick={doImport} disabled={pending}>
                {pending ? t.importing : t.importButton}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.composeTitle}</CardTitle>
              <CardDescription>{t.composeHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label>{t.subjectLabel}</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              <Label>{t.bodyLabel}</Label>
              <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
              <Button size="sm" onClick={doBroadcast} disabled={pending}>
                {pending ? t.broadcasting : t.sendBroadcast}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
