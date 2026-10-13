import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { pgListHomeworkUnsolved } from '@/lib/homework-help/homework-help-unsolved'
import { HomeworkUnsolvedRowActions } from './homework-unsolved-actions-client'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

type SearchParams = { status?: string; q?: string; page?: string }

function formatDate(value: string | null, locale: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const dateLocale = locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : locale === 'ko' ? 'ko-KR' : 'vi-VN'
  return new Intl.DateTimeFormat(dateLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}

function buildHref(base: SearchParams, patch: Partial<SearchParams>): string {
  const merged = { ...base, ...patch }
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(merged)) {
    if (value) qs.set(key, value)
  }
  const text = qs.toString()
  return text ? `/admin/homework-unsolved?${text}` : '/admin/homework-unsolved'
}

export default async function AdminHomeworkUnsolvedPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const uiLocale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const status = searchParams.status === 'resolved' || searchParams.status === 'all' ? searchParams.status : 'open'
  const q = (searchParams.q || '').slice(0, 200)
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const current: SearchParams = { status, q: q || undefined }
  const { rows, total, stats, error } = await pgListHomeworkUnsolved({
    status,
    q,
    page,
    pageSize: PAGE_SIZE,
  })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tabs: Array<{ key: 'open' | 'resolved' | 'all'; label: string }> = [
    { key: 'open', label: tr('Chưa xử lý', 'Open', '未处理', '未対応', '미처리') },
    { key: 'resolved', label: tr('Đã xem', 'Seen', '已看', '確認済み', '확인함') },
    { key: 'all', label: tr('Tất cả', 'All', '全部', 'すべて', '전체') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {tr('Bài chưa có đáp án', 'Homework without an answer', '没有答案的作业', '解答のない宿題', '답이 없는 숙제')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            'Học sinh không thấy đáp án khi GPT không khớp DeepSeek và cũng không khớp Gemini Pro. Bài mới được gom và gửi mail cho admin một lần mỗi ngày, lúc 8:30.',
            'Students do not see an answer when GPT matches neither DeepSeek nor Gemini Pro. New items are emailed to admins once a day, at 8:30.',
            'GPT 与 DeepSeek、Gemini Pro 都不一致时，学生看不到答案。新题目每天 8:30 汇总发一封邮件给管理员。',
            'GPT が DeepSeek にも Gemini Pro にも一致しない場合、生徒には答えを出しません。新しい問題は毎日 8:30 に管理者へ1通だけ送ります。',
            'GPT가 DeepSeek과 Gemini Pro 어느 쪽과도 맞지 않으면 학생에게 답을 보여 주지 않습니다. 새 문제는 매일 8:30에 관리자에게 메일 한 통으로 보냅니다.'
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{tr('Chưa xử lý', 'Open', '未处理', '未対応', '미처리')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">{stats.open}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {tr('Chưa gửi mail', 'Not emailed yet', '尚未发邮件', '未送信', '아직 메일 안 보냄')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.unmailed}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={buildHref(current, { status: tab.key, page: undefined })}
                className={`rounded-md border px-3 py-1.5 text-sm ${status === tab.key ? 'bg-muted font-medium' : 'hover:bg-muted'}`}
              >
                {tab.label}
              </Link>
            ))}
            <form action="/admin/homework-unsolved" className="ml-auto flex gap-2">
              <input type="hidden" name="status" value={status} />
              <input
                name="q"
                defaultValue={q}
                placeholder={tr('Tìm đề bài…', 'Search the problem…', '搜索题目…', '問題を検索…', '문제 검색…')}
                className="h-9 w-64 rounded-md border bg-background px-3 text-sm"
              />
              <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-muted">
                {tr('Tìm', 'Search', '搜索', '検索', '검색')}
              </button>
            </form>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">{tr('Lần cuối', 'Last seen', '最近发生', '最終発生', '마지막 발생')}</TableHead>
                <TableHead>{tr('Đề', 'Problem', '题目', '問題', '문제')}</TableHead>
                <TableHead>{tr('Ba đáp án', 'Three answers', '三个答案', '3つの答え', '세 답')}</TableHead>
                <TableHead className="w-[70px] text-right">{tr('Số lần', 'Count', '次数', '回数', '횟수')}</TableHead>
                <TableHead className="w-[110px]">{tr('Trạng thái', 'Status', '状态', '状態', '상태')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {tr('Chưa có bài nào.', 'No problems yet.', '暂无题目。', '問題はまだありません。', '아직 문제가 없습니다.')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="align-top text-xs">
                      <div>{formatDate(row.last_seen_at, uiLocale)}</div>
                      <div className="text-muted-foreground">#{row.id}</div>
                      {row.emailed_at ? (
                        <div className="text-muted-foreground">
                          {tr('Đã gửi mail', 'Emailed', '已发邮件', '送信済み', '메일 보냄')}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[360px] align-top whitespace-pre-wrap text-xs">{row.statement}</TableCell>
                    <TableCell className="max-w-[320px] align-top text-xs">
                      <div>DeepSeek: {row.draft_answer || '-'}</div>
                      <div>Gemini Pro: {row.gemini_answer || '-'}</div>
                      <div>GPT: {row.gpt_answer || '-'}</div>
                    </TableCell>
                    <TableCell className="align-top text-right text-xs">{row.occurrences}</TableCell>
                    <TableCell className="align-top">
                      <HomeworkUnsolvedRowActions id={row.id} resolved={Boolean(row.resolved_at)} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {pageCount > 1 ? (
            <div className="flex gap-2 text-sm">
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
