'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

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
  revalidatePath(`/phieu-bai-tap/${worksheetId}/ket-qua`)
  return { success: true }
}
