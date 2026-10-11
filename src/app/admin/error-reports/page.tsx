import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { CUSTOMER_ERROR_SOURCES, type CustomerErrorSource } from '@/lib/errors/customer-error-filter'
import { pgListCustomerErrorReports } from '@/lib/errors/customer-error-report-pg'
import { ErrorReportRowActions, ErrorReportsBulkActions } from './error-report-actions-client'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

type SearchParams = { status?: string; source?: string; q?: string; page?: string; id?: string }

function formatDate(value: string | null, locale: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const dateLocale = locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : locale === 'ko' ? 'ko-KR' : 'vi-VN'
  return new Intl.DateTimeFormat(dateLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d)
}

function buildHref(base: SearchParams, patch: Partial<SearchParams>): string {
  const merged = { ...base, ...patch }
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) {
    if (v && k !== 'id') qs.set(k, v)
  }
  const s = qs.toString()
  return s ? `/admin/error-reports?${s}` : '/admin/error-reports'
}

export default async function AdminErrorReportsPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const uiLocale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const status = searchParams.status === 'resolved' || searchParams.status === 'all' ? searchParams.status : 'open'
  const source = CUSTOMER_ERROR_SOURCES.includes(searchParams.source as CustomerErrorSource)
    ? (searchParams.source as CustomerErrorSource)
    : null
  const q = (searchParams.q || '').slice(0, 200)
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const focusId = searchParams.id && /^\d+$/.test(searchParams.id) ? searchParams.id : null
  const current: SearchParams = { status, source: source ?? undefined, q: q || undefined }

  const { rows, total, stats, error } = await pgListCustomerErrorReports({
    id: focusId,
    status: focusId ? 'all' : status,
    source: focusId ? null : source,
    q: focusId ? '' : q,
    page,
    pageSize: PAGE_SIZE,
  })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const sourceLabel = (s: CustomerErrorSource) =>
    s === 'boundary'
      ? tr('Trang lỗi', 'Page crash', '页面崩溃', 'ページエラー', '페이지 오류')
      : s === 'server'
        ? tr('API server', 'Server API', '服务器 API', 'サーバー API', '서버 API')
        : tr('Thông báo lỗi', 'Error toast', '错误提示', 'エラー通知', '오류 알림')

  const statusTabs: Array<{ key: 'open' | 'resolved' | 'all'; label: string }> = [
    { key: 'open', label: tr('Chưa xử lý', 'Open', '未处理', '未対応', '미처리') },
    { key: 'resolved', label: tr('Đã xử lý', 'Resolved', '已处理', '対応済み', '처리됨') },
    { key: 'all', label: tr('Tất cả', 'All', '全部', 'すべて', '전체') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {tr('Nhật ký lỗi khách', 'Customer error log', '客户错误日志', '顧客エラーログ', '고객 오류 로그')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            'Khách thao tác bị lỗi sẽ được ghi ở đây và gửi email cho admin. Lỗi giống nhau trong 10 phút được gộp một dòng; cùng lỗi chỉ gửi mail một lần mỗi 30 phút.',
            'Failed customer actions are logged here and emailed to admins. Identical errors within 10 minutes are merged; the same error is emailed at most once every 30 minutes.',
            '客户操作失败会记录在此并邮件通知管理员。10 分钟内相同错误合并为一行；同一错误每 30 分钟最多发一封邮件。',
            '顧客の操作エラーはここに記録され、管理者にメール通知されます。10 分以内の同一エラーは 1 行にまとめ、同じエラーのメールは 30 分に 1 回までです。',
            '고객 작업 오류는 여기에 기록되고 관리자에게 이메일로 알립니다. 10분 내 동일 오류는 한 줄로 합치며, 같은 오류 메일은 30분에 한 번만 보냅니다.'
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{tr('Chưa xử lý', 'Open', '未处理', '未対応', '미처리')}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">{stats.open}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{tr('Hôm nay', 'Today', '今天', '今日', '오늘')}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.today}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{tr('Mail đã gửi hôm nay', 'Emails sent today', '今日已发邮件', '本日の送信メール', '오늘 보낸 메일')}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.emailedToday}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {statusTabs.map((tab) => (
              <Link
                key={tab.key}
                href={buildHref(current, { status: tab.key, page: undefined })}
                className={`rounded-md border px-3 py-1.5 text-sm ${status === tab.key && !focusId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {tab.label}
              </Link>
            ))}
            <span className="mx-2 h-5 w-px bg-border" />
            <Link
              href={buildHref(current, { source: undefined, page: undefined })}
              className={`rounded-md border px-3 py-1.5 text-sm ${!source ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
            >
              {tr('Mọi nguồn', 'All sources', '所有来源', 'すべての発生元', '모든 출처')}
            </Link>
            {CUSTOMER_ERROR_SOURCES.map((s) => (
              <Link
                key={s}
                href={buildHref(current, { source: s, page: undefined })}
                className={`rounded-md border px-3 py-1.5 text-sm ${source === s ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
              >
                {sourceLabel(s)}
              </Link>
            ))}
            <form action="/admin/error-reports" className="ml-auto flex gap-2">
              <input type="hidden" name="status" value={status} />
              {source ? <input type="hidden" name="source" value={source} /> : null}
              <input
                name="q"
                defaultValue={q}
                placeholder={tr('Tìm lỗi, trang, email…', 'Search error, page, email…', '搜索错误、页面、邮箱…', 'エラー・ページ・メールを検索…', '오류, 페이지, 이메일 검색…')}
                className="h-9 w-64 rounded-md border bg-background px-3 text-sm"
              />
              <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-muted">
                {tr('Tìm', 'Search', '搜索', '検索', '검색')}
              </button>
            </form>
          </div>

          {focusId ? (
            <p className="text-sm">
              {tr('Đang xem lỗi', 'Showing error', '正在查看错误', '表示中のエラー', '보고 있는 오류')} #{focusId} ·{' '}
              <Link href={buildHref(current, {})} className="underline">
                {tr('Xem tất cả', 'Show all', '查看全部', 'すべて表示', '전체 보기')}
              </Link>
            </p>
          ) : null}

          <ErrorReportsBulkActions
            openIds={rows.filter((r) => !r.resolved_at).map((r) => r.id)}
            showDeleteResolved={status === 'resolved'}
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">{tr('Lần cuối', 'Last seen', '最近发生', '最終発生', '마지막 발생')}</TableHead>
                <TableHead>{tr('Khách', 'Customer', '客户', '顧客', '고객')}</TableHead>
                <TableHead>{tr('Trang', 'Page', '页面', 'ページ', '페이지')}</TableHead>
                <TableHead>{tr('Lỗi', 'Error', '错误', 'エラー', '오류')}</TableHead>
                <TableHead className="w-[70px] text-right">{tr('Số lần', 'Count', '次数', '回数', '횟수')}</TableHead>
                <TableHead className="w-[140px]">{tr('Trạng thái', 'Status', '状态', '状態', '상태')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {tr('Chưa có lỗi nào.', 'No errors yet.', '暂无错误。', 'エラーはまだありません。', '아직 오류가 없습니다.')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                    <TableRow key={row.id} className={focusId === row.id ? 'bg-amber-50 dark:bg-amber-950/30' : undefined}>
                      <TableCell className="align-top text-xs">
                        <div>{formatDate(row.last_seen_at, uiLocale)}</div>
                        {row.occurrences > 1 ? (
                          <div className="text-muted-foreground">
                            {tr('Đầu tiên', 'First', '首次', '初回', '최초')}: {formatDate(row.first_seen_at, uiLocale)}
                          </div>
                        ) : null}
                        <div className="text-muted-foreground">#{row.id}</div>
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        <div className="font-medium">{row.user_email || row.user_id || tr('Khách chưa đăng nhập', 'Anonymous', '匿名访客', '未ログイン', '비로그인')}</div>
                        {row.ip ? <div className="text-muted-foreground">{row.ip}</div> : null}
                      </TableCell>
                      <TableCell className="max-w-[220px] align-top text-xs">
                        {row.path ? (
                          <a href={row.path} target="_blank" rel="noreferrer" className="break-all underline">
                            {row.path}
                          </a>
                        ) : (
                          '-'
                        )}
                        <div className="mt-1">
                          <Badge variant="secondary">{sourceLabel(row.source)}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[460px] align-top text-xs">
                        {row.title ? <div className="font-medium">{row.title}</div> : null}
                        <div className="whitespace-pre-wrap break-words text-red-700 dark:text-red-400">{row.message}</div>
                        {row.detail || row.digest || row.user_agent || Object.keys(row.meta || {}).length ? (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-muted-foreground">
                              {tr('Chi tiết', 'Details', '详情', '詳細', '상세')}
                            </summary>
                            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-[11px]">
                              {[
                                row.digest ? `digest: ${row.digest}` : '',
                                Object.keys(row.meta || {}).length ? `meta: ${JSON.stringify(row.meta)}` : '',
                                row.user_agent ? `ua: ${row.user_agent}` : '',
                                row.detail || '',
                              ]
                                .filter(Boolean)
                                .join('\n')}
                            </pre>
                          </details>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top text-right font-medium">{row.occurrences}</TableCell>
                      <TableCell className="align-top text-xs">
                        <div className="flex flex-col items-start gap-1">
                          {row.resolved_at ? (
                            <Badge variant="success">{tr('Đã xử lý', 'Resolved', '已处理', '対応済み', '처리됨')}</Badge>
                          ) : (
                            <Badge variant="destructive">{tr('Chưa xử lý', 'Open', '未处理', '未対応', '미처리')}</Badge>
                          )}
                          {row.emailed_at ? (
                            <span className="text-muted-foreground">
                              {tr('Đã mail', 'Emailed', '已发邮件', 'メール済み', '메일 발송')}
                            </span>
                          ) : null}
                          <ErrorReportRowActions id={row.id} resolved={Boolean(row.resolved_at)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>

          {pageCount > 1 && !focusId ? (
            <div className="flex items-center justify-end gap-3 text-sm">
              {page > 1 ? (
                <Link href={buildHref(current, { page: String(page - 1) })} className="underline">
                  {tr('Trước', 'Previous', '上一页', '前へ', '이전')}
                </Link>
              ) : null}
              <span>
                {page} / {pageCount}
              </span>
              {page < pageCount ? (
                <Link href={buildHref(current, { page: String(page + 1) })} className="underline">
                  {tr('Sau', 'Next', '下一页', '次へ', '다음')}
                </Link>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
