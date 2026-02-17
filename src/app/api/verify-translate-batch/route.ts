/**
 * DEPRECATED: Hậu kiểm đã chuyển vào process-translate (mỗi ảnh: Gemini → OCR → overlay ngay).
 * API này giữ lại để tương thích, trả về ngay không xử lý.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const batchId = request.nextUrl.searchParams.get('batchId')
  if (!batchId) return NextResponse.json({ error: 'Missing batchId' }, { status: 400 })

  const secret = request.headers.get('x-process-secret')
  const expectedSecret = process.env.PROCESS_TRANSLATE_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, verified: 0, overlay: 0, deprecated: true })
}
