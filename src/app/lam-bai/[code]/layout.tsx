import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'

export default async function LamBaiExamLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const currentHref = `/lam-bai/${encodeURIComponent(code)}`
  return <CreationToolPageShell currentHref={currentHref}>{children}</CreationToolPageShell>
}
