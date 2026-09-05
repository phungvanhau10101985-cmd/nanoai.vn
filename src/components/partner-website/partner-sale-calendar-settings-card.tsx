'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSaleCalendarConfig } from '@/lib/db/messaging-partner-sale-calendar-pg'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    enabled: string
    timezone: string
    teaser: string
    odd: string
    even: string
    clearance: string
    clearancePercent: string
    manualDate: string
    manualPercent: string
    save: string
    saved: string
    error: string
  }
> = {
  vi: {
    title: 'Sale cùng ngày cùng tháng',
    hint: 'Tự giảm vào ngày trùng số tháng; tháng lẻ 6%, tháng chẵn 8%.',
    enabled: 'Bật lịch sale',
    timezone: 'Múi giờ',
    teaser: 'Số ngày báo trước',
    odd: 'Giảm tháng lẻ (%)',
    even: 'Giảm tháng chẵn (%)',
    clearance: 'Bật kho sale',
    clearancePercent: 'Giảm kho sale (%)',
    manualDate: 'Sale thủ công trong ngày',
    manualPercent: 'Mức giảm thủ công (%)',
    save: 'Lưu chương trình sale',
    saved: 'Đã lưu chương trình sale.',
    error: 'Không lưu được chương trình sale.',
  },
  en: {
    title: 'Same-day same-month sale',
    hint: 'Automatically discounts on the day matching the month number.',
    enabled: 'Enable sale calendar',
    timezone: 'Time zone',
    teaser: 'Teaser days',
    odd: 'Odd-month discount (%)',
    even: 'Even-month discount (%)',
    clearance: 'Enable clearance',
    clearancePercent: 'Clearance discount (%)',
    manualDate: 'Manual sale date',
    manualPercent: 'Manual discount (%)',
    save: 'Save sale program',
    saved: 'Sale program saved.',
    error: 'Could not save the sale program.',
  },
  zh: {
    title: '同日同月促销',
    hint: '在与月份数字相同的日期自动打折。',
    enabled: '启用促销日历',
    timezone: '时区',
    teaser: '预告天数',
    odd: '奇数月折扣 (%)',
    even: '偶数月折扣 (%)',
    clearance: '启用清仓',
    clearancePercent: '清仓折扣 (%)',
    manualDate: '手动促销日期',
    manualPercent: '手动折扣 (%)',
    save: '保存促销计划',
    saved: '促销计划已保存。',
    error: '无法保存促销计划。',
  },
  ja: {
    title: '同日同月セール',
    hint: '月番号と同じ日に自動で割引します。',
    enabled: 'セールカレンダーを有効化',
    timezone: 'タイムゾーン',
    teaser: '予告日数',
    odd: '奇数月割引 (%)',
    even: '偶数月割引 (%)',
    clearance: 'クリアランスを有効化',
    clearancePercent: 'クリアランス割引 (%)',
    manualDate: '手動セール日',
    manualPercent: '手動割引 (%)',
    save: 'セールを保存',
    saved: 'セールを保存しました。',
    error: 'セールを保存できませんでした。',
  },
  ko: {
    title: '같은 날짜·월 세일',
    hint: '월 숫자와 같은 날짜에 자동 할인합니다.',
    enabled: '세일 캘린더 사용',
    timezone: '시간대',
    teaser: '사전 안내 일수',
    odd: '홀수 달 할인 (%)',
    even: '짝수 달 할인 (%)',
    clearance: '창고 세일 사용',
    clearancePercent: '창고 세일 할인 (%)',
    manualDate: '수동 세일 날짜',
    manualPercent: '수동 할인 (%)',
    save: '세일 프로그램 저장',
    saved: '세일 프로그램을 저장했습니다.',
    error: '세일 프로그램을 저장하지 못했습니다.',
  },
}

type Props = {
  partnerId: string
  locale: WebLocale
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}

export function PartnerSaleCalendarSettingsCard({ partnerId, locale, onToast }: Props) {
  const t = COPY[locale] ?? COPY.en
  const api = useMemo(
    () => `/api/messaging/partners/${encodeURIComponent(partnerId)}/sale-calendar`,
    [partnerId]
  )
  const [config, setConfig] = useState<PartnerSaleCalendarConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(api)
      const body = (await response.json().catch(() => null)) as {
        config?: PartnerSaleCalendarConfig
      } | null
      setConfig(body?.config ?? null)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!config || saving) return
    setSaving(true)
    try {
      const response = await fetch(api, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      onToast?.(response.ok ? t.saved : t.error, response.ok ? 'default' : 'destructive')
      if (response.ok) await load()
    } finally {
      setSaving(false)
    }
  }

  const numberField = (
    key:
      | 'teaserDays'
      | 'oddMonthDiscountPercent'
      | 'evenMonthDiscountPercent'
      | 'clearanceDiscountPercent'
      | 'manualDiscountPercent',
    label: string,
    nullable = false
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`sale-${key}`}>{label}</Label>
      <Input
        id={`sale-${key}`}
        type="number"
        min={0}
        max={key === 'teaserDays' ? 14 : 100}
        value={config?.[key] ?? ''}
        onChange={(event) =>
          setConfig((current) =>
            current
              ? {
                  ...current,
                  [key]:
                    nullable && event.target.value === ''
                      ? null
                      : Math.max(0, Number(event.target.value) || 0),
                }
              : current
          )
        }
      />
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !config ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="sale-enabled">{t.enabled}</Label>
              <Switch
                id="sale-enabled"
                checked={config.enabled}
                onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="sale-timezone">{t.timezone}</Label>
                <Input
                  id="sale-timezone"
                  value={config.timezone}
                  onChange={(event) => setConfig({ ...config, timezone: event.target.value })}
                />
              </div>
              {numberField('teaserDays', t.teaser)}
              {numberField('oddMonthDiscountPercent', t.odd)}
              {numberField('evenMonthDiscountPercent', t.even)}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="sale-clearance">{t.clearance}</Label>
              <Switch
                id="sale-clearance"
                checked={config.clearanceEnabled}
                onCheckedChange={(clearanceEnabled) =>
                  setConfig({ ...config, clearanceEnabled })
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {numberField('clearanceDiscountPercent', t.clearancePercent)}
              <div className="space-y-1.5">
                <Label htmlFor="sale-manual-date">{t.manualDate}</Label>
                <Input
                  id="sale-manual-date"
                  type="date"
                  value={config.manualSaleDate ?? ''}
                  onChange={(event) =>
                    setConfig({ ...config, manualSaleDate: event.target.value || null })
                  }
                />
              </div>
              {numberField('manualDiscountPercent', t.manualPercent, true)}
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t.save}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
