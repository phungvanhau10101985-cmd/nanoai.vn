import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  CURRICULUM_DAILY_FREE_BODIES,
  readCurriculumDailyBodyQuota,
} from '@/lib/curriculum-ai-charge-policy'
import { getVietnamDateYmd } from '@/lib/curriculum-vietnam-date'

export const dynamic = 'force-dynamic'

/**
 * GET: quota miễn phí AI giáo trình trong ngày (theo giờ VN).
 */
export async function GET() {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }, { status: 503 })
    }

    const dailyQuota = await readCurriculumDailyBodyQuota(auth.user.id)

    return NextResponse.json({
      ok: true,
      usageDate: getVietnamDateYmd(),
      dailyFreeBodies: CURRICULUM_DAILY_FREE_BODIES,
      dailyQuota,
      rules: {
        freeBodiesPerDay: CURRICULUM_DAILY_FREE_BODIES,
        bodyChargeFromNth: CURRICULUM_DAILY_FREE_BODIES + 1,
        slideFirstUsePerLesson: 'free',
        slideRegenerate: 'charged',
        infographicFirstUse: 'free',
        infographicRegenerate: 'charged',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
