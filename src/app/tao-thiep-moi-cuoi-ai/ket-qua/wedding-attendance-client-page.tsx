'use client'

import { useCallback, useState } from 'react'
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

function SideLine({ label, bucket }: { label: string; bucket: WeddingAttendanceBucket }) {
  return (
    <p className="text-sm">
      <span className="font-medium">{label}:</span> {bucket.guestsAttending} khách đi · {bucket.peopleAttending} người ·{' '}
      {bucket.peopleDeclined} người không đi
      {bucket.guestsPending > 0 ? ` · ${bucket.guestsPending} chưa phản hồi` : ''}
    </p>
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

  const backToEditor = useCallback(() => {
    router.push(`/tao-thiep-moi-cuoi-ai?cardId=${encodeURIComponent(cardId)}`)
  }, [cardId, router])
  useSetCreationToolBackHandler(backToEditor)

  async function save() {
    setSaving(true)
    const form = new FormData()
    form.set('cardId', cardId)
    form.set('groomEmail', groom)
    form.set('brideEmail', coupleShape ? bride : '')
    form.set('notify', sendNotify ? 'true' : 'false')
    const result = await saveWeddingAttendanceNotifySettings(form)
    setSaving(false)
    if ('error' in result && result.error) {
      toast({ title: 'Chưa lưu', description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Đã lưu cách nhận email' })
  }

  const total = summary.total

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

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Khách đi"
            value={total.guestsAttending}
            hint="Số khách đã xác nhận có đi"
            tone="border-emerald-200 bg-emerald-50"
          />
          <StatCard
            label="Người đi"
            value={total.peopleAttending}
            hint="Cộng người lớn và trẻ em"
            tone="border-emerald-200 bg-white"
          />
          <StatCard
            label="Người không đi"
            value={total.peopleDeclined}
            hint={`${total.guestsDeclined} khách báo không đi`}
            tone="border-rose-200 bg-rose-50"
          />
        </div>

        <div className="space-y-1 rounded-2xl border bg-muted/30 px-4 py-3">
          <SideLine label={primaryLabel} bucket={summary.groom} />
          {coupleShape ? <SideLine label={secondaryLabel} bucket={summary.bride} /> : null}
          {summary.outside.guestsAttending > 0 || summary.outside.guestsDeclined > 0 ? (
            <SideLine label="Ngoài danh sách mời" bucket={summary.outside} />
          ) : null}
          <p className="text-sm text-muted-foreground">Chưa phản hồi: {total.guestsPending} khách.</p>
        </div>

        <section className="space-y-4 rounded-2xl border p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-rose-800" />
            <div>
              <h2 className="text-lg font-semibold">Email cho cô dâu và chú rể</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Thư ghi số khách đi, số người đi và số người không đi. Mỗi ngày chỉ một thư, và chỉ khi số người đi đã tăng.
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
                Nhiều khách xác nhận trong cùng ngày vẫn gộp một thư. Ngày không có người tăng thì không gửi. Lưu cài đặt không gửi lại số hiện tại.
              </span>
            </label>
          </div>

          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Lưu cài đặt email
          </Button>
        </section>
      </div>
    </>
  )
}
