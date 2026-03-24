'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { parseWorksheetMarkdown } from '@/lib/parse-worksheet-markdown'
import { worksheetDisplayMarkdownFromDb } from '@/app/tao-giao-trinh/lib/merge-worksheet-content'
import { getServerDictionary } from '@/lib/i18n/server'

export async function submitWorksheet(
  worksheetId: string,
  classId: string,
  answersJson: { quiz?: Record<string, number>; essay?: Record<string, string> },
  quizScore: number,
  quizTotal: number
) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: member } = await supabase
    .from('class_members')
    .select('id')
    .eq('class_id', classId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return { error: 'Bạn chưa tham gia lớp này.' }

  const { data: cw } = await supabase
    .from('class_worksheets')
    .select('id')
    .eq('class_id', classId)
    .eq('worksheet_id', worksheetId)
    .maybeSingle()

  if (!cw) return { error: 'Phiếu chưa được gán cho lớp.' }

  const { data: wsRow } = await supabase
    .from('worksheet_worksheets')
    .select('content_markdown, question_ids')
    .eq('id', worksheetId)
    .single()

  if (!wsRow) return { error: 'Không tìm thấy phiếu bài tập.' }

  const qids = (wsRow.question_ids ?? []) as string[]
  const displayMd =
    qids.length > 0
      ? await worksheetDisplayMarkdownFromDb(supabase, wsRow.content_markdown ?? '', qids)
      : (wsRow.content_markdown ?? '')
  const parsed = parseWorksheetMarkdown(displayMd)
  if (parsed.quiz.length === 0 && parsed.essay.length === 0) {
    const { t } = getServerDictionary()
    return { error: t.classes.worksheetSubmitNoInteractiveError }
  }

  const { error } = await supabase.from('worksheet_submissions').upsert(
    {
      worksheet_id: worksheetId,
      class_id: classId,
      user_id: user.id,
      answers_json: answersJson,
      quiz_score: quizScore,
      quiz_total: quizTotal,
    },
    { onConflict: 'worksheet_id,class_id,user_id' }
  )

  if (error) return { error: error.message }
  revalidatePath(`/lop/${classId}`)
  revalidatePath(`/lop/${classId}/phieu-bai-tap`)
  revalidatePath(`/phieu-bai-tap/${worksheetId}/ket-qua`)
  return { success: true }
}
