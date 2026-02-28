import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FixWordExamplesButton } from './fix-word-examples-button'
import { FixWordMeaningButton } from './fix-word-meaning-button'

type CompletedLessonRow = {
  id: string
  user_id: string
  session_id: string
  target_language: string | null
  native_language: string | null
  learner_level: number | null
  topic_label: string | null
  mode: string | null
  learning_mode: string | null
  total_messages: number | null
  duration_seconds: number | null
  ended_at: string | null
  completion_reason: string | null
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

export default async function AdminEnglishCoachPage() {
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
  const { data: rows, error } = await adminSupabase
    .from('language_coach_completed_lessons')
    .select(
      'id, user_id, session_id, target_language, native_language, learner_level, topic_label, mode, learning_mode, total_messages, duration_seconds, ended_at, completion_reason'
    )
    .order('ended_at', { ascending: false })
    .limit(200)
  const lessons = Array.isArray(rows) ? (rows as CompletedLessonRow[]) : []

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">{tr('Học tiếng Anh AI', 'English Coach AI', '英语教练 AI', '英語コーチ AI', '영어 코치 AI')}</h2>
      <FixWordExamplesButton />
      <FixWordMeaningButton />
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
          <div className="text-xs text-muted-foreground">
            {tr('Tổng', 'Total', '总计', '合計', '총')} <span className="font-semibold">{lessons.length}</span> {tr('bài', 'lessons', '课', '件', '개')}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('Thời điểm', 'Ended at', '结束时间', '終了日時', '종료 시각')}</TableHead>
                <TableHead>{tr('Chủ đề', 'Topic', '主题', 'トピック', '주제')}</TableHead>
                <TableHead>{tr('Cặp ngôn ngữ', 'Language pair', '语言对', '言語ペア', '언어 페어')}</TableHead>
                <TableHead>{tr('Level', 'Level', '级别', 'レベル', '레벨')}</TableHead>
                <TableHead>{tr('Mode', 'Mode', '模式', 'モード', '모드')}</TableHead>
                <TableHead>{tr('Lượt chat', 'Messages', '消息数', 'メッセージ数', '메시지 수')}</TableHead>
                <TableHead>{tr('Thời lượng', 'Duration', '时长', '時間', '시간')}</TableHead>
                <TableHead>{tr('Loại', 'Reason', '类型', '種別', '유형')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lessons.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs">
                    {item.ended_at ? new Date(item.ended_at).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate" title={item.topic_label || ''}>
                    {item.topic_label || '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {(item.target_language || '-')} / {(item.native_language || '-')}
                  </TableCell>
                  <TableCell>{item.learner_level ?? 0}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{item.mode || '-'}</Badge>
                      <Badge variant="secondary">{item.learning_mode || '-'}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>{item.total_messages ?? 0}</TableCell>
                  <TableCell>{formatDuration(Number(item.duration_seconds || 0))}</TableCell>
                  <TableCell className="text-xs">{item.completion_reason || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
