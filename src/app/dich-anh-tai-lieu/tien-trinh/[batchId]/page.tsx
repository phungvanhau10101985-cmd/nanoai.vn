import { redirect } from 'next/navigation'

export default async function TranslateProgressPage({
  params,
}: {
  params: { batchId: string }
}) {
  const { batchId } = params
  redirect(`/dich-anh-tai-lieu?batchId=${encodeURIComponent(batchId)}`)
}
