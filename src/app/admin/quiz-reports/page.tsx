import { QuizReportsClient } from './quiz-reports-client'

export const metadata = {
  title: 'Báo cáo câu hỏi sai',
  description: 'Danh sách báo cáo câu hỏi trắc nghiệm sai từ giáo viên – chờ admin duyệt',
}

export default function AdminQuizReportsPage() {
  return <QuizReportsClient />
}
