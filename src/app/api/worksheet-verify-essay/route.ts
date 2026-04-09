import { NextRequest, NextResponse } from 'next/server'
import { verifyEssay } from '@/app/tao-giao-trinh/lib/worksheet-verify-essay'
import { getUserOrBypass } from '@/lib/auth'

/** Kiểm tra bài tự luận: đề có khớp lời giải không, công thức đúng không. */
export async function POST(req: NextRequest) {
  try {
    const u = await getUserOrBypass()
    const userId = u?.id ?? null

    const body = await req.json().catch(() => ({}))
    const curriculumMarkdown = String(body?.curriculumMarkdown ?? '').trim()
    const problem = String(body?.problem ?? '').trim()
    const solution = String(body?.solution ?? '').trim()

    if (!problem || !solution) {
      return NextResponse.json({ error: 'Thiếu đề hoặc lời giải.', verified: false }, { status: 400 })
    }

    const result = await verifyEssay(curriculumMarkdown, problem, solution, userId)
    return NextResponse.json({
      verified: result.verified,
      reason: result.reason,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg, verified: false }, { status: 500 })
  }
}
