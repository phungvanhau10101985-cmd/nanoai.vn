'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createPrintReadyPdf } from '@/lib/print-ready-pdf'

/**
 * Tạo PDF chuẩn in từ URL ảnh.
 * Trả về URL PDF tạm trên Supabase để tải về.
 */
export async function generatePrintReadyPdf(
  imageUrl: string,
  widthMm: number,
  heightMm: number
): Promise<{ pdfUrl: string } | { error: string }> {
  if (!imageUrl?.trim()) return { error: 'Thiếu URL ảnh.' }
  if (widthMm < 10 || widthMm > 500 || heightMm < 10 || heightMm > 500) {
    return { error: 'Kích thước phải từ 10–500 mm.' }
  }

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xuất PDF chuẩn in.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  try {
    const res = await fetch(imageUrl, { cache: 'no-store' })
    if (!res.ok) return { error: 'Không tải được ảnh. Vui lòng thử lại.' }
    const imageBuffer = Buffer.from(await res.arrayBuffer())

    const pdfBuffer = await createPrintReadyPdf(imageBuffer, { widthMm, heightMm })

    const pdfPath = `results/${user.id}/print_ready_${Date.now()}.pdf`
    await adminSupabase.storage
      .from('try-on-images')
      .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(pdfPath)

    return { pdfUrl: urlData.publicUrl }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Xuất PDF thất bại: ${msg}` }
  }
}
