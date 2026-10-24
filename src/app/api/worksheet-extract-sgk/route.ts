import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { insertWorksheetJobFromPg } from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { preflightSgkExtract, WorksheetCreditsError } from '@/lib/db/worksheet-ai-quota-pg'
import { getUserForAction } from '@/lib/auth'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

const MAX_IMAGES = 10

/** Ảnh trang bài tập chỉ để nhận dạng dạng bài. Phiếu nhận câu mới cùng dạng, không lưu ảnh. */
export async function POST(req: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const userId = auth.user?.id

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

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

    try {
      const gate = await preflightSgkExtract({ userId: userId!, curriculumId })
      if (!gate.ok) {
        const denied = new WorksheetCreditsError(gate.required, gate.balance, gate.freeRemaining)
        return NextResponse.json(
          {
            error: denied.message,
            code: denied.code,
            required: denied.required,
            balance: denied.balance,
            freeRemaining: denied.freeRemaining,
          },
          { status: 402 }
        )
      }
    } catch (quotaError) {
      const msg = quotaError instanceof Error ? quotaError.message : String(quotaError)
      return NextResponse.json({ error: msg }, { status: 503 })
    }
    const topic = (formData.get('topic') as string)?.trim() || 'Phiếu bài tập'
    const subjectId = (formData.get('subjectId') as string)?.trim() || 'toan'
    const gradeLevelId = (formData.get('gradeLevelId') as string)?.trim() || 'lop-6'

    const jobId = randomUUID()
    const imageUrls: string[] = []
    const jobPrefix = `worksheet-sgk/job-${jobId}`
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.type?.includes('jpeg') || file.type?.includes('jpg') ? 'jpg' : 'png'
      const path = `${jobPrefix}/${Date.now()}_${i}.${ext}`
      const buf = Buffer.from(await file.arrayBuffer())
      try {
        const { publicUrl } = await uploadTryOnImagePublic(path, buf, {
          contentType: file.type || 'image/png',
          upsert: true,
        })
        imageUrls.push(publicUrl)
      } catch {
        /* skip failed slice */
      }
    }

    if (imageUrls.length === 0) return NextResponse.json({ error: 'Không upload được ảnh.' }, { status: 500 })

    const jobParams = {
      curriculumId,
      worksheetId,
      topic,
      subjectId,
      gradeLevelId,
      curriculumMarkdown,
      imageUrls,
    }

    const id = await insertWorksheetJobFromPg({
      id: jobId,
      userId: userId!,
      type: 'parse_sgk_extract',
      params: jobParams,
    })
    if (!id) return NextResponse.json({ error: 'Không tạo được job.' }, { status: 500 })

    return NextResponse.json({ jobId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
