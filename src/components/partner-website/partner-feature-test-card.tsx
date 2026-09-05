'use client'

import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSiteSaleTestPhase } from '@/lib/partner-website/promotions/partner-feature-test'

type FeatureTestPayload = {
  testEmail: string
  adminEmail: string | null
  testDurationMinutes: number
  siteSlug: string | null
  homePath: string | null
  cartPath: string | null
  birthday: {
    enabled: boolean
    expiresAt: string | null
    canApplyOnWeb: boolean
    discountPercent: number
    testEmailSent?: boolean
    testEmailError?: string | null
  }
  siteSale: {
    enabled: boolean
    expiresAt: string | null
    phase: PartnerSiteSaleTestPhase
    canApplyOnWeb: boolean
    discountPercent: number
  }
}

const COPY: Record<
  WebLocale,
  {
    title: string
    hint: string
    emailLabel: string
    emailHint: string
    birthdayBadge: string
    birthdayTitle: string
    birthdayDesc: string
    saleBadge: string
    saleTitle: string
    saleDesc: string
    phaseLabel: string
    phaseHint: string
    teaser: string
    active: string
    enable: string
    save: string
    disable: string
    saving: string
    status: string
    on: string
    off: string
    expires: string
    email: string
    discount: string
    emailMissing: string
    birthdayNote: string
    saleNote: string
    openHome: string
    openCart: string
    openSale: string
    birthdayOn: string
    birthdayOff: string
    saleOn: string
    saleOff: string
    needEmail: string
    loadError: string
    saveError: string
    emailSent: string
    emailFail: string
  }
> = {
  vi: {
    title: 'Test & thử nghiệm chương trình',
    hint: 'Bật test để tài khoản khách đăng nhập bằng email dưới đây xem website giống trạng thái thật của chương trình. Tự tắt sau 10 phút.',
    emailLabel: 'Email tài khoản test (dùng chung)',
    emailHint: 'Dùng email của tài khoản khách bạn sẽ đăng nhập trên web để test CMSN hoặc Sale lịch.',
    birthdayBadge: 'CMSN khách hàng',
    birthdayTitle: 'Giả lập tuần lễ sinh nhật',
    birthdayDesc:
      'Bật test để tài khoản web đăng nhập bằng email test chạy giống khách thật trong chương trình CMSN: nhận email, thấy banner, giá web giảm và giỏ/đơn cũng giảm thật. Test tự tắt sau 10 phút.',
    saleBadge: 'Sale lịch site-wide',
    saleTitle: 'Giả lập ngày sale (6/6, 8/8…)',
    saleDesc:
      'Có 2 chế độ test — chọn trước khi bật (hoặc bấm Lưu test khi đang bật để đổi phase): Teaser giả lập giai đoạn chờ sale (T-3 → T-1, banner countdown, giá chưa giảm); Active giả lập đúng ngày sale (giá giảm thật trên web, giỏ hàng và checkout). Test tự tắt sau 10 phút.',
    phaseLabel: 'Phase test',
    phaseHint:
      'Teaser: giống khách đang chờ sale (3 ngày trước ngày sale) — banner, badge, giá gốc + tiết kiệm dự kiến. Active: giống đúng ngày sale — giá giảm thật, cart/checkout áp dụng giảm.',
    teaser: 'Teaser — chờ sale (T-3)',
    active: 'Active — đang sale',
    enable: 'Bật test',
    save: 'Lưu test',
    disable: 'Tắt test',
    saving: 'Đang lưu...',
    status: 'Trạng thái',
    on: 'Đang bật',
    off: 'Đang tắt',
    expires: 'Tự tắt lúc',
    email: 'Email test',
    discount: 'Giảm giá test',
    emailMissing: 'Chưa nhập email test',
    birthdayNote: 'Khi bật test CMSN, email test sẽ được gửi ngay nếu SMTP đang cấu hình. Đăng nhập web bằng đúng email test ở trên.',
    saleNote:
      'Feed Google/Meta không bị ảnh hưởng bởi test — chỉ tài khoản web đăng nhập bằng email test mới thấy sale giả lập. Nhãn sự kiện sẽ có tiền tố [Test] trên banner.',
    openHome: 'Mở trang chủ để test giá',
    openCart: 'Mở giỏ hàng để test thanh toán',
    openSale: 'Cấu hình sale site-wide (Khuyến mãi)',
    birthdayOn: 'Đã bật test CMSN trong {minutes} phút. Tài khoản web đăng nhập bằng email {email} sẽ chạy giống khách thật trong tuần sinh nhật.',
    birthdayOff: 'Đã tắt test CMSN.',
    saleOn: 'Đã bật test Sale lịch ({phase}) trong {minutes} phút. Tài khoản web đăng nhập bằng email {email} sẽ thấy banner, badge và giá giảm giống ngày sale thật.',
    saleOff: 'Đã tắt test Sale lịch.',
    needEmail: 'Vui lòng nhập email tài khoản test.',
    loadError: 'Không tải được cài đặt thử nghiệm.',
    saveError: 'Không lưu được cài đặt thử nghiệm.',
    emailSent: ' Email CMSN test đã gửi tới {email}.',
    emailFail: ' Bật test thành công nhưng chưa gửi được email test: {error}',
  },
  en: {
    title: 'Test promotion programs',
    hint: 'Turn on a test so the customer account with the email below sees the live program state. It turns off after 10 minutes.',
    emailLabel: 'Shared test account email',
    emailHint: 'Use the customer email you will sign in with on the shop to test birthday or calendar sale.',
    birthdayBadge: 'Customer birthday',
    birthdayTitle: 'Simulate birthday week',
    birthdayDesc:
      'The signed-in test account behaves like a real birthday-week customer: email, banner, web prices, and cart/checkout. The test turns off after 10 minutes.',
    saleBadge: 'Site-wide calendar sale',
    saleTitle: 'Simulate a sale day (6/6, 8/8…)',
    saleDesc:
      'Two modes — pick one before turning it on (or Save test to change phase): Teaser is the wait window (T-3 to T-1, countdown, prices unchanged); Active is the sale day (real discounted prices on web, cart, and checkout). Turns off after 10 minutes.',
    phaseLabel: 'Test phase',
    phaseHint:
      'Teaser: like a shopper waiting for the sale — banner, badge, list price plus expected savings. Active: sale day — discounted prices apply in cart and checkout.',
    teaser: 'Teaser — waiting (T-3)',
    active: 'Active — sale is on',
    enable: 'Turn on test',
    save: 'Save test',
    disable: 'Turn off test',
    saving: 'Saving...',
    status: 'Status',
    on: 'On',
    off: 'Off',
    expires: 'Turns off at',
    email: 'Test email',
    discount: 'Test discount',
    emailMissing: 'No test email yet',
    birthdayNote: 'Turning on the birthday test sends the email immediately if SMTP is configured. Sign in on the shop with that email.',
    saleNote:
      'Google/Meta feeds are not affected — only the shop account signed in with the test email sees the simulated sale. Event labels get a [Test] prefix.',
    openHome: 'Open the homepage to test prices',
    openCart: 'Open the cart to test checkout',
    openSale: 'Calendar sale settings',
    birthdayOn: 'Birthday test is on for {minutes} minutes. The shop account signed in as {email} behaves like a real birthday-week customer.',
    birthdayOff: 'Birthday test is off.',
    saleOn: 'Calendar sale test ({phase}) is on for {minutes} minutes. The shop account signed in as {email} sees banners, badges, and prices like a real sale day.',
    saleOff: 'Calendar sale test is off.',
    needEmail: 'Enter a test account email.',
    loadError: 'Could not load test settings.',
    saveError: 'Could not save test settings.',
    emailSent: ' Birthday test email sent to {email}.',
    emailFail: ' Test is on but the email was not sent: {error}',
  },
  zh: {
    title: '测试促销活动',
    hint: '开启后，使用下方邮箱登录的顾客账号会看到真实活动状态。10 分钟后自动关闭。',
    emailLabel: '共用测试邮箱',
    emailHint: '填写你将在店铺登录的顾客邮箱，用于测试生日或日历促销。',
    birthdayBadge: '顾客生日',
    birthdayTitle: '模拟生日周',
    birthdayDesc: '测试账号会像真实生日周顾客一样：收到邮件、看到横幅、网页和购物车/结账都打折。10 分钟后自动关闭。',
    saleBadge: '全站日历促销',
    saleTitle: '模拟促销日（6/6、8/8…）',
    saleDesc:
      '两种模式——开启前先选择（或在开启时点保存以切换）：预告为等待期（T-3 到 T-1，倒计时，价格不变）；进行中为促销当天（网页、购物车、结账真实降价）。10 分钟后自动关闭。',
    phaseLabel: '测试阶段',
    phaseHint: '预告：像正在等待促销的顾客。进行中：促销当天，购物车和结账应用折扣。',
    teaser: '预告 — 等待促销（T-3）',
    active: '进行中 — 正在促销',
    enable: '开启测试',
    save: '保存测试',
    disable: '关闭测试',
    saving: '保存中...',
    status: '状态',
    on: '已开启',
    off: '已关闭',
    expires: '自动关闭于',
    email: '测试邮箱',
    discount: '测试折扣',
    emailMissing: '尚未填写测试邮箱',
    birthdayNote: '开启生日测试后，若已配置 SMTP 会立即发送邮件。请用该邮箱登录店铺。',
    saleNote: 'Google/Meta 商品 Feed 不受影响——只有用测试邮箱登录的店铺账号会看到模拟促销。活动标签带 [Test] 前缀。',
    openHome: '打开首页测试价格',
    openCart: '打开购物车测试结账',
    openSale: '日历促销设置',
    birthdayOn: '生日测试已开启 {minutes} 分钟。使用 {email} 登录的店铺账号会像真实生日周顾客一样。',
    birthdayOff: '生日测试已关闭。',
    saleOn: '日历促销测试（{phase}）已开启 {minutes} 分钟。使用 {email} 登录的店铺账号会看到与真实促销日相同的横幅、角标和价格。',
    saleOff: '日历促销测试已关闭。',
    needEmail: '请输入测试账号邮箱。',
    loadError: '无法加载测试设置。',
    saveError: '无法保存测试设置。',
    emailSent: ' 生日测试邮件已发送至 {email}。',
    emailFail: ' 测试已开启但邮件未发送：{error}',
  },
  ja: {
    title: 'プロモーションのテスト',
    hint: '下のメールでログインした顧客アカウントが本番と同じ状態を見ます。10分で自動オフになります。',
    emailLabel: '共通テスト用メール',
    emailHint: 'ショップにログインする顧客メールを入力し、誕生日またはカレンダーセールをテストします。',
    birthdayBadge: '顧客の誕生日',
    birthdayTitle: '誕生日週間をシミュレート',
    birthdayDesc: 'テストアカウントは本番の誕生日週間と同じです。メール、バナー、価格、カート/決済に割引が入ります。10分でオフ。',
    saleBadge: 'サイト全体のカレンダーセール',
    saleTitle: 'セール日をシミュレート（6/6、8/8…）',
    saleDesc:
      '2モード — オンにする前に選択（または保存で切替）：ティーザーは待機期間（T-3〜T-1、カウントダウン、価格据え置き）。アクティブはセール当日（Web・カート・決済で実割引）。10分でオフ。',
    phaseLabel: 'テストフェーズ',
    phaseHint: 'ティーザー：セール待ちの顧客と同じ。アクティブ：セール当日、カートと決済に割引。',
    teaser: 'ティーザー — セール待ち（T-3）',
    active: 'アクティブ — セール中',
    enable: 'テストをオン',
    save: 'テストを保存',
    disable: 'テストをオフ',
    saving: '保存中...',
    status: '状態',
    on: 'オン',
    off: 'オフ',
    expires: '自動オフ',
    email: 'テストメール',
    discount: 'テスト割引',
    emailMissing: 'テストメール未入力',
    birthdayNote: '誕生日テストをオンにすると、SMTP設定済みならメールをすぐ送ります。そのメールでショップにログインしてください。',
    saleNote: 'Google/Metaフィードは影響しません。テストメールでログインしたアカウントだけが模擬セールを見ます。ラベルに [Test] が付きます。',
    openHome: 'ホームで価格を確認',
    openCart: 'カートで決済を確認',
    openSale: 'カレンダーセール設定',
    birthdayOn: '誕生日テストを{minutes}分間オンにしました。{email}でログインしたショップアカウントは本番の誕生日週間と同じです。',
    birthdayOff: '誕生日テストをオフにしました。',
    saleOn: 'カレンダーセールテスト（{phase}）を{minutes}分間オンにしました。{email}でログインすると本番のセール日と同じバナー・バッジ・価格になります。',
    saleOff: 'カレンダーセールテストをオフにしました。',
    needEmail: 'テスト用メールを入力してください。',
    loadError: 'テスト設定を読み込めませんでした。',
    saveError: 'テスト設定を保存できませんでした。',
    emailSent: ' 誕生日テストメールを {email} に送信しました。',
    emailFail: ' テストはオンですがメール未送信: {error}',
  },
  ko: {
    title: '프로모션 프로그램 테스트',
    hint: '아래 이메일로 로그인한 고객 계정이 실제 프로그램 상태를 봅니다. 10분 후 자동으로 꺼집니다.',
    emailLabel: '공통 테스트 이메일',
    emailHint: '생일 또는 캘린더 세일을 테스트할 때 쇼핑몰에 로그인할 고객 이메일을 입력하세요.',
    birthdayBadge: '고객 생일',
    birthdayTitle: '생일 주간 시뮬레이션',
    birthdayDesc: '테스트 계정은 실제 생일 주간 고객과 같습니다. 이메일, 배너, 웹 가격, 장바구니/결제가 할인됩니다. 10분 후 꺼집니다.',
    saleBadge: '사이트 전체 캘린더 세일',
    saleTitle: '세일 데이 시뮬레이션 (6/6, 8/8…)',
    saleDesc:
      '두 모드 — 켜기 전에 선택(또는 저장으로 단계 변경): 티저는 대기 구간(T-3~T-1, 카운트다운, 가격 유지), 액티브는 세일 당일(웹·장바구니·결제 실제 할인). 10분 후 꺼집니다.',
    phaseLabel: '테스트 단계',
    phaseHint: '티저: 세일을 기다리는 고객과 같음. 액티브: 세일 당일, 장바구니와 결제에 할인 적용.',
    teaser: '티저 — 세일 대기 (T-3)',
    active: '액티브 — 세일 진행',
    enable: '테스트 켜기',
    save: '테스트 저장',
    disable: '테스트 끄기',
    saving: '저장 중...',
    status: '상태',
    on: '켜짐',
    off: '꺼짐',
    expires: '자동 종료',
    email: '테스트 이메일',
    discount: '테스트 할인',
    emailMissing: '테스트 이메일 없음',
    birthdayNote: '생일 테스트를 켜면 SMTP가 설정된 경우 바로 메일을 보냅니다. 해당 이메일로 쇼핑몰에 로그인하세요.',
    saleNote: 'Google/Meta 피드는 영향을 받지 않습니다. 테스트 이메일로 로그인한 계정만 시뮬레이션 세일을 봅니다. 이벤트 라벨에 [Test]가 붙습니다.',
    openHome: '홈에서 가격 확인',
    openCart: '장바구니에서 결제 확인',
    openSale: '캘린더 세일 설정',
    birthdayOn: '생일 테스트를 {minutes}분 동안 켰습니다. {email}로 로그인한 쇼핑몰 계정은 실제 생일 주간과 같습니다.',
    birthdayOff: '생일 테스트를 껐습니다.',
    saleOn: '캘린더 세일 테스트({phase})를 {minutes}분 동안 켰습니다. {email}로 로그인하면 실제 세일 데이와 같은 배너, 배지, 가격이 보입니다.',
    saleOff: '캘린더 세일 테스트를 껐습니다.',
    needEmail: '테스트 계정 이메일을 입력하세요.',
    loadError: '테스트 설정을 불러오지 못했습니다.',
    saveError: '테스트 설정을 저장하지 못했습니다.',
    emailSent: ' 생일 테스트 메일을 {email}(으)로 보냈습니다.',
    emailFail: ' 테스트는 켜졌지만 메일을 보내지 못했습니다: {error}',
  },
}

function formatExpires(value: string | null, locale: WebLocale): string | null {
  if (!value) return null
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return null
  return at.toLocaleString(locale === 'vi' ? 'vi-VN' : locale)
}

type Props = {
  partnerId: string
  locale: WebLocale
  siteSlug?: string | null
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}

export function PartnerFeatureTestCard({ partnerId, locale, siteSlug, onToast }: Props) {
  const t = COPY[locale] ?? COPY.en
  const [data, setData] = useState<FeatureTestPayload | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [phase, setPhase] = useState<PartnerSiteSaleTestPhase>('active')
  const [loading, setLoading] = useState(true)
  const [savingBirthday, setSavingBirthday] = useState(false)
  const [savingSale, setSavingSale] = useState(false)
  const [birthdayMessage, setBirthdayMessage] = useState<string | null>(null)
  const [saleMessage, setSaleMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saleError, setSaleError] = useState<string | null>(null)

  const api = `/api/messaging/partners/${encodeURIComponent(partnerId)}/feature-test`

  const applyPayload = useCallback((json: FeatureTestPayload) => {
    setData(json)
    setTestEmail(json.testEmail || json.adminEmail || '')
    setPhase(json.siteSale.phase || 'active')
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(api)
        const json = (await res.json().catch(() => null)) as FeatureTestPayload | null
        if (!res.ok || !json) throw new Error(t.loadError)
        if (active) applyPayload(json)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : t.loadError)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [api, applyPayload, t.loadError])

  async function save(kind: 'birthday' | 'site-sale', enabled: boolean) {
    const email = testEmail.trim()
    if (enabled && !email) {
      setError(t.needEmail)
      return
    }
    if (kind === 'birthday') {
      setSavingBirthday(true)
      setBirthdayMessage(null)
      setError(null)
    } else {
      setSavingSale(true)
      setSaleMessage(null)
      setSaleError(null)
    }
    try {
      const res = await fetch(api, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          enabled,
          testEmail: email,
          phase,
        }),
      })
      const json = (await res.json().catch(() => null)) as FeatureTestPayload & { error?: string } | null
      if (!res.ok || !json || json.error) {
        throw new Error(json?.error === 'test_email_required' ? t.needEmail : t.saveError)
      }
      applyPayload(json)
      const minutes = json.testDurationMinutes || 10
      if (kind === 'birthday') {
        const emailNote = json.birthday.testEmailSent
          ? t.emailSent.replace('{email}', json.testEmail || email)
          : json.birthday.testEmailError
            ? t.emailFail.replace('{error}', json.birthday.testEmailError)
            : ''
        const message = json.birthday.enabled
          ? t.birthdayOn.replace('{minutes}', String(minutes)).replace('{email}', json.testEmail || email) + emailNote
          : t.birthdayOff
        setBirthdayMessage(message)
        onToast?.(message)
      } else {
        if (enabled && !json.siteSale.enabled) {
          setSaleError(t.saveError)
          return
        }
        const phaseLabel = json.siteSale.phase === 'teaser' ? 'teaser' : 'active'
        const message = json.siteSale.enabled
          ? t.saleOn
              .replace('{phase}', phaseLabel)
              .replace('{minutes}', String(minutes))
              .replace('{email}', json.testEmail || email)
          : t.saleOff
        setSaleMessage(message)
        onToast?.(message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t.saveError
      if (kind === 'birthday') setError(message)
      else setSaleError(message)
      onToast?.(message, 'destructive')
    } finally {
      setSavingBirthday(false)
      setSavingSale(false)
    }
  }

  const birthdayOn = data?.birthday.enabled === true
  const saleOn = data?.siteSale.enabled === true
  const homeHref = data?.homePath || (siteSlug ? `/site/${encodeURIComponent(siteSlug)}` : null)
  const cartHref = data?.cartPath || (siteSlug ? `/site/${encodeURIComponent(siteSlug)}/cart` : null)
  const birthdayExpires = formatExpires(data?.birthday.expiresAt ?? null, locale)
  const saleExpires = formatExpires(data?.siteSale.expiresAt ?? null, locale)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Label htmlFor="pw-feature-test-email">{t.emailLabel}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{t.emailHint}</p>
          <Input
            id="pw-feature-test-email"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            disabled={savingBirthday || savingSale}
            className="mt-2 max-w-xl"
            placeholder="test@example.com"
          />
        </div>

        {birthdayMessage ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {birthdayMessage}
          </div>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700">
                {t.birthdayBadge}
              </div>
              <h3 className="mt-3 text-lg font-bold">{t.birthdayTitle}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t.birthdayDesc}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button type="button" onClick={() => void save('birthday', true)} disabled={loading || savingBirthday}>
                {savingBirthday ? t.saving : birthdayOn ? t.save : t.enable}
              </Button>
              {birthdayOn ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void save('birthday', false)}
                  disabled={loading || savingBirthday}
                >
                  {t.disable}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-5 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">{t.status}</p>
              <p className={birthdayOn ? 'font-bold text-green-700' : 'font-bold'}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : birthdayOn ? t.on : t.off}
              </p>
              {birthdayOn && birthdayExpires ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.expires} {birthdayExpires}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">{t.email}</p>
              <p className={data?.birthday.canApplyOnWeb ? 'font-bold text-green-700' : 'font-bold text-amber-700'}>
                {data?.testEmail || testEmail || t.emailMissing}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">{t.discount}</p>
              <p className="font-bold">{data?.birthday.discountPercent ?? 10}%</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {t.birthdayNote}
          </div>
        </section>

        {saleMessage ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {saleMessage}
          </div>
        ) : null}
        {saleError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {saleError}
          </div>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">
                {t.saleBadge}
              </div>
              <h3 className="mt-3 text-lg font-bold">{t.saleTitle}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t.saleDesc}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button type="button" onClick={() => void save('site-sale', true)} disabled={loading || savingSale}>
                {savingSale ? t.saving : saleOn ? t.save : t.enable}
              </Button>
              {saleOn ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void save('site-sale', false)}
                  disabled={loading || savingSale}
                >
                  {t.disable}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-5">
            <p className="text-sm font-semibold">{t.phaseLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.phaseHint}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={phase === 'teaser' ? 'default' : 'outline'}
                onClick={() => setPhase('teaser')}
                disabled={savingSale}
              >
                {t.teaser}
              </Button>
              <Button
                type="button"
                variant={phase === 'active' ? 'default' : 'outline'}
                onClick={() => setPhase('active')}
                disabled={savingSale}
              >
                {t.active}
              </Button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">{t.status}</p>
              <p className={saleOn ? 'font-bold text-green-700' : 'font-bold'}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : saleOn ? t.on : t.off}
              </p>
              {saleOn && saleExpires ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.expires} {saleExpires}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Phase</p>
              <p className="font-bold">{data?.siteSale.phase === 'teaser' ? 'Teaser' : 'Active'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">{t.email}</p>
              <p className={data?.siteSale.canApplyOnWeb ? 'font-bold text-green-700' : 'font-bold text-amber-700'}>
                {data?.testEmail || testEmail || t.emailMissing}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">{t.discount}</p>
              <p className="font-bold">{data?.siteSale.discountPercent ?? 0}%</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {t.saleNote}
          </div>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {homeHref ? (
            <Button asChild>
              <a href={homeHref} target="_blank" rel="noreferrer">
                {t.openHome}
              </a>
            </Button>
          ) : null}
          {cartHref ? (
            <Button asChild variant="outline">
              <a href={cartHref} target="_blank" rel="noreferrer">
                {t.openCart}
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <a href="#partner-website-promotions">{t.openSale}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
