import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FixWordExamplesButton } from './fix-word-examples-button'
import { FixWordMeaningButton } from './fix-word-meaning-button'

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
      'id, user_id, session_id, target_language, native_language, language_code, learner_level, topic_id, topic_label, teacher_label, teacher_locale, mode, learning_mode, total_messages, duration_seconds, ended_at, completion_reason'
    )
    .order('ended_at', { ascending: false })
    .limit(200)
  const lessons = Array.isArray(rows) ? (rows as CompletedLessonRow[]) : []
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

  return (
    <div className="space-y-6">
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FixWordExamplesButton />
        <FixWordMeaningButton />
      </div>

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
                {lessons.map((item) => (
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
                      <TableHead>{tr('Cặp ngôn ngữ', 'Language pair', '语言对', '言語ペア', '언어 페어')}</TableHead>
                      <TableHead>{tr('Level', 'Level', '级别', 'レベル', '레벨')}</TableHead>
                      <TableHead>{tr('Mode', 'Mode', '模式', 'モード', '모드')}</TableHead>
                      <TableHead>{tr('Setup', 'Setup', '设置', '設定', '설정')}</TableHead>
                      <TableHead>{tr('Lượt chat', 'Messages', '消息数', 'メッセージ数', '메시지 수')}</TableHead>
                      <TableHead>{tr('Thời lượng', 'Duration', '时长', '時間', '시간')}</TableHead>
                      <TableHead>{tr('Loại / Xóa', 'Reason / Delete', '类型 / 删除', '種別 / 削除', '유형 / 삭제')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lessons.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs">
                          {item.ended_at ? new Date(item.ended_at).toLocaleString(localeTag) : '-'}
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
                        <TableCell className="text-xs">
                          <div className="space-y-1">
                            <p><span className="text-muted-foreground">{tr('Giáo viên', 'Teacher', '教师', '教師', '교사')}:</span> {item.teacher_label || '-'}</p>
                            <p><span className="text-muted-foreground">{tr('Locale', 'Locale', '地区', 'ロケール', '로케일')}:</span> {item.teacher_locale || '-'}</p>
                            <p><span className="text-muted-foreground">{tr('Mã ngôn ngữ', 'Language code', '语言代码', '言語コード', '언어 코드')}:</span> {item.language_code || '-'}</p>
                            <p><span className="text-muted-foreground">{tr('Topic ID', 'Topic ID', '主题ID', 'トピックID', '주제 ID')}:</span> {item.topic_id || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{item.total_messages ?? 0}</TableCell>
                        <TableCell>{formatDuration(Number(item.duration_seconds || 0))}</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <span>{item.completion_reason || '-'}</span>
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
