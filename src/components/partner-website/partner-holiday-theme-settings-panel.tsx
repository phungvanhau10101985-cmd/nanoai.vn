'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { partnerWebsitePublicPath } from '@/lib/partner-website/partner-website-slug'
import { isPartnerHolidayThemeId } from '@/lib/partner-website/promotions/partner-holiday-schedule'

function formatPreviewRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
import type {
  PartnerHolidayOccasionAdmin,
  PartnerHolidayThemeAdminState,
} from '@/lib/partner-website/promotions/partner-holiday-theme'

type Draft = {
  startDay: string
  startMonth: string
  endDay: string
  endMonth: string
  leadDays: string
  afterDays: string
  salePercent: string
  saleLeadDays: string
  saleDays: string
}

const COPY: Record<
  WebLocale,
  {
    hint: string
    generateAll: string
    generatingAll: string
    generateAllHint: string
    generatingHint: string
    loadError: string
    retry: string
    loading: string
    showingToday: string
    previewOn: string
    previewOff: string
    enabledOn: string
    enabledOff: string
    datesTitle: string
    lunarHint: string
    solarHint: string
    startDay: string
    startMonth: string
    endDay: string
    endMonth: string
    year: string
    lead: string
    after: string
    saleTitle: string
    salePercent: string
    saleDays: string
    saleLead: string
    emptySale: string
    emptySaleHint: string
    save: string
    saving: string
    saved: string
    saveError: string
    bannerNone: string
    bannerCreate: string
    bannerRedo: string
    bannerBusy: string
    previewNeedLogin: string
    previewOnNote: string
    previewBlocked: string
    previewOffNote: string
    openShop: string
    intError: string
    saleLeadError: string
    saleDaysError: string
    salePctError: string
    windowOn: string
    windowOff: string
    saleRange: string
  }
> = {
  vi: {
    hint: 'Tự bật trước và sale giống sale cùng ngày cùng tháng: lưu ngày/tháng, lặp mỗi năm. Ngày bật / ngày tắt là giao diện. Số ngày sale / sale trước lễ để trống thì chỉ giảm đúng ngày lễ. Banner GPT chỉ ghi tên dịp, không ghi ngày tháng — dùng lại các năm. Âm lịch tự đổi sang dương lịch năm đó.',
    generateAll: 'Tạo tất cả banner GPT',
    generatingAll: 'Đang tạo banner GPT…',
    generateAllHint: 'Một lượt đủ 16 dịp. Ảnh sẵn giữ lại; muốn vẽ lại từng dịp thì bấm Tạo lại trên thẻ đó.',
    generatingHint: ' Có dịp đang vẽ — các dịp khác vẫn bấm tạo được.',
    loadError: 'Không tải được giao diện ngày lễ',
    retry: 'Thử lại',
    loading: 'Đang tải…',
    showingToday: 'Đang hiện hôm nay',
    previewOn: 'Đang xem trước · còn {left}',
    previewOff: 'Xem trước 10 phút',
    enabledOn: 'Tắt',
    enabledOff: 'Bật',
    datesTitle: 'Ngày lễ và giao diện',
    lunarHint: 'ô xanh = ngày âm',
    solarHint: 'ô đỏ = ngày dương',
    startDay: 'Ngày bắt đầu',
    startMonth: 'Tháng bắt đầu',
    endDay: 'Ngày kết thúc',
    endMonth: 'Tháng kết thúc',
    year: 'Năm (dương)',
    lead: 'Số ngày bật trước',
    after: 'Số ngày tắt sau lễ',
    saleTitle: 'Sale',
    salePercent: '% sale',
    saleDays: 'Số ngày được sale',
    saleLead: 'Sale trước ngày lễ',
    emptySale: 'Để trống: đúng ngày lễ',
    emptySaleHint: 'Để trống thì chỉ sale đúng ngày lễ.',
    save: 'Lưu',
    saving: 'Đang lưu…',
    saved: 'Đã lưu {name}.',
    saveError: 'Không lưu được',
    bannerNone: 'chưa có ảnh',
    bannerCreate: 'Tạo banner GPT',
    bannerRedo: 'Tạo lại banner',
    bannerBusy: 'Đang tạo…',
    previewNeedLogin: 'Cần đăng nhập quản trị thì bản xem trước mới hiện.',
    previewOnNote: '{name} đang hiện trên cửa hàng trong 10 phút với tài khoản quản trị này. Khách khác không thấy.',
    previewBlocked: '{name} đã bật trong 10 phút. Trình duyệt chặn cửa sổ mới — bấm Mở cửa hàng.',
    previewOffNote: 'Đã tắt xem trước {name}.',
    openShop: 'Mở cửa hàng',
    intError: 'Ngày, tháng và số ngày phải là số nguyên.',
    saleLeadError: 'Sale trước lễ phải để trống hoặc 0–60 ngày.',
    saleDaysError: 'Số ngày sale phải để trống hoặc 0–60 ngày.',
    salePctError: '% sale phải từ 0 đến 50.',
    windowOn: 'Ngày bật: {date}',
    windowOff: 'Ngày tắt: {date}',
    saleRange: 'Sale: {from}{to}',
  },
  en: {
    hint: 'Turns on and discounts automatically, like same-day-month sales: store day/month, repeat every year. On/off days are the theme window. Leave sale days empty to discount only on the holiday. GPT banners use the occasion name only — no dates — so they reuse every year. Lunar dates convert to solar for that year.',
    generateAll: 'Create all GPT banners',
    generatingAll: 'Creating GPT banners…',
    generateAllHint: 'One run covers 16 occasions. Existing images stay; recreate on a card to redraw that occasion.',
    generatingHint: ' An occasion is generating — others can still be created.',
    loadError: 'Could not load holiday themes',
    retry: 'Retry',
    loading: 'Loading…',
    showingToday: 'Showing today',
    previewOn: 'Previewing · {left} left',
    previewOff: 'Preview 10 minutes',
    enabledOn: 'Turn off',
    enabledOff: 'Turn on',
    datesTitle: 'Holiday and theme',
    lunarHint: 'green = lunar date',
    solarHint: 'red = solar date',
    startDay: 'Start day',
    startMonth: 'Start month',
    endDay: 'End day',
    endMonth: 'End month',
    year: 'Year (solar)',
    lead: 'Days on before',
    after: 'Days off after',
    saleTitle: 'Sale',
    salePercent: 'Sale %',
    saleDays: 'Sale days',
    saleLead: 'Sale days before',
    emptySale: 'Empty: holiday dates only',
    emptySaleHint: 'Leave empty to sell only on the holiday.',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved {name}.',
    saveError: 'Could not save',
    bannerNone: 'no image yet',
    bannerCreate: 'Create GPT banner',
    bannerRedo: 'Recreate banner',
    bannerBusy: 'Creating…',
    previewNeedLogin: 'Sign in to admin to preview.',
    previewOnNote: '{name} is on the shop for 10 minutes for this admin account. Other shoppers do not see it.',
    previewBlocked: '{name} is on for 10 minutes. The browser blocked a new tab — open the shop.',
    previewOffNote: 'Preview of {name} is off.',
    openShop: 'Open shop',
    intError: 'Day, month, and day counts must be integers.',
    saleLeadError: 'Sale-before days must be empty or 0–60.',
    saleDaysError: 'Sale days must be empty or 0–60.',
    salePctError: 'Sale % must be 0–50.',
    windowOn: 'Turns on: {date}',
    windowOff: 'Turns off: {date}',
    saleRange: 'Sale: {from}{to}',
  },
  zh: {
    hint: '像同日同月促销一样自动开启：只存日/月，每年重复。开启/关闭日是界面窗口。促销天数留空则只在节日当天打折。GPT 横幅只写节日名、不写日期，可每年复用。农历会换算成当年阳历。',
    generateAll: '生成全部 GPT 横幅',
    generatingAll: '正在生成 GPT 横幅…',
    generateAllHint: '一次覆盖 16 个节日。已有图片保留；要重画请在该卡片点重新生成。',
    generatingHint: ' 有节日正在生成 — 其他仍可创建。',
    loadError: '无法加载节日界面',
    retry: '重试',
    loading: '加载中…',
    showingToday: '今天正在显示',
    previewOn: '预览中 · 剩余 {left}',
    previewOff: '预览 10 分钟',
    enabledOn: '关闭',
    enabledOff: '开启',
    datesTitle: '节日与界面',
    lunarHint: '绿色 = 农历',
    solarHint: '红色 = 阳历',
    startDay: '开始日',
    startMonth: '开始月',
    endDay: '结束日',
    endMonth: '结束月',
    year: '年份（阳历）',
    lead: '提前开启天数',
    after: '节后关闭天数',
    saleTitle: '促销',
    salePercent: '促销 %',
    saleDays: '促销天数',
    saleLead: '节前促销天数',
    emptySale: '留空：仅节日当天',
    emptySaleHint: '留空则只在节日当天促销。',
    save: '保存',
    saving: '保存中…',
    saved: '已保存 {name}。',
    saveError: '无法保存',
    bannerNone: '尚无图片',
    bannerCreate: '生成 GPT 横幅',
    bannerRedo: '重新生成横幅',
    bannerBusy: '生成中…',
    previewNeedLogin: '请先登录管理后台再预览。',
    previewOnNote: '{name} 将在本管理员账号下显示 10 分钟。其他顾客看不到。',
    previewBlocked: '{name} 已开启 10 分钟。浏览器拦截了新窗口 — 请打开店铺。',
    previewOffNote: '已关闭 {name} 预览。',
    openShop: '打开店铺',
    intError: '日、月和天数必须是整数。',
    saleLeadError: '节前促销天数须留空或 0–60。',
    saleDaysError: '促销天数须留空或 0–60。',
    salePctError: '促销 % 必须为 0–50。',
    windowOn: '开启：{date}',
    windowOff: '关闭：{date}',
    saleRange: '促销：{from}{to}',
  },
  ja: {
    hint: '同日同月セールと同じく自動で点灯します。月日だけ保存し毎年繰り返します。点灯／消灯日がテーマ期間です。セール日数を空にすると祝日当日だけ値引きします。GPTバナーは行事名のみ（日付なし）で毎年使えます。旧暦はその年の太陽暦に変換します。',
    generateAll: 'GPTバナーをすべて作成',
    generatingAll: 'GPTバナーを作成中…',
    generateAllHint: '16行事を一度に作成。既存画像は残します。描き直す場合はそのカードで再作成。',
    generatingHint: ' 作成中の行事があります。他は作成できます。',
    loadError: '祝日テーマを読み込めません',
    retry: '再試行',
    loading: '読み込み中…',
    showingToday: '本日表示中',
    previewOn: 'プレビュー中 · 残り {left}',
    previewOff: '10分プレビュー',
    enabledOn: 'オフ',
    enabledOff: 'オン',
    datesTitle: '祝日とテーマ',
    lunarHint: '緑 = 旧暦',
    solarHint: '赤 = 太陽暦',
    startDay: '開始日',
    startMonth: '開始月',
    endDay: '終了日',
    endMonth: '終了月',
    year: '年（太陽暦）',
    lead: '事前点灯日数',
    after: '終了後日数',
    saleTitle: 'セール',
    salePercent: 'セール %',
    saleDays: 'セール日数',
    saleLead: '事前セール日数',
    emptySale: '空欄：祝日当日のみ',
    emptySaleHint: '空欄なら祝日当日だけセール。',
    save: '保存',
    saving: '保存中…',
    saved: '{name} を保存しました。',
    saveError: '保存できません',
    bannerNone: '画像なし',
    bannerCreate: 'GPTバナーを作成',
    bannerRedo: 'バナーを再作成',
    bannerBusy: '作成中…',
    previewNeedLogin: 'プレビューには管理ログインが必要です。',
    previewOnNote: '{name} をこの管理者アカウントで10分間表示します。他の客には見えません。',
    previewBlocked: '{name} を10分間オンにしました。新しいタブがブロックされました — ショップを開いてください。',
    previewOffNote: '{name} のプレビューをオフにしました。',
    openShop: 'ショップを開く',
    intError: '日・月・日数は整数にしてください。',
    saleLeadError: '事前セール日数は空欄または0–60です。',
    saleDaysError: 'セール日数は空欄または0–60です。',
    salePctError: 'セール%は0–50です。',
    windowOn: '点灯: {date}',
    windowOff: '消灯: {date}',
    saleRange: 'セール: {from}{to}',
  },
  ko: {
    hint: '같은 날·같은 달 세일처럼 자동으로 켜집니다. 월/일만 저장하고 매년 반복합니다. 켜기/끄기 날이 테마 기간입니다. 세일 일수를 비우면 명절 당일에만 할인합니다. GPT 배너는 행사 이름만 쓰고 날짜는 없어 매년 재사용합니다. 음력은 그해 양력으로 바뀝니다.',
    generateAll: 'GPT 배너 모두 만들기',
    generatingAll: 'GPT 배너 만드는 중…',
    generateAllHint: '한 번에 16개 명절. 있는 이미지는 유지됩니다. 다시 그리려면 카드에서 재생성하세요.',
    generatingHint: ' 생성 중인 명절이 있습니다. 다른 항목은 만들 수 있습니다.',
    loadError: '명절 테마를 불러오지 못했습니다',
    retry: '다시 시도',
    loading: '불러오는 중…',
    showingToday: '오늘 표시 중',
    previewOn: '미리보기 중 · {left} 남음',
    previewOff: '10분 미리보기',
    enabledOn: '끄기',
    enabledOff: '켜기',
    datesTitle: '명절과 테마',
    lunarHint: '초록 = 음력',
    solarHint: '빨강 = 양력',
    startDay: '시작일',
    startMonth: '시작월',
    endDay: '종료일',
    endMonth: '종료월',
    year: '연도(양력)',
    lead: '미리 켜는 일수',
    after: '끝난 뒤 끄는 일수',
    saleTitle: '세일',
    salePercent: '세일 %',
    saleDays: '세일 일수',
    saleLead: '명절 전 세일 일수',
    emptySale: '비움: 명절 당일만',
    emptySaleHint: '비우면 명절 당일에만 세일합니다.',
    save: '저장',
    saving: '저장 중…',
    saved: '{name}을(를) 저장했습니다.',
    saveError: '저장하지 못했습니다',
    bannerNone: '이미지 없음',
    bannerCreate: 'GPT 배너 만들기',
    bannerRedo: '배너 다시 만들기',
    bannerBusy: '만드는 중…',
    previewNeedLogin: '미리보기는 관리자 로그인이 필요합니다.',
    previewOnNote: '{name}이(가) 이 관리자 계정으로 10분간 표시됩니다. 다른 고객은 보지 못합니다.',
    previewBlocked: '{name}이(가) 10분간 켜졌습니다. 새 창이 차단되었습니다 — 쇼핑몰을 여세요.',
    previewOffNote: '{name} 미리보기를 껐습니다.',
    openShop: '쇼핑몰 열기',
    intError: '일, 월, 일수는 정수여야 합니다.',
    saleLeadError: '명절 전 세일은 비우거나 0–60일입니다.',
    saleDaysError: '세일 일수는 비우거나 0–60일입니다.',
    salePctError: '세일 %는 0–50이어야 합니다.',
    windowOn: '켜짐: {date}',
    windowOff: '꺼짐: {date}',
    saleRange: '세일: {from}{to}',
  },
}

function draftFrom(row: PartnerHolidayOccasionAdmin): Draft {
  return {
    startDay: String(row.startDay),
    startMonth: String(row.startMonth),
    endDay: String(row.endDay),
    endMonth: String(row.endMonth),
    leadDays: String(row.leadDays),
    afterDays: String(row.afterDays),
    salePercent: String(row.salePercent),
    saleLeadDays: row.saleLeadDays ? String(row.saleLeadDays) : '',
    saleDays: row.saleDays ? String(row.saleDays) : '',
  }
}

function dateFieldClass(calendar: PartnerHolidayOccasionAdmin['calendar']) {
  return calendar === 'lunar'
    ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
    : 'border-red-400 bg-red-50 text-red-900'
}

export function PartnerHolidayThemeSettingsPanel({
  locale,
  t,
  partnerId,
  siteSlug,
  sectionId = 'partner-website-holiday-theme',
}: {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  siteSlug?: string | null
  sectionId?: string
}) {
  const copy = COPY[locale] ?? COPY.vi
  const [state, setState] = useState<PartnerHolidayThemeAdminState | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  const [previewLeft, setPreviewLeft] = useState(0)
  const [previewHref, setPreviewHref] = useState<string | null>(null)
  const [bannerWorking, setBannerWorking] = useState<string | null>(null)
  const releasedServerPreview = useRef(false)

  const apply = useCallback((data: PartnerHolidayThemeAdminState) => {
    setState(data)
    setDrafts(Object.fromEntries((data.occasions ?? []).map((row) => [row.code, draftFrom(row)])))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/messaging/partners/${partnerId}/holiday-theme?locale=${locale}`, {
        cache: 'no-store',
      })
      const json = (await res.json().catch(() => null)) as { state?: PartnerHolidayThemeAdminState; error?: string } | null
      if (!res.ok || !json?.state) throw new Error(json?.error || copy.loadError)
      apply(json.state)
    } catch (e) {
      setError((e as Error)?.message || copy.loadError)
    } finally {
      setLoading(false)
    }
  }, [apply, copy.loadError, locale, partnerId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem('nanoai-holiday-admin-preview')
        if (!raw) {
          setPreviewCode(null)
          setPreviewLeft(0)
          if (!releasedServerPreview.current) {
            releasedServerPreview.current = true
            void fetch(`/api/messaging/partners/${partnerId}/holiday-theme/preview`, { method: 'DELETE' }).catch(
              () => {
                releasedServerPreview.current = false
              }
            )
          }
          return
        }
        const data = JSON.parse(raw) as { code?: string; expiresAt?: number }
        if (!isPartnerHolidayThemeId(data.code) || !data.expiresAt || data.expiresAt <= Date.now()) {
          localStorage.removeItem('nanoai-holiday-admin-preview')
          setPreviewCode(null)
          setPreviewLeft(0)
          return
        }
        releasedServerPreview.current = false
        setPreviewCode(data.code)
        setPreviewLeft(data.expiresAt - Date.now())
      } catch {
        setPreviewCode(null)
        setPreviewLeft(0)
      }
    }
    sync()
    window.addEventListener('storage', sync)
    if (!previewCode) return () => window.removeEventListener('storage', sync)
    const timer = window.setInterval(sync, 1000)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', sync)
    }
  }, [partnerId, previewCode])

  const shopPath = siteSlug ? partnerWebsitePublicPath(siteSlug) : null

  const togglePreview = (code: string, name: string) => {
    if (!isPartnerHolidayThemeId(code)) return
    if (previewCode === code) {
      localStorage.removeItem('nanoai-holiday-admin-preview')
      setPreviewCode(null)
      setPreviewLeft(0)
      setPreviewHref(null)
      setNotice(copy.previewOffNote.replace('{name}', name))
      void fetch(`/api/messaging/partners/${partnerId}/holiday-theme/preview`, { method: 'DELETE' })
      return
    }
    const popup = window.open('', '_blank')
    void (async () => {
      try {
        const res = await fetch(`/api/messaging/partners/${partnerId}/holiday-theme/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const json = (await res.json().catch(() => null)) as {
          token?: string
          expires_at?: number
          error?: string
        } | null
        if (!res.ok || !json?.token) throw new Error(json?.error || copy.previewNeedLogin)
        const expiresAt = (json.expires_at ?? 0) * 1000
        localStorage.setItem(
          'nanoai-holiday-admin-preview',
          JSON.stringify({ code, expiresAt, grantToken: json.token })
        )
        const url = `${shopPath || '/'}?preview_holiday=${encodeURIComponent(code)}&preview_token=${encodeURIComponent(json.token)}`
        setPreviewCode(code)
        setPreviewLeft(expiresAt - Date.now())
        setPreviewHref(url)
        setError(null)
        if (popup && !popup.closed) {
          popup.location.replace(url)
          setNotice(copy.previewOnNote.replace('{name}', name))
          return
        }
        popup?.close()
        setNotice(copy.previewBlocked.replace('{name}', name))
      } catch (e) {
        popup?.close()
        localStorage.removeItem('nanoai-holiday-admin-preview')
        setPreviewCode(null)
        setPreviewLeft(0)
        setPreviewHref(null)
        setError((e as Error)?.message || copy.previewNeedLogin)
      }
    })()
  }

  const generatingAny = (state?.occasions ?? []).some((row) => row.bannerStatus === 'generating')

  useEffect(() => {
    if (!generatingAny) return
    const timer = window.setInterval(() => {
      void fetch(`/api/messaging/partners/${partnerId}/holiday-theme?locale=${locale}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((json: { state?: PartnerHolidayThemeAdminState }) => {
          if (json.state) apply(json.state)
        })
        .catch(() => undefined)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [apply, generatingAny, locale, partnerId])

  const generateBanners = async (code?: string, force = false) => {
    if (bannerWorking) return
    setBannerWorking(code ?? 'all')
    setNotice(null)
    setError(null)
    try {
      const res = await fetch(`/api/messaging/partners/${partnerId}/holiday-theme/banners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(code ? { code, force } : { force }),
      })
      const json = (await res.json().catch(() => null)) as { message?: string; error?: string } | null
      if (!res.ok) throw new Error(json?.error || copy.saveError)
      setNotice(json?.message || copy.saved.replace('{name}', 'banner'))
      const next = await fetch(`/api/messaging/partners/${partnerId}/holiday-theme?locale=${locale}`, {
        cache: 'no-store',
      })
      const nextJson = (await next.json().catch(() => null)) as { state?: PartnerHolidayThemeAdminState } | null
      if (nextJson?.state) apply(nextJson.state)
    } catch (e) {
      setError((e as Error)?.message || copy.saveError)
    } finally {
      setBannerWorking(null)
    }
  }

  const save = async (row: PartnerHolidayOccasionAdmin, extra?: { enabled: boolean }) => {
    const draft = drafts[row.code]
    if (!draft || savingId) return
    const startDay = Number(draft.startDay)
    const startMonth = Number(draft.startMonth)
    const endDay = Number(draft.endDay)
    const endMonth = Number(draft.endMonth)
    const lead = Number(draft.leadDays)
    const after = Number(draft.afterDays)
    const pct = Number(draft.salePercent)
    const saleLeadRaw = draft.saleLeadDays.trim()
    const saleDaysRaw = draft.saleDays.trim()
    const saleLead = saleLeadRaw === '' ? null : Number(saleLeadRaw)
    const saleDays = saleDaysRaw === '' ? null : Number(saleDaysRaw)
    if (![startDay, startMonth, endDay, endMonth, lead, after].every((n) => Number.isInteger(n))) {
      setError(copy.intError)
      return
    }
    if (saleLead !== null && (!Number.isInteger(saleLead) || saleLead < 0 || saleLead > 60)) {
      setError(copy.saleLeadError)
      return
    }
    if (saleDays !== null && (!Number.isInteger(saleDays) || saleDays < 0 || saleDays > 60)) {
      setError(copy.saleDaysError)
      return
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
      setError(copy.salePctError)
      return
    }
    setSavingId(row.code)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch(`/api/messaging/partners/${partnerId}/holiday-theme?locale=${locale}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: row.code,
          enabled: extra?.enabled ?? row.enabled,
          startDay,
          startMonth,
          endDay,
          endMonth,
          leadDays: lead,
          afterDays: after,
          salePercent: pct,
          saleLeadDays: saleLead,
          saleDays,
        }),
      })
      const json = (await res.json().catch(() => null)) as {
        state?: PartnerHolidayThemeAdminState
        error?: string
      } | null
      if (!res.ok || !json?.state) throw new Error(json?.error || copy.saveError)
      apply(json.state)
      setNotice(copy.saved.replace('{name}', row.name))
    } catch (e) {
      setError((e as Error)?.message || copy.saveError)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section id={sectionId} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5" aria-hidden />
            {t.holidayThemeTitle}
          </CardTitle>
          <CardDescription>{copy.hint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={bannerWorking === 'all'}
              onClick={() => void generateBanners()}
            >
              {bannerWorking === 'all' ? copy.generatingAll : copy.generateAll}
            </Button>
            <p className="text-xs text-muted-foreground">
              {copy.generateAllHint}
              {generatingAny ? copy.generatingHint : ''}
            </p>
          </div>
          {state?.scheduleNote ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">{state.scheduleNote}</p>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}{' '}
              <button type="button" onClick={() => void load()} className="font-medium underline">
                {copy.retry}
              </button>
            </div>
          ) : null}
          {notice ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {notice}{' '}
              {previewHref ? (
                <a href={previewHref} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  {copy.openShop}
                </a>
              ) : null}
            </div>
          ) : null}
          {loading && !state ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {copy.loading}
            </p>
          ) : (
            <ul className="space-y-4">
              {(state?.occasions ?? []).map((row) => {
                const draft = drafts[row.code]
                const busy = savingId === row.code
                const previewOn = previewCode === row.code
                return (
                  <li key={row.code} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold">
                          {row.name}
                          {row.showingToday ? (
                            <span className="ml-2 text-xs font-medium text-rose-800">{copy.showingToday}</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className={row.calendar === 'lunar' ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
                            {row.calendarLabel}
                          </span>
                          {' · '}
                          {row.summary}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.solarLabel}. {copy.windowOn.replace('{date}', row.windowOnLabel || '—')},{' '}
                          {copy.windowOff.replace('{date}', row.windowOffLabel || '—')}.
                        </p>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={previewOn}
                          className="mt-2 inline-flex items-center gap-2 text-sm text-rose-800"
                          onClick={() => togglePreview(row.code, row.name)}
                        >
                          <span className={`relative h-6 w-11 rounded-full ${previewOn ? 'bg-rose-700' : 'bg-gray-300'}`}>
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${previewOn ? 'left-5' : 'left-0.5'}`}
                            />
                          </span>
                          {previewOn
                            ? copy.previewOn.replace('{left}', formatPreviewRemaining(previewLeft))
                            : copy.previewOff}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {row.enabled ? copy.enabledOn : copy.enabledOff}
                        </span>
                        <Switch
                          checked={row.enabled}
                          disabled={busy}
                          onCheckedChange={() => void save(row, { enabled: !row.enabled })}
                          aria-label={row.enabled ? `${copy.enabledOn} ${row.name}` : `${copy.enabledOff} ${row.name}`}
                        />
                      </div>
                    </div>
                    {draft ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-xs font-medium">
                            {copy.datesTitle}
                            <span className={`ml-2 ${row.calendar === 'lunar' ? 'text-emerald-700' : 'text-red-700'}`}>
                              {row.calendar === 'lunar' ? copy.lunarHint : copy.solarHint}
                            </span>
                          </p>
                          <div className="mt-2 grid gap-3 sm:grid-cols-3">
                            <Label className="text-xs">
                              {copy.startDay} {row.calendar === 'lunar' ? '(âm)' : ''}
                              <Input
                                className={`mt-1 ${dateFieldClass(row.calendar)}`}
                                value={draft.startDay}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.code]: { ...prev[row.code]!, startDay: e.target.value },
                                  }))
                                }
                              />
                            </Label>
                            <Label className="text-xs">
                              {copy.startMonth}
                              <Input
                                className={`mt-1 ${dateFieldClass(row.calendar)}`}
                                value={draft.startMonth}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.code]: { ...prev[row.code]!, startMonth: e.target.value },
                                  }))
                                }
                              />
                            </Label>
                            <Label className="text-xs">
                              {copy.year}
                              <Input className="mt-1 border-red-200 bg-red-50/60" value={row.startYear ?? ''} readOnly />
                            </Label>
                            <Label className="text-xs">
                              {copy.endDay}
                              <Input
                                className={`mt-1 ${dateFieldClass(row.calendar)}`}
                                value={draft.endDay}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.code]: { ...prev[row.code]!, endDay: e.target.value },
                                  }))
                                }
                              />
                            </Label>
                            <Label className="text-xs">
                              {copy.endMonth}
                              <Input
                                className={`mt-1 ${dateFieldClass(row.calendar)}`}
                                value={draft.endMonth}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.code]: { ...prev[row.code]!, endMonth: e.target.value },
                                  }))
                                }
                              />
                            </Label>
                            <Label className="text-xs">
                              {copy.year}
                              <Input className="mt-1 border-red-200 bg-red-50/60" value={row.endYear ?? ''} readOnly />
                            </Label>
                            <Label className="text-xs">
                              {copy.lead}
                              <Input
                                className="mt-1"
                                value={draft.leadDays}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.code]: { ...prev[row.code]!, leadDays: e.target.value },
                                  }))
                                }
                              />
                              {row.windowOnLabel ? (
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                  {copy.windowOn.replace('{date}', row.windowOnLabel)}
                                </span>
                              ) : null}
                            </Label>
                            <Label className="text-xs">
                              {copy.after}
                              <Input
                                className="mt-1"
                                value={draft.afterDays}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.code]: { ...prev[row.code]!, afterDays: e.target.value },
                                  }))
                                }
                              />
                              {row.windowOffLabel ? (
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                  {copy.windowOff.replace('{date}', row.windowOffLabel)}
                                </span>
                              ) : null}
                            </Label>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium">{copy.saleTitle}</p>
                          <div className="mt-2 grid gap-3 sm:grid-cols-3">
                            <Label className="text-xs">
                              {copy.salePercent}
                              <Input
                                className="mt-1"
                                value={draft.salePercent}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.code]: { ...prev[row.code]!, salePercent: e.target.value },
                                  }))
                                }
                              />
                            </Label>
                            <Label className="text-xs">
                              {copy.saleDays}
                              <Input
                                className="mt-1"
                                value={draft.saleDays}
                                placeholder={copy.emptySale}
                                inputMode="numeric"
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.code]: { ...prev[row.code]!, saleDays: e.target.value },
                                  }))
                                }
                              />
                              {row.saleOnLabel ? (
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                  {copy.saleRange
                                    .replace('{from}', row.saleOnLabel)
                                    .replace(
                                      '{to}',
                                      row.saleOffLabel && row.saleOffLabel !== row.saleOnLabel
                                        ? ` – ${row.saleOffLabel}`
                                        : ''
                                    )}
                                </span>
                              ) : null}
                            </Label>
                            <Label className="text-xs">
                              {copy.saleLead}
                              <Input
                                className="mt-1"
                                value={draft.saleLeadDays}
                                placeholder={copy.emptySale}
                                inputMode="numeric"
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.code]: { ...prev[row.code]!, saleLeadDays: e.target.value },
                                  }))
                                }
                              />
                              <span className="mt-1 block text-[11px] text-muted-foreground">{copy.emptySaleHint}</span>
                            </Label>
                            <div className="flex items-end">
                              <Button type="button" disabled={busy} onClick={() => void save(row)}>
                                {busy ? copy.saving : copy.save}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 rounded-xl border bg-muted/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium">
                          Banner {row.bannerHeadline || row.name}
                          <span className="ml-2 font-normal text-muted-foreground">
                            · {row.bannerStatus || copy.bannerNone}
                          </span>
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={Boolean(bannerWorking) || row.bannerStatus === 'generating'}
                          onClick={() => void generateBanners(row.code, Boolean(row.bannerUrl))}
                        >
                          {row.bannerStatus === 'generating' || bannerWorking === row.code
                            ? copy.bannerBusy
                            : row.bannerUrl
                              ? copy.bannerRedo
                              : copy.bannerCreate}
                        </Button>
                      </div>
                      {row.bannerUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.bannerUrl}
                          alt={`Banner ${row.name}`}
                          className="mt-2 h-auto w-full rounded-lg border"
                        />
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">{row.bannerError || copy.bannerNone}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
