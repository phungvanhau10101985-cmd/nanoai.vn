import { redirect } from 'next/navigation'

/** Trình chiếu phiếu bài tập – redirect sang giao diện giáo viên (giống 100% slide giáo trình) */
export default async function TrinhChieuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/tao-giao-trinh/giao-vien?worksheetId=${encodeURIComponent(id)}`)
}
