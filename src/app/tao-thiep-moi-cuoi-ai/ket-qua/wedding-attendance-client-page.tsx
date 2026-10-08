'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Mail } from 'lucide-react'
import { useSetCreationToolBackHandler } from '@/components/navigation/creation-tool-shell-back'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { WeddingAttendanceBucket, WeddingAttendanceSummary } from '@/lib/wedding/wedding-attendance-summary'
import { saveWeddingAttendanceNotifySettings } from './actions'

type Props = {
  cardId: string
  couple: string
  coupleShape: boolean
  primaryLabel: string
  secondaryLabel: string
  primaryRole: string
  secondaryRole: string
  summary: WeddingAttendanceSummary
  groomEmail: string
  brideEmail: string
  notify: boolean
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint: string
  tone: string
}) {
  return (
    <div className={cn('rounded-2xl border px-4 py-4', tone)}>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-4xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

function sideHasOutside(bucket: WeddingAttendanceBucket) {
  return (
    bucket.guestsAttending > 0 ||
    bucket.peopleAttending > 0 ||
    bucket.guestsDeclined > 0 ||
    bucket.peopleDeclined > 0 ||
    bucket.guestsPending > 0
  )
}

function SideStats({ label, bucket }: { label: string; bucket: WeddingAttendanceBucket }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{label}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Khách đi"
          value={bucket.guestsAttending}
          hint="Số khách đã xác nhận có đi"
          tone="border-emerald-200 bg-emerald-50"
        />
        <StatCard
          label="Người đi"
          value={bucket.peopleAttending}
          hint="Cộng người lớn và trẻ em"
          tone="border-emerald-200 bg-white"
        />
        <StatCard
          label="Người không đi"
          value={bucket.peopleDeclined}
          hint={`${bucket.guestsDeclined} khách báo không đi`}
          tone="border-rose-200 bg-rose-50"
        />
      </div>
      {bucket.guestsPending > 0 ? (
        <p className="text-sm text-muted-foreground">Chưa phản hồi: {bucket.guestsPending} khách.</p>
      ) : null}
    </section>
  )
}

export default function WeddingAttendanceClientPage({
  cardId,
  couple,
  coupleShape,
  primaryLabel,
  secondaryLabel,
  primaryRole,
  secondaryRole,
  summary,
  groomEmail,
  brideEmail,
  notify,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [groom, setGroom] = useState(groomEmail)
  const [bride, setBride] = useState(brideEmail)
  const [sendNotify, setSendNotify] = useState(notify)
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState('')
  const savedSnapshotRef = useRef(`${groomEmail}\n${brideEmail}\n${notify ? '1' : '0'}`)
  const saveTimerRef = useRef<number | null>(null)

  const backToEditor = useCallback(() => {
    router.push(`/tao-thiep-moi-cuoi-ai?cardId=${encodeURIComponent(cardId)}`)
  }, [cardId, router])
  useSetCreationToolBackHandler(backToEditor)

  const persistNotify = useCallback(async (next: { groom: string; bride: string; notify: boolean }) => {
    const snap = `${next.groom.trim()}\n${next.bride.trim()}\n${next.notify ? '1' : '0'}`
    if (savedSnapshotRef.current === snap) return
    setSaving(true)
    const form = new FormData()
    form.set('cardId', cardId)
    form.set('groomEmail', next.groom.trim())
    form.set('brideEmail', coupleShape ? next.bride.trim() : '')
    form.set('notify', next.notify ? 'true' : 'false')
    const result = await saveWeddingAttendanceNotifySettings(form)
    setSaving(false)
    if ('error' in result && result.error) {
      setSavedNote('')
      toast({ title: 'Chưa lưu', description: result.error, variant: 'destructive' })
      return
    }
    savedSnapshotRef.current = snap
    setSavedNote('Đã lưu tự động')
  }, [cardId, coupleShape, toast])

  useEffect(() => {
    const groomTrim = groom.trim()
    const brideTrim = coupleShape ? bride.trim() : ''
    const emailOk = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)
    if (!emailOk(groomTrim) || !emailOk(brideTrim)) return
    if (sendNotify && !groomTrim && !brideTrim) return
    const snap = `${groomTrim}\n${brideTrim}\n${sendNotify ? '1' : '0'}`
    if (savedSnapshotRef.current === snap) return
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void persistNotify({ groom: groomTrim, bride: brideTrim, notify: sendNotify })
    }, 800)
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [bride, coupleShape, groom, persistNotify, sendNotify])

  const draftRef = useRef({ groom, bride, notify: sendNotify })
  draftRef.current = { groom, bride, notify: sendNotify }
  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const next = draftRef.current
      const groomTrim = next.groom.trim()
      const brideTrim = coupleShape ? next.bride.trim() : ''
      const emailOk = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)
      if (!emailOk(groomTrim) || !emailOk(brideTrim)) return
      if (next.notify && !groomTrim && !brideTrim) return
      void persistNotify({ groom: groomTrim, bride: brideTrim, notify: next.notify })
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [coupleShape, persistNotify])

  return (
    <>
      <Toaster />
      <div className="space-y-4 pb-2 sm:pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-800">Kết quả tham dự</p>
            <h1 className="mt-1 text-2xl font-semibold">{couple}</h1>
          </div>
          <Button asChild variant="outline">
            <Link href={`/tao-thiep-moi-cuoi-ai/khach-moi?cardId=${encodeURIComponent(cardId)}`}>Danh sách khách</Link>
          </Button>
        </div>

        <div className="space-y-6">
          <SideStats label={primaryLabel} bucket={summary.groom} />
          {coupleShape ? <SideStats label={secondaryLabel} bucket={summary.bride} /> : null}
          {sideHasOutside(summary.outside) ? <SideStats label="Ngoài danh sách mời" bucket={summary.outside} /> : null}
        </div>

        <section className="space-y-4 rounded-2xl border p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-rose-800" />
            <div>
              <h2 className="text-lg font-semibold">Email cho cô dâu và chú rể</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Thư ghi riêng số khách đi, số người đi và số người không đi của từng nhà. Mỗi ngày chỉ một thư, và chỉ khi số người đi đã tăng.
              </p>
            </div>
          </div>

          <div className={cn('grid gap-3', coupleShape && 'sm:grid-cols-2')}>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Email {primaryRole.toLowerCase()}</span>
              <Input
                type="email"
                autoComplete="email"
                value={groom}
                placeholder="email@example.com"
                onChange={(event) => setGroom(event.target.value)}
              />
            </label>
            {coupleShape ? (
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Email {secondaryRole.toLowerCase()}</span>
                <Input
                  type="email"
                  autoComplete="email"
                  value={bride}
                  placeholder="email@example.com"
                  onChange={(event) => setBride(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          <div className="flex items-start gap-3 text-sm">
            <Checkbox
              id="rsvp-notify-daily-increase"
              checked={sendNotify}
              onCheckedChange={(value) => setSendNotify(value === true)}
              className="mt-0.5"
            />
            <label htmlFor="rsvp-notify-daily-increase">
              <span className="font-medium">Gửi khi số người đi tăng — mỗi ngày một thư</span>
              <span className="mt-0.5 block text-muted-foreground">
                Nhiều khách xác nhận trong cùng ngày vẫn gộp một thư. Ngày không có người tăng thì không gửi. Đổi email hoặc bật gửi thì tự lưu, không gửi lại số hiện tại.
              </span>
            </label>
          </div>

          {saving || savedNote ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {saving ? 'Đang lưu…' : savedNote}
            </p>
          ) : null}
        </section>
      </div>
    </>
  )
}
