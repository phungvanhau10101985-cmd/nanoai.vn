'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ImagePlus, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSaleCalendarConfig } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { partnerMarketingBannerCampaignKey } from '@/lib/partner-website/promotions/partner-marketing-banner'

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
    createWarehouse: string
    applyWarehouse: string
    warehouseBannerHint: string
    warehouseNeedPercent: string
    warehouseCreated: string
    warehouseApplied: string
    warehouseNeedImage: string
    flashTitle: string
    flashHint: string
    flashOn: string
    flashOff: string
    flashOnAria: string
    flashOffAria: string
    flashOffNote: string
    flashOnNote: string
    flashSavedOn: string
    flashSavedOff: string
    flashError: string
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
    createWarehouse: 'Tạo banner sale kho',
    applyWarehouse: 'Áp dụng banner sale kho',
    warehouseBannerHint: 'Nhập % rồi tạo ảnh 21:9. Slider trang chủ hiện banner kho sau CMSN và sale ngày trùng tháng.',
    warehouseNeedPercent: 'Giảm giá kho phải từ 0.5–80%.',
    warehouseCreated: 'Đã tạo banner sale kho.',
    warehouseApplied: 'Đã áp dụng banner sale kho.',
    warehouseNeedImage: 'Chưa có ảnh banner sale kho cho mức % này. Hãy tạo trước.',
    flashTitle: 'Flash sale',
    flashHint:
      'Khối FLASH SALE trang chủ: tối đa 12 deal / 10 phút, cùng shop Trung Quốc và danh mục vừa xem. Tắt = ẩn khối và không giảm giá flash trên sản phẩm / giỏ hàng.',
    flashOn: 'Đang bật',
    flashOff: 'Đang tắt',
    flashOnAria: 'Tắt Flash sale',
    flashOffAria: 'Bật Flash sale',
    flashOffNote: 'Flash sale đang tắt trên toàn shop. Bấm Đang tắt để bật lại.',
    flashOnNote: 'Đang chạy: giảm 5–6% trên đúng mã trong lượt. Hết lượt mất giảm. Không áp dụng hàng kho thanh lý.',
    flashSavedOn: 'Đã bật Flash sale',
    flashSavedOff: 'Đã tắt Flash sale',
    flashError: 'Không lưu được Flash sale.',
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
    createWarehouse: 'Create warehouse banner',
    applyWarehouse: 'Apply warehouse banner',
    warehouseBannerHint: 'Enter a percent then generate a 21:9 image. The homepage slider shows it after birthday and same-day sale.',
    warehouseNeedPercent: 'Warehouse discount must be 0.5–80%.',
    warehouseCreated: 'Warehouse banner created.',
    warehouseApplied: 'Warehouse banner applied.',
    warehouseNeedImage: 'No warehouse banner image for this percent yet. Generate one first.',
    flashTitle: 'Flash sale',
    flashHint:
      'Homepage FLASH SALE block: up to 12 deals / 10 minutes from the same Chinese shop and recently viewed category. Off hides the block and removes flash discounts on products and cart.',
    flashOn: 'On',
    flashOff: 'Off',
    flashOnAria: 'Turn off Flash sale',
    flashOffAria: 'Turn on Flash sale',
    flashOffNote: 'Flash sale is off for the whole shop. Tap Off to turn it back on.',
    flashOnNote: 'Live: 5–6% off assigned SKUs this round. Discount ends with the round. Not on warehouse clearance.',
    flashSavedOn: 'Flash sale is on',
    flashSavedOff: 'Flash sale is off',
    flashError: 'Could not save Flash sale.',
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
    createWarehouse: '生成清仓横幅',
    applyWarehouse: '应用清仓横幅',
    warehouseBannerHint: '输入折扣后生成 21:9 图片。首页滑块在生日和同日促销之后显示。',
    warehouseNeedPercent: '清仓折扣须为 0.5–80%。',
    warehouseCreated: '已生成清仓横幅。',
    warehouseApplied: '已应用清仓横幅。',
    warehouseNeedImage: '该折扣还没有清仓横幅。请先生成。',
    flashTitle: '限时抢购',
    flashHint:
      '首页 FLASH SALE：每轮 10 分钟最多 12 个特惠，来自刚看过的中国店铺与三级类目。关闭后隐藏区块，商品/购物车不再享受闪购折扣。',
    flashOn: '已开启',
    flashOff: '已关闭',
    flashOnAria: '关闭限时抢购',
    flashOffAria: '开启限时抢购',
    flashOffNote: '全店已关闭限时抢购。点「已关闭」可重新开启。',
    flashOnNote: '当前轮次对指定商品减 5–6%。本轮结束即恢复原价。清仓商品不适用。',
    flashSavedOn: '已开启限时抢购',
    flashSavedOff: '已关闭限时抢购',
    flashError: '无法保存限时抢购。',
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
    createWarehouse: '倉庫バナーを作成',
    applyWarehouse: '倉庫バナーを適用',
    warehouseBannerHint: '% を入力して 21:9 画像を生成。トップのスライダーは誕生日・同日セールの後に表示します。',
    warehouseNeedPercent: '倉庫割引は 0.5–80% にしてください。',
    warehouseCreated: '倉庫バナーを作成しました。',
    warehouseApplied: '倉庫バナーを適用しました。',
    warehouseNeedImage: 'この割引率の倉庫バナーがありません。先に作成してください。',
    flashTitle: 'フラッシュセール',
    flashHint:
      'トップの FLASH SALE：10分で最大12件。最近見た中国ショップと同じカテゴリ。オフにするとブロック非表示、商品・カートの割引も停止します。',
    flashOn: 'オン',
    flashOff: 'オフ',
    flashOnAria: 'フラッシュセールをオフ',
    flashOffAria: 'フラッシュセールをオン',
    flashOffNote: 'ショップ全体でオフです。「オフ」を押すと再オンできます。',
    flashOnNote: 'このラウンドの対象SKUは5–6%オフ。終了で割引終了。倉庫クリアランスは対象外。',
    flashSavedOn: 'フラッシュセールをオンにしました',
    flashSavedOff: 'フラッシュセールをオフにしました',
    flashError: 'フラッシュセールを保存できませんでした。',
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
    createWarehouse: '창고 배너 만들기',
    applyWarehouse: '창고 배너 적용',
    warehouseBannerHint: '%를 입력한 뒤 21:9 이미지를 만듭니다. 홈 슬라이더는 생일·같은 날짜 세일 다음에 보여 줍니다.',
    warehouseNeedPercent: '창고 할인은 0.5–80%여야 합니다.',
    warehouseCreated: '창고 배너를 만들었습니다.',
    warehouseApplied: '창고 배너를 적용했습니다.',
    warehouseNeedImage: '이 할인율의 창고 배너가 없습니다. 먼저 만드세요.',
    flashTitle: '플래시 세일',
    flashHint:
      '홈 FLASH SALE: 10분마다 최대 12개, 최근 본 중국 샵·카테고리. 끄면 블록이 숨고 상품/장바구니 플래시 할인도 중지됩니다.',
    flashOn: '켜짐',
    flashOff: '꺼짐',
    flashOnAria: '플래시 세일 끄기',
    flashOffAria: '플래시 세일 켜기',
    flashOffNote: '전체 샵에서 플래시 세일이 꺼져 있습니다. 꺼짐을 눌러 다시 켜세요.',
    flashOnNote: '이번 라운드 지정 SKU 5–6% 할인. 라운드가 끝나면 할인 종료. 창고 클리어런스 제외.',
    flashSavedOn: '플래시 세일을 켰습니다',
    flashSavedOff: '플래시 세일을 껐습니다',
    flashError: '플래시 세일을 저장하지 못했습니다.',
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
  const [flashSaving, setFlashSaving] = useState(false)
  const [bannerWorking, setBannerWorking] = useState(false)
  const bannersApi = useMemo(
    () => `/api/messaging/partners/${encodeURIComponent(partnerId)}/marketing-banners`,
    [partnerId]
  )

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

  async function toggleFlashSaleEnabled() {
    if (!config || flashSaving) return
    const next = config.flashSaleEnabled === false
    setFlashSaving(true)
    try {
      const response = await fetch(api, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, flashSaleEnabled: next }),
      })
      if (response.ok) {
        setConfig({ ...config, flashSaleEnabled: next })
        onToast?.(next ? t.flashSavedOn : t.flashSavedOff)
      } else {
        onToast?.(t.flashError, 'destructive')
      }
    } finally {
      setFlashSaving(false)
    }
  }

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

  async function createWarehouseBanner() {
    const pct = Number(config?.clearanceDiscountPercent)
    if (!Number.isFinite(pct) || pct <= 0 || pct > 80) {
      onToast?.(t.warehouseNeedPercent, 'destructive')
      return
    }
    setBannerWorking(true)
    try {
      const res = await fetch(`${bannersApi}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'warehouse', discountPercent: pct }),
      })
      onToast?.(res.ok ? t.warehouseCreated : t.error, res.ok ? 'default' : 'destructive')
    } finally {
      setBannerWorking(false)
    }
  }

  async function applyWarehouseBanner() {
    const pct = Number(config?.clearanceDiscountPercent)
    if (!Number.isFinite(pct) || pct <= 0 || pct > 80) {
      onToast?.(t.warehouseNeedPercent, 'destructive')
      return
    }
    setBannerWorking(true)
    try {
      const listRes = await fetch(`${bannersApi}?kind=warehouse`, { credentials: 'same-origin' })
      const listBody = (await listRes.json().catch(() => null)) as {
        items?: Array<{ id: string; campaign_key: string; is_active: boolean; image_url?: string | null; status?: string }>
      } | null
      const campaignKey = partnerMarketingBannerCampaignKey('warehouse', 0, 0, pct)
      const match = (listBody?.items ?? []).find(
        (item) => item.campaign_key === campaignKey && item.status === 'ready' && item.image_url
      ) ?? (listBody?.items ?? []).find((item) => item.is_active && item.image_url)
      if (!match?.id) {
        onToast?.(t.warehouseNeedImage, 'destructive')
        return
      }
      const activateRes = await fetch(`${bannersApi}/${encodeURIComponent(match.id)}/activate`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!activateRes.ok) {
        onToast?.(t.error, 'destructive')
        return
      }
      if (config && !config.clearanceEnabled) {
        await fetch(api, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...config, clearanceEnabled: true }),
        })
        await load()
      }
      onToast?.(t.warehouseApplied)
    } finally {
      setBannerWorking(false)
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
            <div
              id="flash-sale"
              className="space-y-3 rounded-xl border border-red-100 bg-red-50/40 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{t.flashTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.flashHint}</p>
                </div>
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    config.flashSaleEnabled !== false
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-300 text-gray-800 hover:bg-gray-400'
                  } disabled:opacity-60`}
                  disabled={flashSaving}
                  aria-pressed={config.flashSaleEnabled !== false}
                  aria-label={config.flashSaleEnabled !== false ? t.flashOnAria : t.flashOffAria}
                  onClick={() => void toggleFlashSaleEnabled()}
                >
                  {flashSaving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
                  {config.flashSaleEnabled !== false ? t.flashOn : t.flashOff}
                </button>
              </div>
              {config.flashSaleEnabled === false ? (
                <div className="rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-700">
                  {t.flashOffNote}
                </div>
              ) : (
                <p className="text-xs text-red-800">{t.flashOnNote}</p>
              )}
            </div>
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
            <p className="text-xs text-muted-foreground">{t.warehouseBannerHint}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={bannerWorking || saving}
                onClick={() => void createWarehouseBanner()}
              >
                {bannerWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                {t.createWarehouse}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={bannerWorking || saving}
                onClick={() => void applyWarehouseBanner()}
              >
                {t.applyWarehouse}
              </Button>
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
