import LamBaiClientPage from './lam-bai-client-page'

export default async function LamBaiPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <LamBaiClientPage code={code} />
}
