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
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { ApiStatsDateFilter } from '../api-stats/api-stats-date-filter'
import { ictDayEndIso, ictDayStartIso, ictYearStartYmd, ictYmd } from '../api-stats/ict-date'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: 'Thống kê giáo viên',
  description: 'Số người mở giáo trình, tạo giáo trình, và giáo viên đã mua gói.',
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
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
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
