import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { curriculumBuyerSourceView } from '@/lib/curriculum/curriculum-buyer-source'
import {
  ADMIN_CURRICULUM_MANAGE_LIMIT,
  fetchAdminCurriculumManage,
  type AdminCurriculumManageCost,
} from '@/lib/db/admin-curriculum-manage-pg'
import { gradeLevelLabel } from '@/app/tao-giao-trinh/lib/curriculum-subjects'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { ApiStatsDateFilter } from '../api-stats/api-stats-date-filter'
import { ictDayEndIso, ictDayStartIso, ictYearStartYmd, ictYmd } from '../api-stats/ict-date'
import { CurriculumManageTableScroll } from './curriculum-manage-table-scroll'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: 'Quản lý giáo trình',
  description: 'Chi tiết từng giáo trình và chi phí API tạo giáo trình, câu hỏi, slide, ảnh.',
  path: '/admin/curriculum-manage',
  noIndex: true,
})

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

const SUBJECT_LABEL: Record<string, string> = {
  toan: 'Toán',
  'ngu-van': 'Ngữ văn',
  'tieng-anh': 'Tiếng Anh',
  'vat-ly': 'Vật lý',
  'hoa-hoc': 'Hóa học',
  'sinh-hoc': 'Sinh học',
  'lich-su': 'Lịch sử',
  'dia-ly': 'Địa lý',
  gdcd: 'GDCD',
  'tin-hoc': 'Tin học',
  'cong-nghe': 'Công nghệ',
  'am-nhac': 'Âm nhạc',
  'my-thuat': 'Mỹ thuật',
  'the-duc': 'Thể dục',
  khac: 'Khác',
}

const TEXTBOOK_LABEL: Record<string, string> = {
  'ket-noi-tri-thuc': 'Kết nối tri thức',
  'canh-dieu': 'Cánh diều',
  'chan-troi-sang-tao': 'Chân trời sáng tạo',
  khac: 'Khác',
}

const LESSON_TYPE_LABEL: Record<string, string> = {
  'hinh-thanh-kien-thuc': 'Lý thuyết',
  'luyen-tap': 'Luyện tập',
  'thuc-hanh': 'Thực hành',
}

function labelOf(map: Record<string, string>, id: string): string {
  const key = id.trim()
  return map[key] || key || '—'
}

function gradeLabel(id: string): string {
  return gradeLevelLabel(id, 'vi') || '—'
}

export default async function AdminCurriculumManagePage({
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

  const result = await fetchAdminCurriculumManage({
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

  const formatVnd = (n: number) => `${Math.round(n).toLocaleString(localeTag)}₫`

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

  const costDetail = (cost: AdminCurriculumManageCost) => {
    const parts = [
      cost.curriculumVnd > 0
        ? `${tr('Giáo trình', 'Curriculum', '课程', '教材', '교육과정')} ${formatVnd(cost.curriculumVnd)}`
        : '',
      cost.questionVnd > 0
        ? `${tr('Câu hỏi', 'Questions', '题目', '問題', '문항')} ${formatVnd(cost.questionVnd)}`
        : '',
      cost.slideVnd > 0 ? `${tr('Slide', 'Slides', '幻灯片', 'スライド', '슬라이드')} ${formatVnd(cost.slideVnd)}` : '',
      cost.imageVnd > 0 ? `${tr('Ảnh', 'Images', '图片', '画像', '이미지')} ${formatVnd(cost.imageVnd)}` : '',
    ].filter(Boolean)
    return parts.join(' · ')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {tr('Quản lý giáo trình', 'Curriculum library', '课程管理', '教材の管理', '교육과정 관리')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            'Mỗi dòng là một giáo trình đã lưu. Cột chi phí API cộng mọi lượt gọi của giáo trình đó: tạo giáo trình, tạo câu hỏi, tạo slide và tạo ảnh. 1 USD = 25.000₫. Giờ theo Việt Nam.',
            'Each row is one saved curriculum. The API cost column adds every call for that curriculum: curriculum, questions, slides, and images. 1 USD = 25,000₫. Times are Vietnam time.',
            '每一行是一份已保存的课程。API 费用列合计该课程的全部调用：创建课程、题目、幻灯片和图片。1 USD = 25,000₫。时间为越南时间。',
            '1行が保存済みの教材です。API費用列はその教材の全呼び出し（教材・問題・スライド・画像）を合計します。1 USD = 25,000₫。時刻はベトナム時間。',
            '각 행은 저장된 교육과정입니다. API 비용 열은 그 교육과정의 모든 호출(교육과정, 문항, 슬라이드, 이미지)을 합칩니다. 1 USD = 25,000₫. 시간은 베트남 시간.',
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(
            'Giáo trình tạo trước khi gắn mã chi phí được ước theo cùng tài khoản và thời điểm, đến khi tài khoản tạo giáo trình kế tiếp. Giáo trình mới cộng đúng từng lượt gọi.',
            'Curricula saved before calls were tagged are estimated by the same account and time, until that account creates the next curriculum. Newer curricula add each tagged call.',
            '开始标记调用之前保存的课程，按同一账号和时间估算，直到该账号创建下一份课程。新课程按每次已标记的调用累加。',
            '呼び出しに教材IDを付ける前の教材は、同じアカウントと時刻で次の教材ができるまで見積もります。新しい教材は付けた呼び出しをそのまま合計します。',
            '호출에 교육과정 ID를 붙이기 전에 저장된 항목은 같은 계정과 시각으로, 다음 교육과정을 만들기 전까지 추정합니다. 새 교육과정은 표시된 호출을 그대로 합칩니다.',
          )}
        </p>
      </div>

      <ApiStatsDateFilter
        defaultFrom={fromDate}
        defaultTo={toDate}
        basePath="/admin/curriculum-manage"
        extraQuery={query ? { q: query } : undefined}
      />

      <form method="get" action="/admin/curriculum-manage" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="from" value={fromDate} />
        <input type="hidden" name="to" value={toDate} />
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <label htmlFor="curriculum-manage-q" className="text-xs text-muted-foreground">
            {tr('Tìm giáo trình', 'Find a curriculum', '查找课程', '教材を検索', '교육과정 검색')}
          </label>
          <Input
            id="curriculum-manage-q"
            name="q"
            defaultValue={query}
            placeholder={tr(
              'Chủ đề, email, môn hoặc khối',
              'Topic, email, subject, or grade',
              '主题、邮箱、科目或年级',
              '主題、メール、教科、学年',
              '주제, 이메일, 과목, 학년',
            )}
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
                  {tr('Giáo trình', 'Curricula', '课程', '教材', '교육과정')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{result.summary.curricula.toLocaleString(localeTag)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Lượt gọi API', 'API calls', 'API 调用', 'API呼び出し', 'API 호출')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums">{result.summary.calls.toLocaleString(localeTag)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {tr('Tổng chi phí API', 'Total API cost', 'API 总费用', 'API費用合計', 'API 비용 합계')}
                </CardDescription>
                <CardTitle className="text-2xl tabular-nums text-amber-700">{formatVnd(result.summary.totalVnd)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {result.truncated ? (
            <p className="text-sm text-muted-foreground">
              {tr(
                `Đang hiện ${ADMIN_CURRICULUM_MANAGE_LIMIT} giáo trình mới nhất trong khoảng này. Tổng ở trên tính trên các dòng đang hiện.`,
                `Showing the ${ADMIN_CURRICULUM_MANAGE_LIMIT} newest curricula in this range. The totals above cover the rows shown.`,
                `正在显示该范围内最新的 ${ADMIN_CURRICULUM_MANAGE_LIMIT} 份课程。上方合计只算正在显示的行。`,
                `この期間の新しい順 ${ADMIN_CURRICULUM_MANAGE_LIMIT} 件を表示。上の合計は表示中の行です。`,
                `이 기간의 최신 교육과정 ${ADMIN_CURRICULUM_MANAGE_LIMIT}개를 표시합니다. 위 합계는 보이는 행만 계산합니다.`,
              )}
            </p>
          ) : null}

          <Card>
            <CardContent className="pt-3">
              <CurriculumManageTableScroll
                scrollLabel={tr(
                  'Cuộn ngang bảng giáo trình',
                  'Scroll the curriculum table sideways',
                  '横向滚动课程表',
                  '教材表を横にスクロール',
                  '교육과정 표를 가로로 스크롤',
                )}
              >
              <Table containerClassName="w-max min-w-full overflow-visible" className="w-max min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('Tạo lúc', 'Created', '创建时间', '作成', '만든 시각')}</TableHead>
                    <TableHead>{tr('Chủ đề', 'Topic', '主题', '主題', '주제')}</TableHead>
                    <TableHead>{tr('Môn', 'Subject', '科目', '教科', '과목')}</TableHead>
                    <TableHead>{tr('Khối', 'Grade', '年级', '学年', '학년')}</TableHead>
                    <TableHead>{tr('Bộ sách', 'Textbook', '教材版本', '教科書', '교과서')}</TableHead>
                    <TableHead>{tr('Tập', 'Volume', '册', '巻', '권')}</TableHead>
                    <TableHead>{tr('Bài', 'Lesson', '课', '課', '단원')}</TableHead>
                    <TableHead>{tr('Loại bài', 'Lesson type', '课型', '授業種別', '수업 유형')}</TableHead>
                    <TableHead className="text-right">{tr('Số tiết', 'Periods', '课时', '時数', '차시')}</TableHead>
                    <TableHead className="text-right">{tr('Phút', 'Minutes', '分钟', '分', '분')}</TableHead>
                    <TableHead>ISBN</TableHead>
                    <TableHead>{tr('Mục tiêu', 'Goals', '目标', '目標', '목표')}</TableHead>
                    <TableHead>{tr('Người tạo', 'Creator', '创建人', '作成者', '만든 사람')}</TableHead>
                    <TableHead>{tr('Nguồn', 'Source', '来源', '流入元', '출처')}</TableHead>
                    <TableHead className="text-right">{tr('Tiết đã lưu', 'Saved periods', '已存课时', '保存した時', '저장 차시')}</TableHead>
                    <TableHead className="text-right">{tr('Câu hỏi', 'Questions', '题目', '問題', '문항')}</TableHead>
                    <TableHead className="text-right">{tr('Bản slide', 'Slide sets', '幻灯片稿', 'スライド稿', '슬라이드 묶음')}</TableHead>
                    <TableHead className="text-right">{tr('Lượt API', 'API calls', 'API 次数', 'API回数', 'API 횟수')}</TableHead>
                    <TableHead className="text-right">{tr('Chi phí API', 'API cost', 'API 费用', 'API費用', 'API 비용')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={19} className="py-8 text-center text-muted-foreground">
                        {tr(
                          'Chưa có giáo trình trong khoảng này.',
                          'No curricula in this range.',
                          '该范围内没有课程。',
                          'この期間の教材はありません。',
                          '이 기간의 교육과정이 없습니다.',
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    result.rows.map((row) => {
                      const source = sourceLabel(row.createdSource, row.createdSourceDetail)
                      const detail = costDetail(row.cost)
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap align-top tabular-nums">{formatDateTime(row.createdAt)}</TableCell>
                          <TableCell className="min-w-[14rem] align-top">
                            <div className="font-medium">{row.topic || '—'}</div>
                            <div className="text-xs text-muted-foreground">{row.id}</div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top">{labelOf(SUBJECT_LABEL, row.subjectId)}</TableCell>
                          <TableCell className="whitespace-nowrap align-top">{gradeLabel(row.gradeLevelId)}</TableCell>
                          <TableCell className="min-w-[8rem] align-top">{labelOf(TEXTBOOK_LABEL, row.textbookSetId)}</TableCell>
                          <TableCell className="align-top">{row.textbookVolume || '—'}</TableCell>
                          <TableCell className="align-top tabular-nums">
                            {row.lessonNumber == null ? '—' : row.lessonNumber}
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top">{labelOf(LESSON_TYPE_LABEL, row.lessonTypeId)}</TableCell>
                          <TableCell className="text-right align-top tabular-nums">{row.numLessons}</TableCell>
                          <TableCell className="text-right align-top tabular-nums">{row.lessonDurationMinutes}</TableCell>
                          <TableCell className="whitespace-nowrap align-top">{row.textbookIsbn || '—'}</TableCell>
                          <TableCell className="max-w-[16rem] align-top text-sm text-muted-foreground">
                            {row.goals || '—'}
                          </TableCell>
                          <TableCell className="min-w-[12rem] align-top">
                            <div className="font-medium">{row.fullName || row.email || '—'}</div>
                            {row.email && row.fullName ? (
                              <div className="text-xs text-muted-foreground">{row.email}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="min-w-[8rem] align-top">
                            <div className={source.muted ? 'text-sm text-muted-foreground' : 'text-sm'}>{source.title}</div>
                            {source.extra ? <div className="mt-0.5 text-xs text-muted-foreground">{source.extra}</div> : null}
                          </TableCell>
                          <TableCell className="text-right align-top tabular-nums">{row.lessonSavedCount}</TableCell>
                          <TableCell className="text-right align-top tabular-nums">{row.questionCount}</TableCell>
                          <TableCell className="text-right align-top tabular-nums">{row.slideSetCount}</TableCell>
                          <TableCell className="text-right align-top tabular-nums">{row.cost.calls}</TableCell>
                          <TableCell className="min-w-[12rem] align-top text-right">
                            <div className="font-semibold tabular-nums text-amber-700">{formatVnd(row.cost.totalVnd)}</div>
                            {detail ? <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div> : null}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
              </CurriculumManageTableScroll>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
