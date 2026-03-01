import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FixWordExamplesButton } from './fix-word-examples-button'
import { FixWordMeaningButton } from './fix-word-meaning-button'
import { AdminFilterPersist } from './admin-filter-persist'

type CompletedLessonRow = {
  id: string
  user_id: string
  session_id: string
  target_language: string | null
  native_language: string | null
  language_code: string | null
  learner_level: number | null
  topic_id: string | null
  topic_label: string | null
  teacher_label: string | null
  teacher_locale: string | null
  mode: string | null
  learning_mode: string | null
  total_messages: number | null
  duration_seconds: number | null
  ended_at: string | null
  completion_reason: string | null
  summary_json: string | null
}

type ReviewDrillStats = {
  speakingPass: number
  speakingFail: number
  listeningPass: number
  listeningFail: number
  hintServed: number
}

function parseReviewDrillStatsFromPinnedFacts(raw: string): ReviewDrillStats | null {
  try {
    const root = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const src = root?.review_drill_stats
    if (!src || typeof src !== 'object') return null
    const row = src as Record<string, unknown>
    return {
      speakingPass: Math.max(0, Math.floor(Number(row.speakingPass || 0) || 0)),
      speakingFail: Math.max(0, Math.floor(Number(row.speakingFail || 0) || 0)),
      listeningPass: Math.max(0, Math.floor(Number(row.listeningPass || 0) || 0)),
      listeningFail: Math.max(0, Math.floor(Number(row.listeningFail || 0) || 0)),
      hintServed: Math.max(0, Math.floor(Number(row.hintServed || 0) || 0)),
    }
  } catch {
    return null
  }
}

function parseReviewDrillStatsFromSummaryJson(raw: string): ReviewDrillStats | null {
  try {
    const root = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const src = root?.reviewDrillStats
    if (!src || typeof src !== 'object') return null
    const row = src as Record<string, unknown>
    return {
      speakingPass: Math.max(0, Math.floor(Number(row.speakingPass || 0) || 0)),
      speakingFail: Math.max(0, Math.floor(Number(row.speakingFail || 0) || 0)),
      listeningPass: Math.max(0, Math.floor(Number(row.listeningPass || 0) || 0)),
      listeningFail: Math.max(0, Math.floor(Number(row.listeningFail || 0) || 0)),
      hintServed: Math.max(0, Math.floor(Number(row.hintServed || 0) || 0)),
    }
  } catch {
    return null
  }
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

function toLocaleTag(uiLocale: 'vi' | 'en' | 'zh' | 'ja' | 'ko'): string {
  if (uiLocale === 'en') return 'en-US'
  if (uiLocale === 'zh') return 'zh-CN'
  if (uiLocale === 'ja') return 'ja-JP'
  if (uiLocale === 'ko') return 'ko-KR'
  return 'vi-VN'
}

async function deleteCompletedLessonAction(formData: FormData) {
  'use server'
  const lessonId = String(formData.get('lessonId') || '').trim()
  if (!lessonId) return
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await adminSupabase
    .from('language_coach_completed_lessons')
    .delete()
    .eq('id', lessonId)
  revalidatePath('/admin/english-coach')
}

export default async function AdminEnglishCoachPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const uiLocale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const sortRaw = Array.isArray(searchParams?.sort) ? searchParams?.sort[0] : searchParams?.sort
  const minRateRaw = Array.isArray(searchParams?.minRate) ? searchParams?.minRate[0] : searchParams?.minRate
  const resetRaw = Array.isArray(searchParams?.reset) ? searchParams?.reset[0] : searchParams?.reset
  const sortBy = (
    sortRaw === 'oldest'
    || sortRaw === 'drill_rate_desc'
    || sortRaw === 'drill_rate_asc'
  ) ? sortRaw : 'newest'
  const minRate = Number.isFinite(Number(minRateRaw))
    ? Math.max(0, Math.min(100, Math.floor(Number(minRateRaw))))
    : 0
  const shouldResetFilterMemory = String(resetRaw || '') === '1'
  const hasActiveFilterQuery = Boolean(String(sortRaw || '').trim() || String(minRateRaw || '').trim())
  const { data: rows, error } = await adminSupabase
    .from('language_coach_completed_lessons')
    .select(
      'id, user_id, session_id, target_language, native_language, language_code, learner_level, topic_id, topic_label, teacher_label, teacher_locale, mode, learning_mode, total_messages, duration_seconds, ended_at, completion_reason, summary_json'
    )
    .order('ended_at', { ascending: false })
    .limit(200)
  const lessons = Array.isArray(rows) ? (rows as CompletedLessonRow[]) : []
  const lessonSessionIds = [...new Set(lessons.map((x) => String(x.session_id || '').trim()).filter(Boolean))]
  const reviewDrillStatsByKey = new Map<string, ReviewDrillStats>()
  if (lessonSessionIds.length > 0) {
    const { data: memoryRows } = await adminSupabase
      .from('language_coach_session_memories')
      .select('user_id, session_id, pinned_facts_json')
      .in('session_id', lessonSessionIds)
      .limit(1000)
    for (const row of (memoryRows ?? []) as Array<{ user_id?: string; session_id?: string; pinned_facts_json?: string }>) {
      const uid = String(row.user_id || '').trim()
      const sid = String(row.session_id || '').trim()
      if (!uid || !sid) continue
      const stats = parseReviewDrillStatsFromPinnedFacts(String(row.pinned_facts_json || '{}'))
      if (stats) reviewDrillStatsByKey.set(`${uid}:${sid}`, stats)
    }
  }
  const withStatsRaw = lessons.map((item) => ({
    item,
    stats: (() => {
      const memoryStats = reviewDrillStatsByKey.get(`${String(item.user_id || '').trim()}:${String(item.session_id || '').trim()}`) || null
      if (memoryStats) return memoryStats
      const summaryStats = parseReviewDrillStatsFromSummaryJson(String(item.summary_json || ''))
      if (summaryStats) return summaryStats
      if (String(item.learning_mode || '') === 'review') {
        return {
          speakingPass: 0,
          speakingFail: 0,
          listeningPass: 0,
          listeningFail: 0,
          hintServed: 0,
        } satisfies ReviewDrillStats
      }
      return null
    })(),
    drillRate: (() => {
      const stats = (() => {
        const memoryStats = reviewDrillStatsByKey.get(`${String(item.user_id || '').trim()}:${String(item.session_id || '').trim()}`) || null
        if (memoryStats) return memoryStats
        const summaryStats = parseReviewDrillStatsFromSummaryJson(String(item.summary_json || ''))
        if (summaryStats) return summaryStats
        if (String(item.learning_mode || '') === 'review') {
          return {
            speakingPass: 0,
            speakingFail: 0,
            listeningPass: 0,
            listeningFail: 0,
            hintServed: 0,
          } satisfies ReviewDrillStats
        }
        return null
      })()
      if (!stats) return null
      const pass = stats.speakingPass + stats.listeningPass
      const fail = stats.speakingFail + stats.listeningFail
      const total = pass + fail
      if (total <= 0) return null
      return Math.round((pass * 100) / total)
    })(),
  }))
  const withStats = withStatsRaw
    .filter((x) => (x.drillRate == null ? minRate <= 0 : x.drillRate >= minRate))
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return String(a.item.ended_at || '').localeCompare(String(b.item.ended_at || ''))
      }
      if (sortBy === 'drill_rate_desc') {
        return (b.drillRate ?? -1) - (a.drillRate ?? -1)
      }
      if (sortBy === 'drill_rate_asc') {
        return (a.drillRate ?? 101) - (b.drillRate ?? 101)
      }
      return String(b.item.ended_at || '').localeCompare(String(a.item.ended_at || ''))
    })
  const localeTag = toLocaleTag(uiLocale)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recent7d = lessons.filter((x) => {
    const t = Date.parse(String(x.ended_at || ''))
    return Number.isFinite(t) && t >= sevenDaysAgo
  }).length
  const avgDurationSec = lessons.length > 0
    ? Math.round(lessons.reduce((acc, x) => acc + Math.max(0, Number(x.duration_seconds || 0)), 0) / lessons.length)
    : 0
  const reflexCount = lessons.filter((x) => String(x.learning_mode || '') === 'reflex').length
  const speakingPassTotal = withStats.reduce((acc, x) => acc + (x.stats?.speakingPass || 0), 0)
  const speakingFailTotal = withStats.reduce((acc, x) => acc + (x.stats?.speakingFail || 0), 0)
  const listeningPassTotal = withStats.reduce((acc, x) => acc + (x.stats?.listeningPass || 0), 0)
  const listeningFailTotal = withStats.reduce((acc, x) => acc + (x.stats?.listeningFail || 0), 0)
  const speakingRate = speakingPassTotal + speakingFailTotal > 0
    ? Math.round((speakingPassTotal * 100) / (speakingPassTotal + speakingFailTotal))
    : 0
  const listeningRate = listeningPassTotal + listeningFailTotal > 0
    ? Math.round((listeningPassTotal * 100) / (listeningPassTotal + listeningFailTotal))
    : 0

  return (
    <div className="space-y-6">
      <AdminFilterPersist
        basePath="/admin/english-coach"
        hasActiveQuery={hasActiveFilterQuery}
        sortBy={sortBy}
        minRate={minRate}
        shouldReset={shouldResetFilterMemory}
      />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {tr('Học tiếng Anh AI', 'English Coach AI', '英语教练 AI', '英語コーチ AI', '영어 코치 AI')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tr(
            'Công cụ quản trị dữ liệu từ vựng, bài học đã lưu và tái sử dụng cho học viên.',
            'Admin tools for vocabulary normalization and saved lesson reuse.',
            '用于词汇规范化与已保存课程复用的管理工具。',
            '語彙正規化と保存済みレッスン再利用の管理ツールです。',
            '어휘 정규화 및 저장된 레슨 재사용을 위한 관리자 도구입니다.'
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{tr('Tổng bài đã lưu', 'Total saved lessons', '已保存课程总数', '保存済みレッスン合計', '저장된 레슨 수')}</CardDescription>
            <CardTitle className="text-2xl">{lessons.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{tr('Trong 7 ngày', 'Last 7 days', '最近 7 天', '直近7日', '최근 7일')}</CardDescription>
            <CardTitle className="text-2xl">{recent7d}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{tr('Thời lượng TB', 'Avg duration', '平均时长', '平均時間', '평균 시간')}</CardDescription>
            <CardTitle className="text-2xl">{formatDuration(avgDurationSec)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{tr('Reflex mode', 'Reflex mode', '反应模式', '反射モード', '반사 모드')}</CardDescription>
            <CardTitle className="text-2xl">{reflexCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{tr('Mini-drill nói', 'Mini-drill speaking', '口语小练习', '発話ミニドリル', '말하기 미니드릴')}</CardDescription>
            <CardTitle className="text-2xl">{speakingRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{tr('Mini-drill nghe', 'Mini-drill listening', '听力小练习', 'リスニングミニドリル', '듣기 미니드릴')}</CardDescription>
            <CardTitle className="text-2xl">{listeningRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FixWordExamplesButton />
        <FixWordMeaningButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tr('Lọc & sắp xếp', 'Filter & sort', '筛选与排序', 'フィルターと並び替え', '필터 및 정렬')}</CardTitle>
          <CardDescription>
            {tr(
              'Lọc theo pass rate mini-drill và sắp xếp nhanh danh sách bài học.',
              'Filter by mini-drill pass rate and quickly sort lessons.',
              '按小练习通过率筛选并快速排序课程。',
              'ミニドリル通過率で絞り込み、レッスンを素早く並び替えます。',
              '미니드릴 통과율로 필터링하고 레슨을 빠르게 정렬합니다.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                {tr('Sắp xếp', 'Sort', '排序', '並び替え', '정렬')}
              </span>
              <select name="sort" defaultValue={sortBy} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="newest">{tr('Mới nhất', 'Newest first', '最新优先', '新しい順', '최신순')}</option>
                <option value="oldest">{tr('Cũ nhất', 'Oldest first', '最早优先', '古い順', '오래된순')}</option>
                <option value="drill_rate_desc">{tr('Pass rate cao → thấp', 'Pass rate high → low', '通过率高到低', '通過率 高→低', '통과율 높음→낮음')}</option>
                <option value="drill_rate_asc">{tr('Pass rate thấp → cao', 'Pass rate low → high', '通过率低到高', '通過率 低→高', '통과율 낮음→높음')}</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                {tr('Pass rate tối thiểu (%)', 'Minimum pass rate (%)', '最小通过率 (%)', '最小通過率 (%)', '최소 통과율 (%)')}
              </span>
              <input
                name="minRate"
                type="number"
                min={0}
                max={100}
                defaultValue={String(minRate)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" className="h-10">
                {tr('Áp dụng', 'Apply', '应用', '適用', '적용')}
              </Button>
              <a
                href="/admin/english-coach?reset=1"
                className="inline-flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                {tr('Xóa lọc', 'Reset', '重置', 'リセット', '초기화')}
              </a>
            </div>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            {tr('Đang hiển thị', 'Showing', '显示', '表示中', '표시 중')}: {withStats.length} / {lessons.length}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr('Bài học đã lưu', 'Saved lessons', '已保存课程', '保存済みレッスン', '저장된 레슨')}</CardTitle>
          <CardDescription>
            {tr(
              'Danh sách bài học đã hoàn thành được snapshot để tái sử dụng.',
              'Completed lessons snapshot list for reuse.',
              '用于复用的已完成课程快照列表。',
              '再利用のための完了レッスンスナップショット一覧です。',
              '재사용을 위한 완료 레슨 스냅샷 목록입니다.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <p className="text-sm text-red-600">
              {tr('Không tải được dữ liệu:', 'Failed to load data:', '无法加载数据：', 'データを読み込めません：', '데이터를 불러오지 못했습니다:')} {error.message}
            </p>
          ) : null}
          {lessons.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {tr('Chưa có bài học đã lưu.', 'No saved lessons yet.', '暂无已保存课程。', '保存済みレッスンはまだありません。', '아직 저장된 레슨이 없습니다.')}
            </div>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {withStats.map(({ item, stats, drillRate }) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {item.ended_at ? new Date(item.ended_at).toLocaleString(localeTag) : '-'}
                      </p>
                      <Badge variant="outline">L{item.learner_level ?? 0}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium">{item.topic_label || '-'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(item.target_language || '-')} / {(item.native_language || '-')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="outline">{item.mode || '-'}</Badge>
                      <Badge variant="secondary">{item.learning_mode || '-'}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">{tr('Chat', 'Msgs', '消息', '件数', '메시지')}</p>
                        <p className="font-medium">{item.total_messages ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{tr('Thời lượng', 'Duration', '时长', '時間', '시간')}</p>
                        <p className="font-medium">{formatDuration(Number(item.duration_seconds || 0))}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{tr('Loại', 'Reason', '类型', '種別', '유형')}</p>
                        <p className="font-medium">{item.completion_reason || '-'}</p>
                      </div>
                    </div>
                    <div className="mt-2 rounded-md bg-indigo-50 p-2 text-xs text-indigo-700">
                      {tr('Mini-drill', 'Mini-drill', '小练习', 'ミニドリル', '미니드릴')}:{' '}
                      {stats
                        ? `S ${stats.speakingPass}/${stats.speakingFail} • L ${stats.listeningPass}/${stats.listeningFail} • ${tr('Rate', 'Rate', '通过率', '通過率', '통과율')} ${drillRate ?? '-'}% • Hint ${stats.hintServed}`
                        : String(item.learning_mode || '') === 'reflex'
                          ? tr('Không áp dụng (Reflex)', 'Not applicable (Reflex)', '不适用（Reflex）', '対象外（Reflex）', '해당 없음 (Reflex)')
                          : '-'}
                    </div>
                    <div className="mt-2 rounded-md bg-slate-50 p-2 text-xs">
                      <p className="font-medium text-slate-700">
                        {tr('Setup bài học', 'Lesson setup', '课程设置', 'レッスン設定', '레슨 설정')}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {tr('Giáo viên', 'Teacher', '教师', '教師', '교사')}: {item.teacher_label || '-'}
                      </p>
                      <p className="text-muted-foreground">
                        {tr('Giọng/Locale', 'Voice/Locale', '语音/地区', '音声/ロケール', '음성/로케일')}: {item.teacher_locale || '-'}
                      </p>
                      <p className="text-muted-foreground">
                        {tr('Mã ngôn ngữ học', 'Target code', '学习语言代码', '学習言語コード', '학습 언어 코드')}: {item.language_code || '-'}
                      </p>
                      <p className="text-muted-foreground">
                        {tr('Topic ID', 'Topic ID', '主题ID', 'トピックID', '주제 ID')}: {item.topic_id || '-'}
                      </p>
                    </div>
                    <div className="mt-3">
                      <form action={deleteCompletedLessonAction}>
                        <input type="hidden" name="lessonId" value={item.id} />
                        <Button type="submit" variant="outline" size="sm" className="min-h-[36px] text-red-600 hover:text-red-700">
                          {tr('Xóa bài học', 'Delete lesson', '删除课程', 'レッスン削除', '레슨 삭제')}
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr('Thời điểm', 'Ended at', '结束时间', '終了日時', '종료 시각')}</TableHead>
                      <TableHead>{tr('Chủ đề', 'Topic', '主题', 'トピック', '주제')}</TableHead>
                      <TableHead>{tr('Ngôn ngữ học', 'Target language', '学习语言', '学習言語', '학습 언어')}</TableHead>
                      <TableHead>{tr('Ngôn ngữ mẹ đẻ', 'Native language', '母语', '母語', '모국어')}</TableHead>
                      <TableHead>{tr('Giáo viên', 'Teacher', '教师', '教師', '교사')}</TableHead>
                      <TableHead>{tr('Level', 'Level', '级别', 'レベル', '레벨')}</TableHead>
                      <TableHead>{tr('Chế độ học', 'Learning mode', '学习模式', '学習モード', '학습 모드')}</TableHead>
                      <TableHead>{tr('Mode hội thoại', 'Conversation mode', '会话模式', '会話モード', '대화 모드')}</TableHead>
                      <TableHead>{tr('Lượt chat', 'Messages', '消息数', 'メッセージ数', '메시지 수')}</TableHead>
                      <TableHead>{tr('Thời lượng', 'Duration', '时长', '時間', '시간')}</TableHead>
                      <TableHead>{tr('Loại / Xóa', 'Reason / Delete', '类型 / 删除', '種別 / 削除', '유형 / 삭제')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withStats.map(({ item, stats, drillRate }) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs">
                          {item.ended_at ? new Date(item.ended_at).toLocaleString(localeTag) : '-'}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate" title={item.topic_label || ''}>
                          {item.topic_label || '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.target_language || '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.native_language || '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.teacher_label || '-'}
                        </TableCell>
                        <TableCell>{item.learner_level ?? 0}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="secondary">{item.learning_mode || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline">{item.mode || '-'}</Badge>
                        </TableCell>
                        <TableCell>{item.total_messages ?? 0}</TableCell>
                        <TableCell>{formatDuration(Number(item.duration_seconds || 0))}</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <span>{item.completion_reason || '-'}</span>
                            <span className="text-indigo-700">
                              {stats
                                ? `S ${stats.speakingPass}/${stats.speakingFail} • L ${stats.listeningPass}/${stats.listeningFail} • R ${drillRate ?? '-'}% • H ${stats.hintServed}`
                                : String(item.learning_mode || '') === 'reflex'
                                  ? tr('N/A Reflex', 'N/A Reflex', '不适用 Reflex', 'N/A Reflex', '해당 없음 Reflex')
                                  : ''}
                            </span>
                          <form action={deleteCompletedLessonAction}>
                            <input type="hidden" name="lessonId" value={item.id} />
                            <Button type="submit" variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                              {tr('Xóa', 'Delete', '删除', '削除', '삭제')}
                            </Button>
                          </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
