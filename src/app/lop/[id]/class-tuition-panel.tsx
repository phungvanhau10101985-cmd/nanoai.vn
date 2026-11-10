'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { formatVnDateTime, parseBillingDay, parseDueDays, parseTuitionAmount, readTutoringTuitionFields, type ClassTuitionPeriodView, type ClassTuitionView } from '@/lib/lop/class-tuition'
import { setClassTuitionPayment, updateClassTuitionSettings } from '@/app/lop/actions'
import { TutoringTuitionFields, type TutoringTuitionFieldValues } from '@/app/lop/tutoring-tuition-fields'

function periodStatusText(t: Dictionary['classes'], period: ClassTuitionPeriodView, fallbackDate: string): string {
  if (period.status === 'confirmed') return t.tutoringPayConfirmed.replaceAll('{month}', period.label)
  if (period.status === 'unpaid') return t.tutoringPayUnpaid.replaceAll('{month}', period.label)
  return t.tutoringPayNotDue.replaceAll('{date}', period.dueOnLabel || fallbackDate)
}

function accountLine(t: Dictionary['classes'], view: ClassTuitionView): string {
  return t.tutoringAccountLine
    .replaceAll('{bank}', view.bankName)
    .replaceAll('{account}', view.accountNo)
    .replaceAll('{name}', view.accountName)
}

function StudentPayCard({
  view,
  student,
  t,
}: {
  view: ClassTuitionView
  student: ClassTuitionView['students'][number]
  t: Dictionary['classes']
}) {
  const { toast } = useToast()
  const payAmount = student.payAmountLabel ?? view.amountLabel
  return (
    <section className="mb-6 rounded-xl border border-input bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold text-foreground">{t.tutoringPayTitle}</h2>
      {student.locked ? <p className="mt-2 text-sm font-medium text-foreground">{t.tutoringLockedLead}</p> : null}
      <p className="mt-1 text-sm text-foreground">{t.tutoringPayAmount.replaceAll('{amount}', payAmount)}</p>
      {student.payKind === 'partial' && student.payBillableDays != null && student.payMonthDays != null ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {t.tutoringFirstShare
            .replaceAll('{days}', String(student.payBillableDays))
            .replaceAll('{total}', String(student.payMonthDays))
            .replaceAll('{monthly}', view.amountLabel)
            .replaceAll('{amount}', payAmount)}
        </p>
      ) : null}
      <p className="mt-1 text-sm text-muted-foreground">{accountLine(t, view)}</p>
      <p className="mt-3 text-sm text-muted-foreground">{t.tutoringPayBy.replaceAll('{date}', student.dueOnLabel)}</p>
      {student.periods.map((period) => (
        <p key={period.period} className="mt-1 text-sm text-foreground">
          {period.amountLabel}
          {' · '}
          {periodStatusText(t, period, student.dueOnLabel)}
          {period.confirmedAt ? (
            <span className="text-muted-foreground"> · {formatVnDateTime(period.confirmedAt)}</span>
          ) : null}
        </p>
      ))}
      {student.qrImageUrl && student.payPeriodLabel ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-foreground">
            {t.tutoringPayForMonth
              .replaceAll('{month}', student.payPeriodLabel)
              .replaceAll('{amount}', payAmount)}
          </p>
          {student.unpaidCount > 1 ? <p className="text-sm text-muted-foreground">{t.tutoringCatchUp}</p> : null}
          <div>
            <p className="text-sm font-medium text-foreground">{t.tutoringPayContentLabel}</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm">{student.transferContent}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(student.transferContent)
                  toast({ description: t.copied })
                }}
              >
                {t.copyCode}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.tutoringPayContentHint}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={student.qrImageUrl}
            alt={t.tutoringQrAlt}
            className="h-auto w-full max-w-[240px] rounded-lg border border-border bg-white p-2"
          />
          <p className="text-sm text-muted-foreground">{t.tutoringPayWaiting}</p>
        </div>
      ) : null}
    </section>
  )
}

export function ClassTuitionPanel({
  classId,
  view,
  isOwner,
  pageMode,
  t,
}: {
  classId: string
  view: ClassTuitionView
  isOwner: boolean
  pageMode: 'hub' | 'roster'
  t: Dictionary['classes']
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [fields, setFields] = useState<TutoringTuitionFieldValues>({
    amount: String(view.monthlyVnd),
    days: String(view.dueAfterDays),
    billingDay: String(view.billingDay),
    bankBin: view.bankBin,
    bankName: view.bankName,
    accountNo: view.accountNo,
    accountName: view.accountName,
  })
  const [saving, setSaving] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  useEffect(() => {
    setFields({
      amount: String(view.monthlyVnd),
      days: String(view.dueAfterDays),
      billingDay: String(view.billingDay),
      bankBin: view.bankBin,
      bankName: view.bankName,
      accountNo: view.accountNo,
      accountName: view.accountName,
    })
  }, [view.monthlyVnd, view.dueAfterDays, view.billingDay, view.bankBin, view.bankName, view.accountNo, view.accountName])

  if (!isOwner) {
    const student = view.students[0]
    if (!student || (pageMode !== 'hub' && pageMode !== 'roster')) return null
    return <StudentPayCard view={view} student={student} t={t} />
  }

  if (pageMode === 'hub') {
    const unpaid = view.students.filter((student) => student.unpaidCount > 0).length
    const due = view.students.filter((student) => student.due).length
    const summary =
      view.students.length === 0
        ? t.tutoringNoStudents
        : unpaid > 0
          ? t.tutoringHubUnpaid.replaceAll('{count}', String(unpaid))
          : due === 0
            ? t.tutoringHubNoneDue
            : t.tutoringHubAllPaid
    return (
      <section className="mb-6 rounded-xl border border-input bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-foreground">{t.tutoringSectionTitle}</h2>
        <p className="mt-1 text-sm text-foreground">{t.tutoringPayAmount.replaceAll('{amount}', view.amountLabel)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.tutoringBillingDayLine.replaceAll('{day}', String(view.billingDay))}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{accountLine(t, view)}</p>
        <p className="mt-2 text-sm text-foreground">{summary}</p>
        <Button asChild className="mt-3" variant="outline" size="sm">
          <Link href={`/lop/${classId}/hoc-sinh`}>{t.tutoringHubOpenRoster}</Link>
        </Button>
      </section>
    )
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    const tuition = readTutoringTuitionFields(fields)
    if (parseTuitionAmount(fields.amount) == null) {
      toast({ variant: 'destructive', description: t.tutoringAmountInvalid })
      return
    }
    if (parseDueDays(fields.days) == null) {
      toast({ variant: 'destructive', description: t.tutoringDaysInvalid })
      return
    }
    if (parseBillingDay(fields.billingDay) == null) {
      toast({ variant: 'destructive', description: t.tutoringBillingDayInvalid })
      return
    }
    if (!tuition) {
      toast({ variant: 'destructive', description: t.tutoringBankInvalid })
      return
    }
    setSaving(true)
    const res = await updateClassTuitionSettings({ classId, ...tuition })
    setSaving(false)
    if (res.error) {
      toast({ variant: 'destructive', description: res.error })
      return
    }
    toast({ description: t.tutoringSettingsSaved })
    router.refresh()
  }

  async function confirm(memberUserId: string, period: string, confirmed: boolean) {
    const key = `${memberUserId}:${period}`
    setPendingKey(key)
    const res = await setClassTuitionPayment({ classId, memberUserId, period, confirmed })
    setPendingKey(null)
    if (res.error) {
      toast({ variant: 'destructive', description: res.error })
      return
    }
    router.refresh()
  }

  return (
    <section className="mb-6 space-y-4">
      <form onSubmit={saveSettings} className="rounded-xl border border-input bg-card p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">{t.tutoringSettingsTitle}</h2>
        <TutoringTuitionFields
          idPrefix={`tuition-${classId}`}
          values={fields}
          onChange={setFields}
          disabled={saving}
          t={t}
        />
        <Button type="submit" className="mt-4" disabled={saving}>
          {saving ? '...' : t.tutoringSettingsSave}
        </Button>
      </form>

      <div className="rounded-xl border border-input bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-foreground">{t.tutoringSectionTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.tutoringPayContentHint}</p>
        {view.students.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t.tutoringNoStudents}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {view.students.map((student) => (
              <li key={student.userId} className="py-3">
                <p className="font-medium text-foreground">{student.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t.tutoringDueFrom.replaceAll('{date}', student.dueOnLabel)}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {t.tutoringPayContentLabel}: <span className="font-medium">{student.transferContent}</span>
                </p>
                {!student.due ? <p className="mt-1 text-xs text-muted-foreground">{t.tutoringEarlyNote}</p> : null}
                <ul className="mt-2 space-y-2">
                  {student.periods.map((period) => {
                    const key = `${student.userId}:${period.period}`
                    return (
                      <li key={period.period} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-foreground">
                          {period.amountLabel}
                          {' · '}
                          {periodStatusText(t, period, student.dueOnLabel)}
                          {period.confirmedAt ? (
                            <span className="text-muted-foreground"> · {formatVnDateTime(period.confirmedAt)}</span>
                          ) : null}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant={period.status === 'confirmed' ? 'outline' : 'default'}
                          disabled={pendingKey === key}
                          onClick={() => void confirm(student.userId, period.period, period.status !== 'confirmed')}
                        >
                          {period.status === 'confirmed' ? t.tutoringUnconfirmButton : t.tutoringConfirmButton}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
