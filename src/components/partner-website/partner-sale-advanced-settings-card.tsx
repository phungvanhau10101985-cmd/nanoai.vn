'use client'

import { useEffect, useMemo, useState } from 'react'
import { BadgePercent, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { WebLocale } from '@/lib/i18n/config'

type Settings = {
  google: { enabled: boolean; merchantId: string; lockHours: number; minimumPricePercent: number }
  affiliate: { enabled: boolean; commissionPercent: number; attributionDays: number; minimumPayoutAmount: number }
}

const COPY: Record<WebLocale, string[]> = {
  vi: ['Google Automated Discount & Affiliate', 'Google tự động giảm giá', 'Merchant ID', 'Khóa giá (giờ)', 'Giá tối thiểu (% giá niêm yết)', 'Chương trình Affiliate', 'Hoa hồng (%)', 'Thời gian ghi nhận (ngày)', 'Mức rút tối thiểu', 'Lưu cài đặt', 'Đã lưu cài đặt.', 'Không lưu được cài đặt.'],
  en: ['Google Automated Discount & Affiliate', 'Google automated discount', 'Merchant ID', 'Price lock (hours)', 'Minimum price (% of list)', 'Affiliate program', 'Commission (%)', 'Attribution window (days)', 'Minimum payout', 'Save settings', 'Settings saved.', 'Could not save settings.'],
  zh: ['Google 自动折扣与联盟', 'Google 自动折扣', '商家 ID', '价格锁定（小时）', '最低价格（标价百分比）', '联盟计划', '佣金 (%)', '归因窗口（天）', '最低提现额', '保存设置', '设置已保存。', '无法保存设置。'],
  ja: ['Google 自動割引とアフィリエイト', 'Google 自動割引', 'Merchant ID', '価格ロック（時間）', '最低価格（定価比%）', 'アフィリエイト', '手数料 (%)', 'アトリビューション（日）', '最低支払額', '設定を保存', '設定を保存しました。', '設定を保存できませんでした。'],
  ko: ['Google 자동 할인 및 제휴', 'Google 자동 할인', '판매자 ID', '가격 잠금(시간)', '최저 가격(정가 대비 %)', '제휴 프로그램', '수수료 (%)', '기여 기간(일)', '최소 지급액', '설정 저장', '설정을 저장했습니다.', '설정을 저장하지 못했습니다.'],
}

export function PartnerSaleAdvancedSettingsCard(props: {
  partnerId: string
  locale: WebLocale
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}) {
  const t = COPY[props.locale] ?? COPY.en
  const api = useMemo(
    () => `/api/messaging/partners/${encodeURIComponent(props.partnerId)}/sale-program-settings`,
    [props.partnerId]
  )
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    void fetch(api)
      .then((response) => response.json())
      .then((body: Settings) => setSettings(body))
      .catch(() => setSettings(null))
  }, [api])

  async function save() {
    if (!settings || saving) return
    setSaving(true)
    try {
      const response = await fetch(api, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      props.onToast?.(response.ok ? t[10] : t[11], response.ok ? 'default' : 'destructive')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return null
  const number = (
    section: 'google' | 'affiliate',
    key: string,
    label: string,
    max = 100
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        max={max}
        value={String((settings[section] as unknown as Record<string, number>)[key] ?? 0)}
        onChange={(event) =>
          setSettings({
            ...settings,
            [section]: {
              ...settings[section],
              [key]: Math.max(0, Number(event.target.value) || 0),
            },
          })
        }
      />
    </div>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgePercent className="h-5 w-5" />
          {t[0]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>{t[1]}</Label>
          <Switch checked={settings.google.enabled} onCheckedChange={(enabled) => setSettings({ ...settings, google: { ...settings.google, enabled } })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>{t[2]}</Label><Input value={settings.google.merchantId} onChange={(event) => setSettings({ ...settings, google: { ...settings.google, merchantId: event.target.value } })} /></div>
          {number('google', 'lockHours', t[3], 168)}
          {number('google', 'minimumPricePercent', t[4])}
        </div>
        <div className="flex items-center justify-between">
          <Label>{t[5]}</Label>
          <Switch checked={settings.affiliate.enabled} onCheckedChange={(enabled) => setSettings({ ...settings, affiliate: { ...settings.affiliate, enabled } })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {number('affiliate', 'commissionPercent', t[6])}
          {number('affiliate', 'attributionDays', t[7], 365)}
          {number('affiliate', 'minimumPayoutAmount', t[8], 1_000_000_000)}
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t[9]}
        </Button>
      </CardContent>
    </Card>
  )
}
