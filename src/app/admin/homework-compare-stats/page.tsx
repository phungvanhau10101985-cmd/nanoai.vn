import type { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiStatsDateFilter } from '../api-stats/api-stats-date-filter'
import { formatIctYmdVi, ictDayEndIso, ictDayStartIso, ictShiftDays, ictYmd } from '../api-stats/ict-date'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { pgHomeworkCompareStats, type HomeworkCompareDay } from '@/lib/homework-help/homework-help-compare'
import { buildMetadata } from '@/lib/seo'
import { HomeworkCompareCharts, type HomeworkComparePieSlice } from './homework-compare-charts'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: 'Tỷ lệ khớp bài',
  description: 'Thống kê đối chiếu đáp án hỗ trợ làm bài.',
  path: '/admin/homework-compare-stats',
  noIndex: true,
})

function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Math.round((part / whole) * 1000) / 10
}

function formatRate(value: number | null, localeTag: string): string {
  if (value == null) return '—'
  return `${value.toLocaleString(localeTag, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`
}

function answerTotal(day: HomeworkCompareDay): number {
  return day.agree + day.gptDeepseek + day.gptGemini + day.unmatched
}

function shownTotal(day: HomeworkCompareDay): number {
  return day.agree + day.gptDeepseek + day.gptGemini
}

export default async function AdminHomeworkCompareStatsPage({
  searchParams = {},
}: {
  searchParams?: { from?: string; to?: string }
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

  const fromDate = searchParams.from?.trim() || ictShiftDays(-30)
  const toDate = searchParams.to?.trim() || ictYmd()
  const fromDay = fromDate <= toDate ? fromDate : toDate
  const toDay = fromDate <= toDate ? toDate : fromDate
  const stats = await pgHomeworkCompareStats(ictDayStartIso(fromDay), ictDayEndIso(toDay), fromDay, toDay)

  const totals = stats.days.reduce(
    (sum, day) => ({
      agree: sum.agree + day.agree,
      gptDeepseek: sum.gptDeepseek + day.gptDeepseek,
      gptGemini: sum.gptGemini + day.gptGemini,
      unmatched: sum.unmatched + day.unmatched,
      knowledgeOk: sum.knowledgeOk + day.knowledgeOk,
      knowledgeNot: sum.knowledgeNot + day.knowledgeNot,
    }),
    { agree: 0, gptDeepseek: 0, gptGemini: 0, unmatched: 0, knowledgeOk: 0, knowledgeNot: 0 }
  )
  const answers = totals.agree + totals.gptDeepseek + totals.gptGemini + totals.unmatched
  const shown = totals.agree + totals.gptDeepseek + totals.gptGemini
  const knowledge = totals.knowledgeOk + totals.knowledgeNot
  const labels = {
    agree: tr('Khớp ngay', 'Agreed at once', '一次就一致', 'すぐ一致', '바로 일치'),
    gptDeepseek: tr('GPT chọn DeepSeek', 'GPT picked DeepSeek', 'GPT 选 DeepSeek', 'GPT が DeepSeek', 'GPT가 DeepSeek'),
    gptGemini: tr('GPT chọn Gemini', 'GPT picked Gemini', 'GPT 选 Gemini', 'GPT が Gemini', 'GPT가 Gemini'),
    unmatched: tr('Không hiện đáp án', 'Answer hidden', '不显示答案', '答えを出さない', '답을 숨김'),
    knowledgeOk: tr('Kiến thức đúng', 'Knowledge ok', '知识点正确', '知識は正しい', '지식 맞음'),
    knowledgeNot: tr('Kiến thức loại', 'Knowledge dropped', '知识点去掉', '知識を外した', '지식 제외'),
  }
  const answerPie: HomeworkComparePieSlice[] = [
    { name: labels.agree, value: totals.agree, fill: '#16a34a' },
    { name: labels.gptDeepseek, value: totals.gptDeepseek, fill: '#2563eb' },
    { name: labels.gptGemini, value: totals.gptGemini, fill: '#7c3aed' },
    { name: labels.unmatched, value: totals.unmatched, fill: '#ea580c' },
  ]
  const shownPie: HomeworkComparePieSlice[] = [
    { name: tr('Hiện đáp án', 'Answer shown', '显示答案', '答えを表示', '답 표시'), value: shown, fill: '#16a34a' },
    { name: labels.unmatched, value: totals.unmatched, fill: '#ea580c' },
  ]
  const differPie: HomeworkComparePieSlice[] = [
    { name: labels.gptDeepseek, value: totals.gptDeepseek, fill: '#2563eb' },
    { name: labels.gptGemini, value: totals.gptGemini, fill: '#7c3aed' },
    { name: labels.unmatched, value: totals.unmatched, fill: '#ea580c' },
  ]
  const knowledgePie: HomeworkComparePieSlice[] = [
    { name: labels.knowledgeOk, value: totals.knowledgeOk, fill: '#0d9488' },
    { name: labels.knowledgeNot, value: totals.knowledgeNot, fill: '#e11d48' },
  ]
  const noData = tr(
    'Khoảng này chưa có lần đối chiếu.',
    'No comparisons in this range.',
    '这段还没有核对记录。',
    'この期間の照合はまだありません。',
    '이 기간에는 대조 기록이 없습니다.'
  )
  const cards = [
    { label: tr('Lần đối chiếu đáp án', 'Answer checks', '答案核对', '答えの照合', '답 대조'), value: answers.toLocaleString(localeTag) },
    { label: tr('Khớp DeepSeek và Gemini', 'DeepSeek and Gemini agreed', 'DeepSeek 与 Gemini 一致', 'DeepSeek と Gemini が一致', 'DeepSeek와 Gemini 일치'), value: formatRate(rate(totals.agree, answers), localeTag) },
    { label: tr('Hiện được đáp án', 'Answer shown', '能显示答案', '答えを表示', '답을 표시'), value: formatRate(rate(shown, answers), localeTag) },
    { label: tr('Dòng kiến thức giữ lại', 'Knowledge lines kept', '保留的知识点', '残した知識', '남긴 지식'), value: formatRate(rate(totals.knowledgeOk, knowledge), localeTag) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {tr('Tỷ lệ khớp bài', 'Homework match rate', '作业核对率', '宿題の一致率', '숙제 일치율')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {tr(
            'Mỗi bài ghi một lần đối chiếu đáp án: khớp ngay, GPT chọn DeepSeek, GPT chọn Gemini, hoặc không hiện. Mỗi dòng kiến thức ghi đúng hoặc bị loại.',
            'Each problem records one answer check: agreed at once, GPT picked DeepSeek, GPT picked Gemini, or hidden. Each knowledge line is kept or dropped.',
            '每题记一次答案核对：一次一致、GPT 选 DeepSeek、GPT 选 Gemini，或不显示。每条知识点记保留或去掉。',
            '各問は答えの照合を1回記録します。すぐ一致、GPT が DeepSeek、GPT が Gemini、または非表示。知識の各行は残すか外すかです。',
            '문제마다 답 대조를 한 번 기록합니다. 바로 일치, GPT가 DeepSeek, GPT가 Gemini, 또는 숨김. 지식 줄은 남기거나 뺍니다.'
          )}
        </p>
      </div>

      <ApiStatsDateFilter defaultFrom={fromDay} defaultTo={toDay} basePath="/admin/homework-compare-stats" />

      {stats.error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {tr('Chưa đọc được số liệu.', 'Could not read the figures.', '读不到数据。', '数値を読めません。', '수치를 읽지 못했습니다。')} {stats.error}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{card.value}</CardContent>
          </Card>
        ))}
      </div>

      <HomeworkCompareCharts
        charts={[
          {
            title: tr('Đáp án cả kỳ', 'Answers for the period', '整段答案', '期間の答え', '기간의 답'),
            empty: noData,
            slices: answerPie,
          },
          {
            title: tr('Hiện đáp án hay giữ lại', 'Shown or hidden', '显示或隐藏', '表示するか隠すか', '표시 또는 숨김'),
            empty: noData,
            slices: shownPie,
          },
          {
            title: tr('Khi DeepSeek và Gemini lệch', 'When DeepSeek and Gemini differ', 'DeepSeek 与 Gemini 不一致时', 'DeepSeek と Gemini がずれたとき', 'DeepSeek와 Gemini가 다를 때'),
            empty: tr(
              'Khoảng này không có bài lệch.',
              'Nothing differed in this range.',
              '这段没有不一致的题。',
              'この期間はずれた問題がありません。',
              '이 기간에는 어긋난 문제가 없습니다.'
            ),
            slices: differPie,
          },
          {
            title: tr('Dòng kiến thức', 'Knowledge lines', '知识点', '知識の行', '지식 줄'),
            empty: noData,
            slices: knowledgePie,
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tr('Theo ngày', 'By day', '按日', '日ごと', '날짜별')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('Ngày', 'Day', '日期', '日付', '날짜')}</TableHead>
                <TableHead className="text-right">{labels.agree}</TableHead>
                <TableHead className="text-right">{labels.gptDeepseek}</TableHead>
                <TableHead className="text-right">{labels.gptGemini}</TableHead>
                <TableHead className="text-right">{labels.unmatched}</TableHead>
                <TableHead className="text-right">{tr('Hiện đáp án', 'Shown', '显示', '表示', '표시')}</TableHead>
                <TableHead className="text-right">{labels.knowledgeOk}</TableHead>
                <TableHead className="text-right">{labels.knowledgeNot}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...stats.days].reverse().map((day) => {
                const total = answerTotal(day)
                const knowledgeTotal = day.knowledgeOk + day.knowledgeNot
                if (total === 0 && knowledgeTotal === 0) return null
                return (
                  <TableRow key={day.day}>
                    <TableCell>{formatIctYmdVi(day.day)}</TableCell>
                    <TableCell className="text-right">{day.agree.toLocaleString(localeTag)}</TableCell>
                    <TableCell className="text-right">{day.gptDeepseek.toLocaleString(localeTag)}</TableCell>
                    <TableCell className="text-right">{day.gptGemini.toLocaleString(localeTag)}</TableCell>
                    <TableCell className="text-right">{day.unmatched.toLocaleString(localeTag)}</TableCell>
                    <TableCell className="text-right">{formatRate(rate(shownTotal(day), total), localeTag)}</TableCell>
                    <TableCell className="text-right">{day.knowledgeOk.toLocaleString(localeTag)}</TableCell>
                    <TableCell className="text-right">{day.knowledgeNot.toLocaleString(localeTag)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {stats.locales.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr('Theo ngôn ngữ', 'By language', '按语言', '言語別', '언어별')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('Ngôn ngữ', 'Language', '语言', '言語', '언어')}</TableHead>
                  <TableHead className="text-right">{tr('Đáp án', 'Answers', '答案', '答え', '답')}</TableHead>
                  <TableHead className="text-right">{tr('Dòng kiến thức', 'Knowledge lines', '知识点', '知識', '지식')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.locales.map((row) => (
                  <TableRow key={row.locale}>
                    <TableCell>{row.locale}</TableCell>
                    <TableCell className="text-right">{row.answers.toLocaleString(localeTag)}</TableCell>
                    <TableCell className="text-right">{row.knowledge.toLocaleString(localeTag)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
