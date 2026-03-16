import { CurriculumEditReviewsClient } from './curriculum-edit-reviews-client'

export const metadata = {
  title: 'Duyệt giáo trình gửi admin',
  description: 'Giáo viên gửi khi 2 AI báo sai nhưng vẫn muốn lưu',
}

export default function AdminCurriculumEditReviewsPage() {
  return <CurriculumEditReviewsClient />
}
