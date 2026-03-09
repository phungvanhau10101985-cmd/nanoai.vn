import { SlideProposalsClient } from './slide-proposals-client'

export const metadata = {
  title: 'Đề xuất sửa slide',
  description: 'Danh sách đề xuất sửa/bổ sung slide từ giáo viên',
}

export default function AdminSlideProposalsPage() {
  return <SlideProposalsClient />
}
