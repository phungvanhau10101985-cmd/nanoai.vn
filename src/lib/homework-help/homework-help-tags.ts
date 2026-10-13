import { bindLabelsToSaved, type TutorTopicName } from '@/lib/ai-tutor/ai-tutor-match'
import type { TutorLabel } from '@/lib/ai-tutor/ai-tutor-types'
import { knowledgeLinesAsTags, type HomeworkProblem } from '@/lib/homework-help/homework-help-guide'

/**
 * Gắn nhãn kiến thức của một câu bài vào kho chủ đề gia sư.
 * Nhãn model gửi lên được ưu tiên. Không có thì lấy từ dòng kiến thức đã giữ.
 * Trùng tên đã lưu thì dùng đúng khóa đó, để hai bên đọc một kho.
 */
export function attachHomeworkTags(problem: HomeworkProblem, saved: TutorTopicName[]): TutorLabel[] {
  const bound = bindLabelsToSaved(problem.tags, saved, '')
  if (bound.length > 0) return bound
  return bindLabelsToSaved(knowledgeLinesAsTags(problem.knowledge), saved, '')
}
