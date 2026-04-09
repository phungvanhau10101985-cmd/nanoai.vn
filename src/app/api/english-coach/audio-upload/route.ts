import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('audio') as File | null
    const sessionId = String(formData.get('sessionId') || '').trim()
    const messageId = String(formData.get('messageId') || '').trim()

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Thiếu file audio.' }, { status: 400 })
    }
    if (!sessionId || !messageId) {
      return NextResponse.json({ error: 'Thiếu sessionId hoặc messageId.' }, { status: 400 })
    }

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const extension = file.type.includes('wav') ? 'wav' : 'bin'
    const uploadPath = `english-coach-history/${user.id}/${sessionId}/${messageId}.${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())
    try {
      const { publicUrl } = await uploadTryOnImagePublic(uploadPath, buffer, {
        contentType: file.type || 'audio/wav',
        upsert: true,
      })
      return NextResponse.json({ audioUrl: publicUrl })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không upload được audio.'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

