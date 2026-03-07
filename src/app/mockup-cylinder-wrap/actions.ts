'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createPrintReadyPdf } from '@/lib/print-ready-pdf'

/**
 * Tạo PDF chuẩn in từ ảnh nhãn base64.
 */
export async function generateCylinderLabelPdf(
  imageBase64: string,
  widthMm: number,
  heightMm: number
): Promise<{ pdfUrl: string } | { error: string }> {
  if (!imageBase64?.trim()) return { error: 'Thiếu dữ liệu ảnh.' }
  if (widthMm < 10 || widthMm > 800 || heightMm < 10 || heightMm > 800) {
    return { error: 'Kích thước phải từ 10–800 mm.' }
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
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    const pdfBuffer = await createPrintReadyPdf(imageBuffer, { widthMm, heightMm })

    const pdfPath = `results/${user.id}/cylinder_label_${Date.now()}.pdf`
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
