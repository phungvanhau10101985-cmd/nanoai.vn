import { loginRosterStudentByJoinCodePg } from '@/lib/db/class-entry-pg'
import { rosterLoginJson } from '@/lib/lop/roster-login-response'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    joinCode?: unknown
    studentCode?: unknown
    password?: unknown
  } | null
  const result = await loginRosterStudentByJoinCodePg(
    String(body?.joinCode ?? ''),
    String(body?.studentCode ?? ''),
    String(body?.password ?? '')
  )
  return rosterLoginJson(result, String(body?.studentCode ?? ''))
}
