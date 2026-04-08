import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { getUserForAction } from '@/lib/auth'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

const MAX_IMAGES = 10

/** Endpoint 1: chỉ tách câu từ SGK (không giải tự luận). */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const userId = auth.user?.id

    const formData = await req.formData()
    const images = formData.getAll('images') as File[]
    let files = images.filter((f) => f && typeof f === 'object' && f.size > 0)
    if (files.length === 0) {
      const single = formData.get('image') as File | null
      if (single && single.size > 0) files = [single]
    }
    if (files.length === 0) return NextResponse.json({ error: 'Vui lòng chọn ảnh bài tập SGK.' }, { status: 400 })
    if (files.length > MAX_IMAGES) return NextResponse.json({ error: `Tối đa ${MAX_IMAGES} ảnh.` }, { status: 400 })

    const curriculumMarkdown = (formData.get('curriculumMarkdown') as string)?.trim() || ''
    if (!curriculumMarkdown) return NextResponse.json({ error: 'Vui lòng tạo giáo trình trước.' }, { status: 400 })

    const curriculumId = (formData.get('curriculumId') as string)?.trim() || null
    const worksheetId = (formData.get('worksheetId') as string)?.trim() || null
    const topic = (formData.get('topic') as string)?.trim() || 'Phiếu bài tập'
    const subjectId = (formData.get('subjectId') as string)?.trim() || 'toan'
    const gradeLevelId = (formData.get('gradeLevelId') as string)?.trim() || 'lop-6'

    const jobId = randomUUID()
    const imageUrls: string[] = []
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const jobPrefix = `worksheet-sgk/job-${jobId}`
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.type?.includes('jpeg') || file.type?.includes('jpg') ? 'jpg' : 'png'
        const path = `${jobPrefix}/${Date.now()}_${i}.${ext}`
        const buf = Buffer.from(await file.arrayBuffer())
        try {
          const { publicUrl } = await uploadTryOnImagePublic(admin, path, buf, {
            contentType: file.type || 'image/png',
            upsert: true,
          })
          imageUrls.push(publicUrl)
        } catch {
          /* skip failed slice */
        }
      }
    }

    if (imageUrls.length === 0) return NextResponse.json({ error: 'Không upload được ảnh.' }, { status: 500 })

    const { error: insertErr } = await supabase.from('worksheet_jobs').insert({
      id: jobId,
      user_id: userId,
      type: 'parse_sgk_extract',
      status: 'pending',
      params: {
        curriculumId,
        worksheetId,
        topic,
        subjectId,
        gradeLevelId,
        curriculumMarkdown,
        imageUrls,
      },
    })
    if (insertErr) return NextResponse.json({ error: insertErr.message || 'Lỗi tạo job.' }, { status: 500 })

    return NextResponse.json({ jobId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
