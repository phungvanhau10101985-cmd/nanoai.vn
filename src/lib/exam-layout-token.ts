import { SignJWT, jwtVerify } from 'jose'

/** Payload ký trong JWT — map chỉ số đáp án hiển thị → chỉ số gốc trong DB */
export type ExamLayoutPayload = {
  sessionId: string
  userId: string
  /** Mỗi câu TN: perm[displayIdx] = originalOptionIndex */
  optionPerms: Record<string, number[]>
}

const ISS = 'exam-layout'

function getSecretKey(): Uint8Array {
  const raw =
    process.env.EXAM_LAYOUT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ''
  if (!raw) {
    throw new Error(
      'Thiếu EXAM_LAYOUT_SECRET (hoặc SUPABASE_SERVICE_ROLE_KEY) để ký layout đề thi.'
    )
  }
  return new TextEncoder().encode(raw)
}

export async function signExamLayoutToken(
  payload: ExamLayoutPayload,
  expSeconds: number
): Promise<string> {
  const secret = getSecretKey()
  return new SignJWT({
    sessionId: payload.sessionId,
    userId: payload.userId,
    optionPerms: payload.optionPerms,
  } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + Math.max(300, expSeconds))
    .setIssuer(ISS)
    .sign(secret)
}

export async function verifyExamLayoutToken(token: string): Promise<ExamLayoutPayload | null> {
  if (!token?.trim()) return null
  try {
    const secret = getSecretKey()
    const { payload } = await jwtVerify(token, secret, { issuer: ISS })
    const sessionId = String(payload.sessionId ?? '')
    const userId = String(payload.userId ?? '')
    const optionPerms = payload.optionPerms as Record<string, number[]>
    if (!sessionId || !userId || !optionPerms || typeof optionPerms !== 'object') return null
    return { sessionId, userId, optionPerms }
  } catch {
    return null
  }
}

/** Fisher–Yates shuffle (bản sao mới) */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
