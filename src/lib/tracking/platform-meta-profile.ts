import { pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { isValidUuidString } from '@/lib/validate-uuid'

export type PlatformMetaProfileFields = {
  fullName: string
  gender: string
  birthDate: string
  phone: string
}

const EMPTY_PROFILE: PlatformMetaProfileFields = { fullName: '', gender: '', birthDate: '', phone: '' }

/** Họ tên, giới tính, ngày sinh trên `profiles` — không đoán SĐT hay quốc gia. */
export async function loadPlatformMetaProfile(userId: string): Promise<PlatformMetaProfileFields> {
  const id = userId.trim()
  if (!isPgConfigured() || !isValidUuidString(id)) return EMPTY_PROFILE
  try {
    const row = await pgQueryOne<{ full_name: string | null; gender: string | null; birth_date: string | null }>(
      `select full_name, gender, birth_date::text as birth_date
       from public.profiles
       where id = $1::uuid
       limit 1`,
      [id]
    )
    const phone = await loadAuthUserPhone(id)
    return {
      fullName: String(row?.full_name ?? '').trim(),
      gender: String(row?.gender ?? '').trim(),
      birthDate: String(row?.birth_date ?? '').trim().slice(0, 10),
      phone,
    }
  } catch {
    return EMPTY_PROFILE
  }
}

async function loadAuthUserPhone(userId: string): Promise<string> {
  try {
    const row = await pgQueryOne<{ phone: string | null }>(
      `select nullif(trim(phone), '') as phone
       from auth.users
       where id = $1::uuid
       limit 1`,
      [userId]
    )
    return String(row?.phone ?? '').trim()
  } catch {
    return ''
  }
}
