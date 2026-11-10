'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import { TUTORING_PACKAGE_PLANS, type TutoringPackagePlanId } from '@/lib/lop/tutoring-package'

const COPY: Record<
  WebLocale,
  {
    title: string
    lead: string
    slots: string
    grace: string
    active: string
    buy: string
    buying: string
    insufficient: string
    tooSmall: string
    success: string
    plans: Record<TutoringPackagePlanId, string>
  }
> = {
  vi: {
    title: 'Gói lớp học thêm',
    lead: 'Tính theo số lớp và thời hạn. 1 lớp 1 tháng là 60.000₫ (10 credit). Học phí học sinh vẫn về tài khoản cô.',
    slots: 'Số lớp',
    grace: 'Gói đã hết hạn. Còn {days} ngày trước khi lớp giải tán. Trong thời gian này chỉ xem được danh sách lớp.',
    active: 'Đang dùng {slots} lớp, đến {date}.',
    buy: 'Mua',
    buying: 'Đang trừ credit…',
    insufficient: 'Không đủ credit. Gói này cần {credits} credit ({price}₫).',
    tooSmall: 'Số lớp mua phải đủ chỗ cho các lớp đang có.',
    success: 'Đã mở gói đến {date}.',
    plans: { month: '1 tháng', quarter: '3 tháng', year: '1 năm' },
  },
  en: {
    title: 'Tutoring plan',
    lead: 'Priced by class count and length. One class for one month is 60,000₫ (10 credits). Student tuition still goes to the teacher.',
    slots: 'Classes',
    grace: 'The plan has ended. {days} day(s) remain before classes dissolve. Until then you can only view the class list.',
    active: 'Using {slots} classes until {date}.',
    buy: 'Buy',
    buying: 'Charging credits…',
    insufficient: 'Not enough credits. This plan needs {credits} credits ({price}₫).',
    tooSmall: 'Buy enough class slots for the classes you already have.',
    success: 'Plan is active until {date}.',
    plans: { month: '1 month', quarter: '3 months', year: '1 year' },
  },
  zh: {
    title: '补习班套餐',
    lead: '按班级数量和时长计费。1 个班 1 个月为 60,000₫（10 积分）。学生学费仍转入老师账户。',
    slots: '班级数',
    grace: '套餐已到期。班级将在 {days} 天后解散。在此之前只能查看班级列表。',
    active: '正在使用 {slots} 个班级，至 {date}。',
    buy: '购买',
    buying: '正在扣除积分…',
    insufficient: '积分不足。此套餐需要 {credits} 积分（{price}₫）。',
    tooSmall: '购买的班级数必须覆盖现有班级。',
    success: '套餐有效期至 {date}。',
    plans: { month: '1 个月', quarter: '3 个月', year: '1 年' },
  },
  ja: {
    title: '補習プラン',
    lead: 'クラス数と期間で計算します。1クラス1か月は 60,000₫（10クレジット）です。生徒の月謝は先生の口座に入ります。',
    slots: 'クラス数',
    grace: 'プランは期限切れです。解散まであと {days} 日です。それまではクラス一覧だけ見られます。',
    active: '{slots} クラスを {date} まで利用中。',
    buy: '購入',
    buying: 'クレジットを引き落とし中…',
    insufficient: 'クレジットが足りません。このプランは {credits} クレジット（{price}₫）です。',
    tooSmall: '今あるクラスを含められる数を購入してください。',
    success: '{date} まで有効になりました。',
    plans: { month: '1か月', quarter: '3か月', year: '1年' },
  },
  ko: {
    title: '과외 요금제',
    lead: '수업 수와 기간으로 계산합니다. 수업 1개, 1개월은 60,000₫(10크레딧)입니다. 학생 수강료는 선생님 계좌로 갑니다.',
    slots: '수업 수',
    grace: '요금제가 끝났습니다. 수업 해체까지 {days}일 남았습니다. 그동안은 수업 목록만 볼 수 있습니다.',
    active: '수업 {slots}개를 {date}까지 사용 중.',
    buy: '구매',
    buying: '크레딧 차감 중…',
    insufficient: '크레딧이 부족합니다. 이 요금제는 {credits}크레딧({price}₫)입니다.',
    tooSmall: '가진 수업을 담을 수 있는 수로 구매하세요.',
    success: '{date}까지 열렸습니다.',
    plans: { month: '1개월', quarter: '3개월', year: '1년' },
  },
}

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template)
}

export function TutoringPackageCard({ webLocale }: { webLocale: WebLocale }) {
  const copy = COPY[webLocale]
  const [slots, setSlots] = useState('1')
  const [phase, setPhase] = useState<string>('none')
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const [ownedSlots, setOwnedSlots] = useState(0)
  const [accessEndsAt, setAccessEndsAt] = useState<string | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    void fetch('/api/account/tutoring-package', { credentials: 'include' })
      .then((res) => res.json())
      .then((json: { phase?: string; daysLeft?: number | null; slots?: number; accessEndsAt?: string | null }) => {
        setPhase(String(json.phase ?? 'none'))
        setDaysLeft(typeof json.daysLeft === 'number' ? json.daysLeft : null)
        setOwnedSlots(Number(json.slots) || 0)
        setAccessEndsAt(typeof json.accessEndsAt === 'string' ? json.accessEndsAt : null)
      })
      .catch(() => undefined)
  }, [buying])

  async function buy(planId: TutoringPackagePlanId) {
    setBuying(planId)
    setNote('')
    try {
      const res = await fetch('/api/account/tutoring-package', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, slots: Number(slots) }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        credits?: number
        priceVnd?: number
        accessEndsAt?: string
      }
      if (json.error === 'insufficient_credits' || res.status === 402) {
        setNote(fill(copy.insufficient, { credits: String(json.credits ?? ''), price: String(json.priceVnd ?? '') }))
        return
      }
      if (json.error === 'slots_below_classes') {
        setNote(copy.tooSmall)
        return
      }
      if (!res.ok) {
        setNote(json.error || copy.tooSmall)
        return
      }
      const date = json.accessEndsAt ? new Date(json.accessEndsAt).toLocaleDateString(webLocale) : ''
      setNote(fill(copy.success, { date }))
    } finally {
      setBuying(null)
    }
  }

  const slotCount = Math.max(1, Number(slots) || 1)
  const until = accessEndsAt ? new Date(accessEndsAt).toLocaleDateString(webLocale) : ''

  return (
    <Card id="goi-lop-hoc-them">
      <CardHeader>
        <CardTitle className="text-lg">{copy.title}</CardTitle>
        <CardDescription className="text-left">{copy.lead}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === 'grace' && daysLeft != null ? <p className="text-sm text-foreground">{fill(copy.grace, { days: String(daysLeft) })}</p> : null}
        {phase === 'active' && until ? (
          <p className="text-sm text-foreground">{fill(copy.active, { slots: String(ownedSlots), date: until })}</p>
        ) : null}
        <label className="block text-sm font-medium text-foreground">
          {copy.slots}
          <Input
            className="mt-1 w-24"
            inputMode="numeric"
            value={slots}
            onChange={(event) => setSlots(event.target.value)}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          {TUTORING_PACKAGE_PLANS.map((plan) => (
            <Button key={plan.id} type="button" variant={plan.id === 'year' ? 'default' : 'outline'} disabled={buying != null} onClick={() => void buy(plan.id)}>
              <span className="flex flex-col items-start gap-0.5">
                <span>{buying === plan.id ? copy.buying : `${copy.buy} · ${copy.plans[plan.id]}`}</span>
                <span className="text-xs font-normal opacity-80">
                  {(plan.priceVndPerClass * slotCount).toLocaleString(webLocale)}₫ · {plan.creditsPerClass * slotCount} credit
                </span>
              </span>
            </Button>
          ))}
        </div>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </CardContent>
    </Card>
  )
}
