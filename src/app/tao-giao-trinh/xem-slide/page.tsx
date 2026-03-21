'use client'

import { XemSlideStudentClient } from '../components/xem-slide-student-client'

/** Trình chiếu học sinh – giáo trình & link chia sẻ (?share=). Phiếu bài tập: `/tao-giao-trinh/xem-slide-phieu`. */
export default function XemSlidePage() {
  return <XemSlideStudentClient presentationKind="curriculum" />
}
