import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ADMIN_CURRICULUM_TEACHER_STATS_LIMIT,
  fetchAdminCurriculumTeacherStats,
} from '@/lib/db/admin-curriculum-teacher-stats-pg'
import { curriculumBuyerSourceView } from '@/lib/curriculum/curriculum-buyer-source'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { ApiStatsDateFilter } from '../api-stats/api-stats-date-filter'
import { ictDayEndIso, ictDayStartIso, ictYearStartYmd, ictYmd } from '../api-stats/ict-date'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: 'Thống kê giáo viên',
  description: 'Số người mở giáo trình, tạo giáo trình, giáo viên đã mua gói, và nguồn khách.',
  path: '/admin/curriculum-teacher-stats',
  noIndex: true,
})

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function AdminCurriculumTeacherStatsPage({
  searchParams = {},
}: {
  searchParams?: { from?: string; to?: string; q?: string }
}) {
  const uiLocale = getCurrentWebLocale()
  const localeTag =
    uiLocale === 'en' ? 'en-US' : uiLocale === 'zh' ? 'zh-CN' : uiLocale === 'ja' ? 'ja-JP' : uiLocale === 'ko' ? 'ko-KR' : 'vi-VN'
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const today = ictYmd()
  const fromDate = YMD_RE.test(searchParams.from ?? '') ? String(searchParams.from) : ictYearStartYmd()
  const toDate = YMD_RE.test(searchParams.to ?? '') ? String(searchParams.to) : today
  const query = (searchParams.q ?? '').trim().slice(0, 80)

  const result = await fetchAdminCurriculumTeacherStats({
    fromIso: ictDayStartIso(fromDate),
    toIso: ictDayEndIso(toDate),
    query,
  })

  const formatDateTime = (iso: string) => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat(localeTag, {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const sourceLabel = (source: string, detail: string) => {
    const view = curriculumBuyerSourceView(source, detail)
    const title =
      view.kind === 'facebook'
        ? 'Facebook'
        : view.kind === 'tiktok'
          ? 'TikTok'
          : view.kind === 'google_ads'
            ? 'Google Ads'
            : view.kind === 'direct'
              ? tr('Trực tiếp', 'Direct', '直接访问', '直接', '직접')
              : view.kind === 'other'
                ? view.text || tr('Khác', 'Other', '其他', 'その他', '기타')
                : tr('Chưa ghi', 'Not recorded', '未记录', '未記録', '기록 없음')
    return { title, extra: view.extra, muted: view.kind === 'unknown' }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {tr('Thống kê giáo viên', 'Teacher stats', '教师统计', '教師の統計', '교사 통계')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            'Mở giáo trình và tạo giáo trình là hành vi thêm giỏ. Mua gói giáo viên là hành vi mua hàng — tài khoản đã mua gói được tính là giáo viên. Một người có thể nằm ở nhiều cột. Giờ theo Việt Nam. Tài khoản dùng thử khách không tính.',
            'Opening a curriculum and creating a curriculum count as add to cart. Buying a teacher plan counts as a purchase — those accounts are teachers. One person can appear in more than one column. Times are Vietnam time. Guest trial accounts are excluded.',
            '打开课程和创建课程算作加入购物车。购买教师套餐算作购买——这些账号计为教师。一个人可以出现在多列。时间为越南时间。不含访客试用账号。',
            '教材を開くことと作成することはカート追加です。教師プランの購入は購入で、そのアカウントを教師として数えます。1人が複数の列に入ることがあります。時刻はベトナム時間。ゲスト試用は除きます。',
            '교육과정을 열거나 만드는 것은 장바구니 담기입니다. 교사 요금제 구매는 구매이며, 그 계정은 교사로 셉니다. 한 사람이 여러 열에 나올 수 있습니다. 시간은 베트남 시간. 게스트 체험 계정은 제외합니다.',
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(
            'Số người mở giáo trình theo lần mở gần nhất của từng giáo trình. Tạo giáo trình đếm giáo trình tài khoản đó đã lưu. Mua gói đếm mỗi lần trừ phí tháng giáo viên.',
            'Open counts use the latest open time kept for each curriculum. Create counts curricula that account saved. Plan purchases count each monthly teacher charge.',
            '打开人数按每份课程保留的最近打开时间计算。创建人数按该账号保存的课程计算。套餐购买按每次教师月费扣款计算。',
            '開いた人数は、各教材に残している最新の開いた時刻です。作成は保存した教材数です。プラン購入は教師の月額課金の回数です。',
            '열기 수는 교육과정마다 남겨 둔 최근 열람 시각입니다. 만들기는 그 계정이 저장한 교육과정 수입니다. 요금제 구매는 교사 월 요금이 빠진 횟수입니다.',
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(
            'Cột Nguồn là kênh lúc người mua thêm giỏ (tạo hoặc mở giáo trình): Facebook (gồm Instagram), TikTok, Google Ads, hoặc trang đưa khách tới (Google, Zalo…). Trực tiếp là không thấy quảng cáo hay trang giới thiệu. Tài khoản thêm giỏ trước khi ghi kênh hiện Chưa ghi. Một người có nhiều kênh thì giữ kênh quảng cáo, rồi tới kênh sớm nhất.',
            'The Source column is the channel when the buyer added to cart (created or opened a curriculum): Facebook (including Instagram), TikTok, Google Ads, or the site that sent them (Google, Zalo…). Direct means no ad and no referring site. Accounts that added to cart before this was saved show Not recorded. If one person has several channels, the ad channel is kept, then the earliest one.',
            '「来源」列是购买者加入购物车时的渠道（创建或打开课程）：Facebook（含 Instagram）、TikTok、Google Ads，或带来客户的网站（Google、Zalo…）。直接访问表示没有广告也没有来源网站。开始记录之前加入购物车的账号显示未记录。一个人有多个渠道时保留广告渠道，其次保留最早的渠道。',
            '「流入元」列は購入者がカートに入れたときの経路です（教材の作成または開く）。Facebook（Instagram を含む）、TikTok、Google Ads、または送客元（Google、Zalo…）。直接は広告も参照元もない場合です。記録を始める前のカート追加は未記録です。複数の経路がある人は広告の経路を残し、次に最も早い経路を残します。',
            '출처 열은 구매자가 장바구니에 담은 경로입니다(교육과정 만들기 또는 열기). Facebook(Instagram 포함), TikTok, Google Ads, 또는 들여보낸 사이트(Google, Zalo…). 직접은 광고와 참조 사이트가 없다는 뜻입니다. 기록을 시작하기 전에 담은 계정은 기록 없음입니다. 한 사람에게 경로가 여러 개면 광고 경로를 남기고, 그다음 가장 이른 경로를 남깁니다.',
          )}
        </p>
      </div>

      <ApiStatsDateFilter
        defaultFrom={fromDate}
        defaultTo={toDate}
        basePath="/admin/curriculum-teacher-stats"
        extraQuery={query ? { q: query } : undefined}
      />

      <form method="get" action="/admin/curriculum-teacher-stats" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="from" value={fromDate} />
        <input type="hidden" name="to" value={toDate} />
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <label htmlFor="curriculum-teacher-stats-q" className="text-xs text-muted-foreground">
            {tr('Tìm tài khoản', 'Find an account', '查找账号', 'アカウントを検索', '계정 검색')}
          </label>
          <Input
            id="curriculum-teacher-stats-q"
            name="q"
            defaultValue={query}
            placeholder={tr('Email hoặc tên', 'Email or name', '邮箱或姓名', 'メールまたは名前', '이메일 또는 이름')}
          />
        </div>
        <Button type="submit" size="sm">
          {tr('Tìm', 'Search', '搜索', '検索', '검색')}
        </Button>
      </form>

      {result.error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">
              {tr('Lỗi', 'Error', '错误', 'エラー', '오류')}: {result.error}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Người tạo giáo trình', 'People who created a curriculum', '创建课程的人数', '教材を作成した人数', '교육과정을 만든 사람')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{result.summary.creators}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    `${result.summary.curricula} giáo trình · thêm giỏ`,
                    `${result.summary.curricula} curricula · add to cart`,
                    `${result.summary.curricula} 份课程 · 加入购物车`,
                    `${result.summary.curricula} 件の教材 · カート追加`,
                    `교육과정 ${result.summary.curricula}개 · 장바구니`,
                  )}
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Người mở giáo trình', 'People who opened a curriculum', '打开课程的人数', '教材を開いた人数', '교육과정을 연 사람')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{result.summary.openers}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    `${result.summary.opens} lượt mở · thêm giỏ`,
                    `${result.summary.opens} opens · add to cart`,
                    `${result.summary.opens} 次打开 · 加入购物车`,
                    `${result.summary.opens} 回開いた · カート追加`,
                    `열기 ${result.summary.opens}회 · 장바구니`,
                  )}
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Giáo viên mua gói', 'Teachers who bought a plan', '已购买套餐的教师', 'プランを購入した教師', '요금제를 산 교사')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{result.summary.teachers}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    `${result.summary.purchases} lần mua · mua hàng`,
                    `${result.summary.purchases} purchases`,
                    `${result.summary.purchases} 次购买`,
                    `${result.summary.purchases} 回の購入`,
                    `구매 ${result.summary.purchases}회`,
                  )}
                </p>
              </CardHeader>
            </Card>
          </div>

          {result.truncated ? (
            <p className="text-sm text-muted-foreground">
              {tr(
                `Đang hiện ${ADMIN_CURRICULUM_TEACHER_STATS_LIMIT} tài khoản mới nhất. Số người ở trên tính trên cả khoảng ngày.`,
                `Showing the ${ADMIN_CURRICULUM_TEACHER_STATS_LIMIT} most recent accounts. The counts above cover the whole date range.`,
                `正在显示最近 ${ADMIN_CURRICULUM_TEACHER_STATS_LIMIT} 个账号。上方人数按整个日期范围计算。`,
                `新しい順に ${ADMIN_CURRICULUM_TEACHER_STATS_LIMIT} 件を表示。上の人数は期間全体です。`,
                `최근 계정 ${ADMIN_CURRICULUM_TEACHER_STATS_LIMIT}개를 표시합니다. 위 인원 수는 전체 기간입니다.`,
              )}
            </p>
          ) : null}

          <Card>
            <CardContent className="mt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('Tài khoản', 'Account', '账号', 'アカウント', '계정')}</TableHead>
                    <TableHead>{tr('Phân loại', 'Kind', '分类', '区分', '구분')}</TableHead>
                    <TableHead>{tr('Nguồn', 'Source', '来源', '流入元', '출처')}</TableHead>
                    <TableHead className="text-right">
                      {tr('Tạo giáo trình', 'Created', '创建课程', '作成', '만들기')}
                    </TableHead>
                    <TableHead className="text-right">
                      {tr('Mở giáo trình', 'Opened', '打开课程', '開いた', '열기')}
                    </TableHead>
                    <TableHead className="text-right">
                      {tr('Mua gói', 'Plans bought', '购买套餐', 'プラン購入', '요금제 구매')}
                    </TableHead>
                    <TableHead>{tr('Lần gần nhất', 'Latest activity', '最近一次', '最新', '최근 활동')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        {tr(
                          'Chưa có tài khoản mở, tạo giáo trình hoặc mua gói trong khoảng này.',
                          'No accounts opened or created a curriculum, or bought a teacher plan, in this range.',
                          '该范围内没有账号打开、创建课程或购买教师套餐。',
                          'この期間に教材を開いた、作成した、または教師プランを購入したアカウントはありません。',
                          '이 기간에 교육과정을 열거나 만들거나 교사 요금제를 산 계정이 없습니다.',
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    result.rows.map((row) => {
                      const isTeacher = row.purchaseCount > 0
                      const source = sourceLabel(row.buyerSource, row.buyerSourceDetail)
                      return (
                        <TableRow key={row.userId}>
                          <TableCell className="min-w-[180px] align-top">
                            <div className="font-medium">{row.fullName || row.email || '—'}</div>
                            {row.email && row.fullName ? (
                              <div className="text-xs text-muted-foreground">{row.email}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant={isTeacher ? 'success' : 'secondary'}>
                              {isTeacher
                                ? tr('Giáo viên', 'Teacher', '教师', '教師', '교사')
                                : tr('Thêm giỏ', 'Add to cart', '加入购物车', 'カート追加', '장바구니')}
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-[9.5rem] align-top">
                            <div title={source.extra || source.title}>
                              <div className={source.muted ? 'text-sm text-muted-foreground' : 'text-sm'}>{source.title}</div>
                              {source.extra ? (
                                <div className="mt-0.5 text-xs text-muted-foreground">{source.extra}</div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right align-top tabular-nums">{row.createdCount}</TableCell>
                          <TableCell className="text-right align-top tabular-nums">{row.openedCount}</TableCell>
                          <TableCell className="text-right align-top tabular-nums">{row.purchaseCount}</TableCell>
                          <TableCell className="whitespace-nowrap align-top tabular-nums">
                            {formatDateTime(row.lastActivityAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
