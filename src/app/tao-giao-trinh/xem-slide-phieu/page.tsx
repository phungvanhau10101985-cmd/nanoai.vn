'use client'

import { XemSlideStudentClient } from '../components/xem-slide-student-client'

/** Trình chiếu học sinh – phiếu bài tập (mở từ giao viên có `worksheetId`). Giáo trình: `/tao-giao-trinh/xem-slide`. */
export default function XemSlidePhieuPage() {
  return <XemSlideStudentClient presentationKind="worksheet" />
}
