import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ADMIN_WEDDING_CARD_STATS_LIMIT,
  fetchAdminWeddingCardStats,
} from '@/lib/db/admin-wedding-card-stats-pg'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { defaultPublicOrigin } from '@/lib/public-app-origin'
import { buildMetadata } from '@/lib/seo'
import { invitationOccasionShortLabel } from '@/lib/wedding/invitation-occasion'
import {
  isWeddingCardCompletionKey,
  type WeddingCardCompletionKey,
} from '@/lib/wedding/wedding-card-completion'
import { ApiStatsDateFilter } from '../api-stats/api-stats-date-filter'
import { ictDayEndIso, ictDayStartIso, ictYearStartYmd, ictYmd } from '../api-stats/ict-date'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: 'Thống kê thiệp',
  description: 'Khách đã bấm tạo thiệp, link thiệp, mức hoàn thiện và thời điểm tạo.',
  path: '/admin/wedding-card-stats',
  noIndex: true,
})

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

function cardTitle(groomName: string, brideName: string): string {
  const groom = groomName.trim()
  const bride = brideName.trim()
  if (groom && bride) return `${groom} & ${bride}`
  return groom || bride || '—'
}

export default async function AdminWeddingCardStatsPage({
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

  const result = await fetchAdminWeddingCardStats({
    fromIso: ictDayStartIso(fromDate),
    toIso: ictDayEndIso(toDate),
    query,
  })

  const missingLabel = (key: WeddingCardCompletionKey) => {
    const labels: Record<WeddingCardCompletionKey, string> = {
      names: tr('Tên', 'Names', '姓名', '名前', '이름'),
      date: tr('Ngày', 'Date', '日期', '日付', '날짜'),
      time: tr('Giờ', 'Time', '时间', '時刻', '시간'),
      venue: tr('Địa điểm', 'Venue', '地点', '会場', '장소'),
      invitation: tr('Lời mời', 'Invitation', '请柬文', '招待文', '초대 문구'),
      photo: tr('Ảnh', 'Photo', '照片', '写真', '사진'),
      music: tr('Nhạc', 'Music', '音乐', '音楽', '음악'),
      album: tr('Album', 'Album', '相册', 'アルバム', '앨범'),
      closing: tr('Lời kể', 'Story', '故事', '物語', '이야기'),
      published: tr('Xuất bản', 'Published', '已发布', '公開', '게시'),
    }
    return labels[key]
  }

  const formatDate = (iso: string) => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat(localeTag, {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  }

  const formatTime = (iso: string) => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat(localeTag, {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const origin = defaultPublicOrigin()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {tr('Thống kê thiệp', 'Invitation stats', '请柬统计', '招待状の統計', '청첩장 통계')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            'Mỗi lần khách bấm tạo thiệp được ghi một dòng. Mức hoàn thiện là 10 mục, mỗi mục 10%: tên, ngày, giờ, địa điểm, lời mời, ảnh, nhạc, album, lời kể hoặc cảm ơn, và đã xuất bản. Giờ theo Việt Nam.',
            'Each tap on create invitation is one row. Completion is 10 parts, 10% each: names, date, time, venue, invitation text, photo, music, album, story or thanks, and published. Times are Vietnam time.',
            '客户每次点击创建请柬记为一行。完成度为 10 项，每项 10%：姓名、日期、时间、地点、请柬文、照片、音乐、相册、故事或致谢，以及已发布。时间为越南时间。',
            '作成を押すたびに 1 行。完成度は 10 項目で各 10%：名前、日付、時刻、会場、招待文、写真、音楽、アルバム、物語または感謝、公開済み。時刻はベトナム時間。',
            '청첩장 만들기를 누를 때마다 한 줄. 완성도는 10항목, 각 10%: 이름, 날짜, 시간, 장소, 초대 문구, 사진, 음악, 앨범, 이야기 또는 감사, 게시. 시간은 베트남 시간.',
          )}
        </p>
      </div>

      <ApiStatsDateFilter
        defaultFrom={fromDate}
        defaultTo={toDate}
        basePath="/admin/wedding-card-stats"
        extraQuery={query ? { q: query } : undefined}
      />

      <form method="get" action="/admin/wedding-card-stats" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="from" value={fromDate} />
        <input type="hidden" name="to" value={toDate} />
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <label htmlFor="wedding-card-stats-q" className="text-xs text-muted-foreground">
            {tr('Tìm khách hoặc thiệp', 'Find a customer or card', '查找客户或请柬', 'お客様または招待状を検索', '고객 또는 청첩장 검색')}
          </label>
          <Input
            id="wedding-card-stats-q"
            name="q"
            defaultValue={query}
            placeholder={tr('Email, tên, slug', 'Email, name, slug', '邮箱、姓名、slug', 'メール、名前、slug', '이메일, 이름, slug')}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Người đã tạo thiệp', 'People who created a card', '已创建请柬的人数', '作成した人数', '청첩장을 만든 사람')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{result.summary.people}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{tr('Số thiệp', 'Cards', '请柬数', '招待状数', '청첩장 수')}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{result.summary.cards}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{tr('Đã xuất bản', 'Published', '已发布', '公開済み', '게시됨')}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{result.summary.published}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Hoàn thiện trung bình', 'Average completion', '平均完成度', '平均完成度', '평균 완성도')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{result.summary.avgCompletion}%</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {result.truncated ? (
            <p className="text-sm text-muted-foreground">
              {tr(
                `Đang hiện ${ADMIN_WEDDING_CARD_STATS_LIMIT} thiệp mới nhất. Số người ở trên tính trên cả khoảng ngày.`,
                `Showing the ${ADMIN_WEDDING_CARD_STATS_LIMIT} newest cards. The people count above covers the whole date range.`,
                `正在显示最新 ${ADMIN_WEDDING_CARD_STATS_LIMIT} 份请柬。上方人数按整个日期范围计算。`,
                `新しい順に ${ADMIN_WEDDING_CARD_STATS_LIMIT} 件を表示。上の人数は期間全体です。`,
                `최신 ${ADMIN_WEDDING_CARD_STATS_LIMIT}건을 표시합니다. 위 인원 수는 전체 기간입니다.`,
              )}
            </p>
          ) : null}

          <Card>
            <CardContent className="mt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('Khách', 'Customer', '客户', 'お客様', '고객')}</TableHead>
                    <TableHead>{tr('Thiệp', 'Card', '请柬', '招待状', '청첩장')}</TableHead>
                    <TableHead>{tr('Link', 'Link', '链接', 'リンク', '링크')}</TableHead>
                    <TableHead>{tr('Hoàn thiện', 'Completion', '完成度', '完成度', '완성도')}</TableHead>
                    <TableHead>{tr('Ngày tạo', 'Created date', '创建日期', '作成日', '만든 날짜')}</TableHead>
                    <TableHead>{tr('Giờ tạo', 'Created time', '创建时间', '作成時刻', '만든 시간')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        {tr(
                          'Chưa có khách tạo thiệp trong khoảng này.',
                          'No invitations were created in this range.',
                          '该范围内还没有客户创建请柬。',
                          'この期間に作成された招待状はありません。',
                          '이 기간에 만든 청첩장이 없습니다.',
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    result.rows.map((row) => {
                      const href = `${origin}/thiep-moi-cuoi/${encodeURIComponent(row.slug)}`
                      const missing = row.missingKeys.filter(isWeddingCardCompletionKey).map(missingLabel)
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="min-w-[180px] align-top">
                            <div className="font-medium">{row.fullName || row.email || '—'}</div>
                            {row.email && row.fullName ? (
                              <div className="text-xs text-muted-foreground">{row.email}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="min-w-[160px] align-top">
                            <div>{cardTitle(row.groomName, row.brideName)}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">
                                {invitationOccasionShortLabel(row.occasionKey, uiLocale)}
                              </span>
                              <Badge variant={row.isPublished ? 'success' : 'secondary'}>
                                {row.isPublished
                                  ? tr('Đã xuất bản', 'Published', '已发布', '公開済み', '게시됨')
                                  : tr('Nháp', 'Draft', '草稿', '下書き', '초안')}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[240px] align-top">
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-sm text-primary underline underline-offset-2"
                            >
                              {href}
                            </a>
                            {row.isPublished ? null : (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {tr(
                                  'Link công khai mở sau khi xuất bản.',
                                  'The public link opens after publish.',
                                  '公开发布后才能打开链接。',
                                  '公開後にリンクが開きます。',
                                  '게시한 뒤에 공개 링크가 열립니다.',
                                )}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="min-w-[160px] align-top">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                                <div className="h-full bg-violet-600" style={{ width: `${row.completionPercent}%` }} />
                              </div>
                              <span className="tabular-nums">{row.completionPercent}%</span>
                            </div>
                            {missing.length > 0 ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {tr('Thiếu', 'Missing', '缺少', '不足', '없음')}: {missing.join(', ')}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top tabular-nums">{formatDate(row.createdAt)}</TableCell>
                          <TableCell className="whitespace-nowrap align-top tabular-nums">{formatTime(row.createdAt)}</TableCell>
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
