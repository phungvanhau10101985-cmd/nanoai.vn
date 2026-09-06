'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerMarketingBannerAdminItem } from '@/lib/partner-website/promotions/partner-marketing-banner'
import {
  PARTNER_MARKETING_BANNER_CREDIT_COST,
  parsePartnerMarketingBannerDateKey,
  type PartnerMarketingBannerKind,
} from '@/lib/partner-website/promotions/partner-marketing-banner'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    birthday: string
    sale: string
    warehouse: string
    regular: string
    date: string
    generate: string
    working: string
    upload: string
    empty: string
    retry: string
    regenerate: string
    activate: string
    active: string
    delete: string
    prompt: string
    loadError: string
    created: string
    activated: string
    uploaded: string
    deleted: string
    creditHint: string
    saleDateHint: string
    warehouseHint: string
    regularHint: string
  }
> = {
  vi: {
    title: 'Ảnh banner AI ưu đãi',
    hint: 'Một slider trang chủ xếp CMSN, rồi sale ngày trùng tháng, rồi sale kho, rồi banner thường. Tạo ảnh 21:9 bằng AI (Gemini) hoặc tải ảnh, chọn phiên bản đang dùng, hoặc xóa. Cron tự tạo CMSN/sale/kho khi đủ điều kiện.',
    birthday: 'Sinh nhật',
    sale: 'Sale trùng ngày-tháng',
    warehouse: 'Sale kho',
    regular: 'Banner thường',
    date: 'MM-DD',
    generate: 'Tạo ảnh AI cho ngày này',
    working: 'Đang xử lý…',
    upload: 'Tải ảnh lên',
    empty: 'Chưa có banner. Tạo AI hoặc tải ảnh, hoặc đợi cron khi có khách trong tuần sinh nhật / ngày sale.',
    retry: 'Thử lại',
    regenerate: 'Tạo lại',
    activate: 'dùng lại',
    active: 'đang dùng',
    delete: 'Xóa',
    prompt: 'Xem prompt và lỗi',
    loadError: 'Không tải được danh sách banner.',
    created: 'Đã tạo ảnh banner.',
    activated: 'Đã dùng lại phiên bản này.',
    uploaded: 'Đã tải ảnh banner.',
    deleted: 'Đã xóa phiên bản.',
    creditHint: `Tạo AI tốn ${PARTNER_MARKETING_BANNER_CREDIT_COST} credit / ảnh.`,
    saleDateHint: 'Chỉ ngày trùng tháng (01/01 … 12/12).',
    warehouseHint: 'Ảnh sale kho lưu theo mức % đang bật. Slider hiện khi kho sale bật và % > 0.',
    regularHint: 'Banner thường luôn nằm cuối slider. Có thể tạo nhiều ảnh, mỗi ảnh một slide.',
  },
  en: {
    title: 'AI promo banner images',
    hint: 'One homepage slider: birthday, then same-day-month sale, then warehouse clearance, then regular banners. Generate a 21:9 image with AI, upload, activate a version, or delete. Daily cron creates birthday, sale, and warehouse images when needed.',
    birthday: 'Birthday',
    sale: 'Same-day-month sale',
    warehouse: 'Warehouse sale',
    regular: 'Regular banner',
    date: 'MM-DD',
    generate: 'Generate AI image for this date',
    working: 'Working…',
    upload: 'Upload image',
    empty: 'No banners yet. Generate or upload, or wait for the daily job.',
    retry: 'Retry',
    regenerate: 'Regenerate',
    activate: 'use',
    active: 'active',
    delete: 'Delete',
    prompt: 'View prompt and errors',
    loadError: 'Could not load banners.',
    created: 'Banner image created.',
    activated: 'This version is now active.',
    uploaded: 'Banner image uploaded.',
    deleted: 'Version deleted.',
    creditHint: `AI generation costs ${PARTNER_MARKETING_BANNER_CREDIT_COST} credits per image.`,
    saleDateHint: 'Same-day-month dates only (01/01 … 12/12).',
    warehouseHint: 'Warehouse images are stored per discount percent. The slider shows them when clearance is on and percent is above 0.',
    regularHint: 'Regular banners always sit last in the slider. You can create several; each is one slide.',
  },
  zh: {
    title: '促销 AI 横幅图片',
    hint: '首页一个滑块：生日、同日同月促销、清仓、普通横幅。用 AI 生成 21:9 图片，也可上传、启用或删除。每日任务会在需要时生成生日、促销和清仓图。',
    birthday: '生日',
    sale: '同日同月促销',
    warehouse: '清仓促销',
    regular: '普通横幅',
    date: 'MM-DD',
    generate: '为该日期生成 AI 图片',
    working: '处理中…',
    upload: '上传图片',
    empty: '还没有横幅。请生成、上传，或等待每日任务。',
    retry: '重试',
    regenerate: '重新生成',
    activate: '启用',
    active: '使用中',
    delete: '删除',
    prompt: '查看提示词和错误',
    loadError: '无法加载横幅。',
    created: '已生成横幅图片。',
    activated: '已启用此版本。',
    uploaded: '已上传横幅图片。',
    deleted: '已删除该版本。',
    creditHint: `每次 AI 生成消耗 ${PARTNER_MARKETING_BANNER_CREDIT_COST} 积分。`,
    saleDateHint: '仅限同日同月（01/01 … 12/12）。',
    warehouseHint: '清仓图按折扣百分比保存。开启清仓且折扣大于 0 时滑块会显示。',
    regularHint: '普通横幅始终排在滑块最后。可创建多张，每张一张幻灯片。',
  },
  ja: {
    title: 'プロモ AI バナー画像',
    hint: 'トップは1つのスライダー：誕生日、同日同月セール、倉庫セール、通常バナー。21:9 を AI 生成、アップロード、版の切替、削除ができます。日次ジョブは誕生日・セール・倉庫画像を必要時に作ります。',
    birthday: '誕生日',
    sale: '同日同月セール',
    warehouse: '倉庫セール',
    regular: '通常バナー',
    date: 'MM-DD',
    generate: 'この日付の AI 画像を作る',
    working: '処理中…',
    upload: '画像をアップロード',
    empty: 'バナーはまだありません。生成・アップロードするか、日次ジョブを待ってください。',
    retry: '再試行',
    regenerate: '再生成',
    activate: '使う',
    active: '使用中',
    delete: '削除',
    prompt: 'プロンプトとエラーを見る',
    loadError: 'バナーを読み込めませんでした。',
    created: 'バナー画像を作成しました。',
    activated: 'この版を使用中にしました。',
    uploaded: 'バナー画像をアップロードしました。',
    deleted: 'この版を削除しました。',
    creditHint: `AI 生成は 1 枚あたり ${PARTNER_MARKETING_BANNER_CREDIT_COST} クレジットです。`,
    saleDateHint: '同日同月のみ（01/01 … 12/12）。',
    warehouseHint: '倉庫バナーは割引率ごとに保存。クリアランスがオンで % が 0 より大きいとき表示します。',
    regularHint: '通常バナーは常にスライダーの最後。複数枚作れ、1枚が1スライドです。',
  },
  ko: {
    title: '프로모 AI 배너 이미지',
    hint: '홈 슬라이더 하나: 생일, 같은 날짜·월 세일, 창고 세일, 일반 배너. 21:9 AI 생성, 업로드, 버전 활성화, 삭제가 가능합니다. 일일 작업은 생일·세일·창고 이미지를 필요할 때 만듭니다.',
    birthday: '생일',
    sale: '같은 날짜·월 세일',
    warehouse: '창고 세일',
    regular: '일반 배너',
    date: 'MM-DD',
    generate: '이 날짜의 AI 이미지 만들기',
    working: '처리 중…',
    upload: '이미지 업로드',
    empty: '배너가 없습니다. 생성하거나 업로드하거나 일일 작업을 기다리세요.',
    retry: '다시 시도',
    regenerate: '다시 만들기',
    activate: '사용',
    active: '사용 중',
    delete: '삭제',
    prompt: '프롬프트와 오류 보기',
    loadError: '배너를 불러오지 못했습니다.',
    created: '배너 이미지를 만들었습니다.',
    activated: '이 버전을 사용합니다.',
    uploaded: '배너 이미지를 올렸습니다.',
    deleted: '버전을 삭제했습니다.',
    creditHint: `AI 생성은 이미지당 ${PARTNER_MARKETING_BANNER_CREDIT_COST} 크레딧입니다.`,
    saleDateHint: '같은 날짜·월만 가능합니다 (01/01 … 12/12).',
    warehouseHint: '창고 배너는 할인율별로 저장됩니다. 창고 세일이 켜지고 %가 0보다 클 때 슬라이더에 나옵니다.',
    regularHint: '일반 배너는 항상 슬라이더 마지막입니다. 여러 장을 만들 수 있고 한 장이 한 슬라이드입니다.',
  },
}

function defaultDateKey() {
  const now = new Date()
  return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

type Props = {
  partnerId: string
  locale: WebLocale
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}

export function PartnerMarketingBannerManager({ partnerId, locale, onToast }: Props) {
  const t = COPY[locale] ?? COPY.vi
  const [items, setItems] = useState<PartnerMarketingBannerAdminItem[]>([])
  const [kind, setKind] = useState<PartnerMarketingBannerKind>('birthday')
  const [dateKey, setDateKey] = useState(defaultDateKey)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const apiBase = `/api/messaging/partners/${encodeURIComponent(partnerId)}/marketing-banners`

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBase, { credentials: 'same-origin' })
      const data = (await res.json().catch(() => null)) as { items?: PartnerMarketingBannerAdminItem[] } | null
      if (!res.ok) throw new Error(t.loadError)
      setItems(data?.items ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setLoading(false)
    }
  }, [apiBase, t.loadError])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 15000)
    return () => window.clearInterval(timer)
  }, [load])

  const grouped = useMemo(() => {
    const result = new Map<string, PartnerMarketingBannerAdminItem[]>()
    items.forEach((item) => {
      const key = `${item.kind}:${item.campaign_key}`
      result.set(key, [...(result.get(key) ?? []), item])
    })
    return Array.from(result.values())
  }, [items])

  const kindLabel = (value: PartnerMarketingBannerKind) => {
    if (value === 'birthday') return t.birthday
    if (value === 'warehouse') return t.warehouse
    if (value === 'regular') return t.regular
    return t.sale
  }

  const queueGenerate = async (
    nextKind: PartnerMarketingBannerKind,
    nextDateKey: string,
    campaignKey?: string | null
  ) => {
    let body: Record<string, unknown> = { kind: nextKind }
    if (nextKind === 'birthday' || nextKind === 'sale') {
      const parsed = parsePartnerMarketingBannerDateKey(nextDateKey)
      if (!parsed) {
        setError(t.date)
        return
      }
      if (nextKind === 'sale' && parsed.day !== parsed.month) {
        setError(t.saleDateHint)
        return
      }
      body = { ...body, day: parsed.day, month: parsed.month }
    }
    if (nextKind === 'regular' && campaignKey) body.campaignKey = campaignKey
    setWorking(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/regenerate`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || t.loadError)
      onToast?.(t.created)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : t.loadError
      setError(message)
      onToast?.(message, 'destructive')
    } finally {
      setWorking(false)
    }
  }

  const activate = async (asset: PartnerMarketingBannerAdminItem) => {
    setWorking(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(asset.id)}/activate`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(t.loadError)
      onToast?.(t.activated)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setWorking(false)
    }
  }

  const remove = async (asset: PartnerMarketingBannerAdminItem) => {
    if (!window.confirm(t.delete)) return
    setWorking(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(asset.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(t.loadError)
      onToast?.(t.deleted)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setWorking(false)
    }
  }

  const upload = async (file: File) => {
    setWorking(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('kind', kind)
      form.set('dateKey', dateKey)
      if (kind === 'regular') form.set('campaignKey', '')
      form.set('file', file)
      const res = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || t.loadError)
      onToast?.(t.uploaded)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : t.loadError
      setError(message)
      onToast?.(message, 'destructive')
    } finally {
      setWorking(false)
    }
  }

  return (
    <Card id="ai-banners">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>
          {t.hint} {t.creditHint}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{' '}
            <button type="button" onClick={() => void load()} className="font-medium underline">
              {t.retry}
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[180px_160px_auto_auto]">
          <select
            value={kind}
            onChange={(event) => {
              const nextKind = event.target.value as PartnerMarketingBannerKind
              setKind(nextKind)
              if (nextKind === 'sale') {
                const month = dateKey.slice(0, 2)
                setDateKey(`${month}-${month}`)
              }
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label={t.birthday}
          >
            <option value="birthday">{t.birthday}</option>
            <option value="sale">{t.sale}</option>
            <option value="warehouse">{t.warehouse}</option>
            <option value="regular">{t.regular}</option>
          </select>
          {kind === 'sale' ? (
            <select
              value={dateKey}
              onChange={(event) => setDateKey(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label={t.sale}
            >
              {Array.from({ length: 12 }, (_, index) => {
                const mm = String(index + 1).padStart(2, '0')
                return (
                  <option key={mm} value={`${mm}-${mm}`}>
                    {mm}/{mm}
                  </option>
                )
              })}
            </select>
          ) : kind === 'birthday' ? (
            <Input
              value={dateKey}
              onChange={(event) => setDateKey(event.target.value)}
              placeholder={t.date}
              aria-label={t.date}
            />
          ) : (
            <p className="flex items-center text-xs text-muted-foreground">
              {kind === 'warehouse' ? t.warehouseHint : t.regularHint}
            </p>
          )}
          <Button type="button" disabled={working} onClick={() => void queueGenerate(kind, dateKey)}>
            {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {working ? t.working : t.generate}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={working}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            {t.upload}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void upload(file)
            }}
          />
        </div>

        {loading ? (
          <div className="aspect-[21/9] animate-pulse rounded-lg bg-muted" aria-label={t.working} />
        ) : grouped.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t.empty}
          </p>
        ) : (
          <div className="space-y-5">
            {grouped.map((versions) => {
              const current = versions.find((item) => item.is_active) ?? versions[0]
              return (
                <article key={`${current.kind}:${current.campaign_key}`} className="rounded-xl border p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {kindLabel(current.kind)}
                        {current.kind === 'birthday' || current.kind === 'sale' ? ` ${current.date_key}` : ''}
                        {current.kind !== 'regular' ? ` · −${current.discount_percent}%` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {current.model} · {versions.length} · {current.status}
                        {current.source === 'upload' ? ` · ${t.upload}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={working}
                        onClick={() =>
                          void queueGenerate(current.kind, current.date_key, current.campaign_key)
                        }
                      >
                        {t.regenerate}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={working}
                        onClick={() => void remove(current)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        {t.delete}
                      </Button>
                    </div>
                  </div>

                  {current.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={current.image_url}
                      alt={`${current.kind} ${current.date_key}`}
                      className="h-auto w-full rounded-lg border bg-muted"
                    />
                  ) : (
                    <div className="rounded-lg bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
                      {current.status === 'generating' ? t.working : current.error_message || t.empty}
                    </div>
                  )}

                  {versions.length > 1 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {versions.map((version) => (
                        <button
                          key={version.id}
                          type="button"
                          disabled={working || version.status !== 'ready' || version.is_active}
                          onClick={() => void activate(version)}
                          className={`rounded-md px-3 py-1.5 text-xs ${
                            version.is_active
                              ? 'bg-emerald-100 font-semibold text-emerald-800'
                              : 'border text-muted-foreground hover:bg-muted disabled:opacity-50'
                          }`}
                        >
                          v{version.version}
                          {version.is_active ? ` ${t.active}` : ` ${t.activate}`}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <details className="mt-3 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium">{t.prompt}</summary>
                    <p className="mt-2 whitespace-pre-wrap rounded bg-muted p-3">{current.prompt}</p>
                    {current.error_message ? <p className="mt-2 text-red-700">{current.error_message}</p> : null}
                  </details>
                </article>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
