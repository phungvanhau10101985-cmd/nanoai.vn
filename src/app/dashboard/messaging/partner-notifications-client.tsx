'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { MessagingPartnerDashboardRow } from '@/lib/db/messaging-partners-pg'
import type { PartnerNotificationBroadcastRow } from '@/lib/db/messaging-partner-customer-notifications-pg'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  countPartnerNotificationAudienceAction,
  createPartnerNotificationComposeAction,
  downloadPartnerNotificationTemplateAction,
  importPartnerNotificationsAction,
  listPartnerNotificationBroadcastsAction,
} from '@/app/dashboard/messaging/notification-actions'
import { Bell, Download, Upload } from 'lucide-react'

type Props = {
  initialPartners: MessagingPartnerDashboardRow[]
  t: Dictionary['partnerMessagingNotifications']
  locale: string
  lockedPartnerId?: string
  hidePartnerPicker?: boolean
}

type ImportResult = {
  totalProcessed: number
  successCount: number
  errorCount: number
  emailSentCount: number
  errors: string[]
}

function defaultScheduleLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function PartnerNotificationsClient({
  initialPartners,
  t,
  locale,
  lockedPartnerId,
  hidePartnerPicker,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const partnerFromUrl = lockedPartnerId?.trim() || searchParams.get('partner')?.trim() || ''
  const [partnerId, setPartnerId] = useState(partnerFromUrl || initialPartners[0]?.id || '')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleLocal)
  const [sendEmail, setSendEmail] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [smtpConfigured, setSmtpConfigured] = useState(true)
  const [history, setHistory] = useState<PartnerNotificationBroadcastRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const selected = useMemo(
    () => initialPartners.find((p) => p.id === partnerId) ?? null,
    [initialPartners, partnerId]
  )

  const syncPartnerQuery = useCallback(
    (id: string) => {
      if (hidePartnerPicker) return
      const q = new URLSearchParams(searchParams.toString())
      if (id) q.set('partner', id)
      else q.delete('partner')
      router.replace(`/dashboard/messaging/notifications?${q.toString()}`, { scroll: false })
    },
    [hidePartnerPicker, router, searchParams]
  )

  useEffect(() => {
    const locked = lockedPartnerId?.trim() || ''
    if (locked && locked !== partnerId) setPartnerId(locked)
  }, [lockedPartnerId, partnerId])

  const reload = useCallback(async (id: string) => {
    if (!id) return
    const [audience, broadcasts] = await Promise.all([
      countPartnerNotificationAudienceAction(id),
      listPartnerNotificationBroadcastsAction(id),
    ])
    if ('count' in audience && typeof audience.count === 'number') {
      setAudienceCount(audience.count)
      setSmtpConfigured(audience.smtpConfigured !== false)
    }
    if ('rows' in broadcasts && Array.isArray(broadcasts.rows)) setHistory(broadcasts.rows)
  }, [])

  useEffect(() => {
    if (!partnerId) return
    void reload(partnerId)
  }, [partnerId, reload])

  function mapError(code: string | undefined): string {
    if (!code) return t.errorGeneric
    if (code === 'missing_file') return t.errorMissingFile
    if (code === 'invalid_file_format') return t.errorInvalidFile
    if (code === 'read_file_failed') return t.errorReadFile
    if (code === 'missing_columns') return t.errorMissingColumns
    if (code === 'empty_sheet') return t.errorEmptySheet
    if (code === 'no_recipients') return t.errorNoRecipients
    if (code === 'invalid_schedule') return t.errorInvalidSchedule
    if (code === 'smtp_not_configured' || code === 'DATABASE_URL is not set.') return t.errorGeneric
    return code
  }

  function handleCompose() {
    if (!partnerId) return
    setImportError(null)
    startTransition(async () => {
      const res = await createPartnerNotificationComposeAction({
        partnerId,
        title,
        body,
        scheduledAt: new Date(scheduledAt).toISOString(),
        sendEmail,
      })
      if ('error' in res) {
        toast({ variant: 'destructive', title: mapError(res.error) })
        return
      }
      setImportResult(res)
      setTitle('')
      setBody('')
      toast({ title: t.composeSuccess })
      void reload(partnerId)
    })
  }

  function handleImport() {
    if (!partnerId || !file) return
    setImportError(null)
    const form = new FormData()
    form.set('file', file)
    form.set('sendEmail', sendEmail ? '1' : '0')
    startTransition(async () => {
      const res = await importPartnerNotificationsAction(partnerId, form)
      if ('error' in res) {
        setImportError(mapError(res.error))
        return
      }
      setImportResult(res)
      toast({ title: t.importSuccess })
      void reload(partnerId)
    })
  }

  async function handleTemplate() {
    const res = await downloadPartnerNotificationTemplateAction()
    if ('error' in res) {
      toast({ variant: 'destructive', title: mapError(res.error) })
      return
    }
    const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (initialPartners.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.noWorkspace}</p>
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-4 w-4" aria-hidden />
            {t.composeTitle}
          </CardTitle>
          <CardDescription>{t.composeHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hidePartnerPicker ? null : (
          <div className="space-y-1.5">
            <Label htmlFor="notif-partner">{t.workspaceLabel}</Label>
            <select
              id="notif-partner"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={partnerId}
              onChange={(e) => {
                setPartnerId(e.target.value)
                syncPartnerQuery(e.target.value)
              }}
            >
              {initialPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name || p.slug}
                </option>
              ))}
            </select>
          </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="notif-title">{t.titleLabel}</Label>
            <Input id="notif-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notif-body">{t.bodyLabel}</Label>
            <Textarea id="notif-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notif-time">{t.scheduleLabel}</Label>
            <Input
              id="notif-time"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t.expireHint}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            {t.sendEmailLabel}
          </label>
          <p className="text-xs text-muted-foreground">{t.pushHint}</p>
          {!smtpConfigured ? <p className="text-xs text-amber-700">{t.smtpMissing}</p> : null}
          <p className="text-sm text-muted-foreground">
            {t.audienceCount.replace('{count}', String(audienceCount ?? '…'))}
          </p>
          <Button type="button" disabled={pending || !title.trim() || !body.trim()} onClick={handleCompose}>
            {pending ? t.sending : t.sendButton}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.importTitle}</CardTitle>
          <CardDescription>{t.importHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc space-y-1 rounded-md bg-muted/50 p-3 pl-6 text-sm text-muted-foreground">
            <li>{t.colPhone}</li>
            <li>{t.colTitle}</li>
            <li>{t.colContent}</li>
            <li>{t.colTime}</li>
            <li>{t.colEmailOptional}</li>
          </ul>
          <p className="text-xs italic text-muted-foreground">{t.expireHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setImportResult(null)
                setImportError(null)
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void handleTemplate()}>
              <Download className="mr-1 h-4 w-4" aria-hidden />
              {t.downloadTemplate}
            </Button>
          </div>
          <Button type="button" disabled={!file || pending || !partnerId} onClick={handleImport}>
            <Upload className="mr-1 h-4 w-4" aria-hidden />
            {pending ? t.importing : t.importButton}
          </Button>
          {importError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{importError}</div>
          ) : null}
          {importResult ? (
            <div className="space-y-3 border-t pt-3">
              <h3 className="font-semibold">{t.resultTitle}</h3>
              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded bg-muted p-2">
                  <div className="text-xs text-muted-foreground">{t.resultTotal}</div>
                  <div className="font-bold">{importResult.totalProcessed}</div>
                </div>
                <div className="rounded bg-green-50 p-2">
                  <div className="text-xs text-green-700">{t.resultSuccess}</div>
                  <div className="font-bold text-green-800">{importResult.successCount}</div>
                </div>
                <div className="rounded bg-red-50 p-2">
                  <div className="text-xs text-red-700">{t.resultError}</div>
                  <div className="font-bold text-red-800">{importResult.errorCount}</div>
                </div>
                <div className="rounded bg-blue-50 p-2">
                  <div className="text-xs text-blue-700">{t.resultEmail}</div>
                  <div className="font-bold text-blue-800">{importResult.emailSentCount}</div>
                </div>
              </div>
              {importResult.errors.length > 0 ? (
                <ul className="max-h-56 list-disc space-y-1 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-3 pl-6 text-sm text-red-700">
                  {importResult.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">{t.historyTitle}</CardTitle>
          <CardDescription>
            {selected ? selected.display_name || selected.slug : t.workspaceLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.historyEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">{t.colTitle}</th>
                    <th className="py-2 pr-3">{t.historyWhen}</th>
                    <th className="py-2 pr-3">{t.resultSuccess}</th>
                    <th className="py-2 pr-3">{t.resultEmail}</th>
                    <th className="py-2">{t.historySource}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{row.title}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {row.scheduledAt ? new Date(row.scheduledAt).toLocaleString(locale) : ''}
                      </td>
                      <td className="py-2 pr-3">
                        {row.successCount}/{row.totalProcessed}
                      </td>
                      <td className="py-2 pr-3">{row.emailSentCount}</td>
                      <td className="py-2">{row.source === 'import' ? t.sourceImport : t.sourceCompose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
