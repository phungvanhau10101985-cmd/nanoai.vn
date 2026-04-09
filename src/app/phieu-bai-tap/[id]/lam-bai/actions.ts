'use server'

import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { parseWorksheetMarkdown } from '@/lib/parse-worksheet-markdown'
import { worksheetDisplayMarkdownFromDb } from '@/app/tao-giao-trinh/lib/merge-worksheet-content'
import { getServerDictionary } from '@/lib/i18n/server'
import { isPgConfigured } from '@/lib/db/pool'
import { classMemberExistsPg, classWorksheetLinkExistsPg } from '@/lib/db/classes-pg'
import {
  fetchWorksheetSheetMinimalByIdFromPg,
  upsertWorksheetSubmissionPg,
} from '@/lib/db/worksheet-pg'

export async function submitWorksheet(
  worksheetId: string,
  classId: string,
  answersJson: { quiz?: Record<string, number>; essay?: Record<string, string> },
  quizScore: number,
  quizTotal: number
) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  if (!isPgConfigured()) {
    return { error: 'Chưa cấu hình cơ sở dữ liệu.' }
  }

  const memberOk = await classMemberExistsPg(classId, user.id)
  if (memberOk !== true) {
    return { error: 'Bạn chưa tham gia lớp này.' }
  }

  const linkOk = await classWorksheetLinkExistsPg(classId, worksheetId)
  if (linkOk !== true) {
    return { error: 'Phiếu chưa được gán cho lớp.' }
  }

  const wsRow = await fetchWorksheetSheetMinimalByIdFromPg(worksheetId)
  if (!wsRow) return { error: 'Không tìm thấy phiếu bài tập.' }

  const qids = wsRow.question_ids
  const displayMd =
    qids.length > 0
      ? await worksheetDisplayMarkdownFromDb(wsRow.content_markdown ?? '', qids)
      : (wsRow.content_markdown ?? '')
  const parsed = parseWorksheetMarkdown(displayMd)
  if (parsed.quiz.length === 0 && parsed.essay.length === 0) {
    const { t } = getServerDictionary()
    return { error: t.classes.worksheetSubmitNoInteractiveError }
  }

  const ok = await upsertWorksheetSubmissionPg({
    worksheetId,
    classId,
    userId: user.id,
    answersJson,
    quizScore,
    quizTotal,
  })
  if (ok !== true) {
    return { error: 'Không lưu được bài nộp.' }
  }

  revalidatePath(`/lop/${classId}`)
  revalidatePath(`/lop/${classId}/phieu-bai-tap`)
  revalidatePath(`/phieu-bai-tap/${worksheetId}/ket-qua`)
  return { success: true }
}
