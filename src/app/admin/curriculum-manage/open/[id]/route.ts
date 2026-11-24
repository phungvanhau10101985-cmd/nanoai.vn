import { NextResponse } from 'next/server'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { attachOpenedCurriculumToAccount } from '@/lib/curriculum/attach-opened-curriculum'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { isValidUuidString } from '@/lib/validate-uuid'

export const dynamic = 'force-dynamic'

function failText(locale: string): string {
  if (locale === 'en') return 'Could not attach this curriculum to the admin account.'
  if (locale === 'zh') return '未能把这份课程挂到管理账号。'
  if (locale === 'ja') return 'この教材を管理アカウントに付けられませんでした。'
  if (locale === 'ko') return '이 교육과정을 관리 계정에 붙이지 못했습니다.'
  return 'Không gắn được giáo trình vào tài khoản quản trị.'
}

/**
 * Location tương đối. `request.url` sau proxy thường là `https://localhost:3000`,
 * trình duyệt mở nhầm máy local và báo ERR_SSL_PROTOCOL_ERROR.
 */
function redirectOnSameHost(path: string): NextResponse {
  const location = path.startsWith('/') ? path : `/${path}`
  const res = NextResponse.redirect(`http://127.0.0.1${location}`, 303)
  res.headers.set('Location', location)
  res.headers.set('Cache-Control', 'no-store')
  return res
}

/** Mở tab mới: gắn giáo trình vào tài khoản quản trị đang đăng nhập, rồi mở trang giáo trình. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') {
    return redirectOnSameHost('/')
  }

  const { id } = await context.params
  const curriculumId = id.trim()
  const locale = getCurrentWebLocale()
  if (!isValidUuidString(curriculumId)) {
    return new NextResponse(failText(locale), { status: 400 })
  }

  const attached = await attachOpenedCurriculumToAccount(user.id, curriculumId)
  if (attached.error) {
    return new NextResponse(`${failText(locale)} ${attached.error}`, { status: 500 })
  }

  const q = new URLSearchParams({ openCurriculum: curriculumId })
  return redirectOnSameHost(`/giao-trinh?${q.toString()}`)
}
