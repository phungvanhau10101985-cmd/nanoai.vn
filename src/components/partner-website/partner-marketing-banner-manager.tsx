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
} from '@/lib/partner-website/promotions/partner-marketing-banner'

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    birthday: string
    sale: string
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
  }
> = {
  vi: {
    title: 'Ảnh banner AI sale và sinh nhật',
    hint: 'Tạo ảnh 21:9 bằng AI (Gemini) theo ngày-tháng và % giảm thật. Có thể tải ảnh riêng, chọn phiên bản đang dùng, hoặc xóa. Cron hằng ngày tự tạo khi có khách sắp sinh nhật hoặc sắp tới ngày sale trùng tháng.',
    birthday: 'Sinh nhật',
    sale: 'Sale trùng ngày-tháng',
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
  },
  en: {
    title: 'AI sale and birthday banner images',
    hint: 'Generate a 21:9 image with AI from the real date and discount. You can also upload, activate a version, or delete. Daily cron creates images when customers have upcoming birthdays or a same-day-month sale.',
    birthday: 'Birthday',
    sale: 'Same-day-month sale',
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
  },
  zh: {
    title: '促销与生日 AI 横幅图片',
    hint: '按真实日期和折扣用 AI 生成 21:9 图片。也可上传、启用旧版本或删除。每日任务会在有即将生日的顾客或同日同月促销时自动生成。',
    birthday: '生日',
    sale: '同日同月促销',
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
  },
  ja: {
    title: 'セール・誕生日の AI バナー画像',
    hint: '実際の日付と割引率で 21:9 画像を AI 生成。アップロード、版の切替、削除もできます。誕生日が近いお客様や同日同月セールがあると日次ジョブが自動作成します。',
    birthday: '誕生日',
    sale: '同日同月セール',
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
  },
  ko: {
    title: '세일·생일 AI 배너 이미지',
    hint: '실제 날짜와 할인율로 21:9 이미지를 AI 생성합니다. 업로드, 버전 활성화, 삭제도 가능합니다. 생일이 가까운 고객이나 같은 날짜·월 세일이 있으면 일일 작업이 자동 생성합니다.',
    birthday: '생일',
    sale: '같은 날짜·월 세일',
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
  const [kind, setKind] = useState<'sale' | 'birthday'>('birthday')
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

  const queueGenerate = async (nextKind: 'sale' | 'birthday', nextDateKey: string) => {
    const parsed = parsePartnerMarketingBannerDateKey(nextDateKey)
    if (!parsed) {
      setError(t.date)
      return
    }
    if (nextKind === 'sale' && parsed.day !== parsed.month) {
      setError(t.saleDateHint)
      return
    }
    const { day, month } = parsed
    setWorking(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/regenerate`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: nextKind, day, month }),
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
              const nextKind = event.target.value as 'sale' | 'birthday'
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
          ) : (
            <Input
              value={dateKey}
              onChange={(event) => setDateKey(event.target.value)}
              placeholder={t.date}
              aria-label={t.date}
            />
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
                        {current.kind === 'birthday' ? t.birthday : t.sale} {current.date_key} · −
                        {current.discount_percent}%
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
                        onClick={() => void queueGenerate(current.kind, current.date_key)}
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
