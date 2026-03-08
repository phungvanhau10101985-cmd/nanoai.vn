import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo'
import WorksheetView from './worksheet-view'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('worksheet_worksheets')
    .select('topic')
    .eq('id', params.id)
    .single()
  const title = data?.topic ? `Lời giải: ${data.topic}` : 'Phiếu bài tập - Lời giải'
  return {
    title,
    description: 'Xem đáp án và lời giải chi tiết phiếu bài tập. Quét mã QR trên phiếu để mở trang này.',
    openGraph: {
      title,
      url: `${SITE_URL}/phieu-bai-tap/${params.id}`,
    },
  }
}

export default async function PhieuBaiTapPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('worksheet_worksheets')
    .select('id, topic, content_markdown, created_at')
    .eq('id', params.id)
    .single()

  if (error || !data) notFound()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-foreground">
            Lời giải: {data.topic}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quét mã QR trên phiếu bài tập để xem trang này
          </p>
        </header>
        <WorksheetView content={data.content_markdown} />
      </div>
    </div>
  )
}
