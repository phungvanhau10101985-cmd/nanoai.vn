import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type HouseBuildProjectRow = {
  id: string
  user_id: string
  name: string | null
  house_info: unknown
  steps: unknown
  current_step: string | null
  created_at: string
  updated_at: string
}

export async function insertHouseBuildProjectPg(params: {
  userId: string
  name?: string | null
  house_info?: unknown
  steps?: unknown
  current_step?: string | null
}): Promise<{ id: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.house_build_projects (
         user_id, name, house_info, steps, current_step, updated_at
       ) values (
         $1::uuid,
         coalesce($2::text, 'Dự án mới'),
         coalesce($3::jsonb, '{}'::jsonb),
         coalesce($4::jsonb, '{}'::jsonb),
         coalesce($5::text, 'floor_3d'),
         now()
       )
       returning id::text as id`,
      [
        params.userId,
        params.name ?? null,
        params.house_info != null ? JSON.stringify(params.house_info) : null,
        params.steps != null ? JSON.stringify(params.steps) : null,
        params.current_step ?? null,
      ]
    )
    return row?.id ? { id: row.id } : null
  } catch (e) {
    console.error('[house-build-projects-pg] insertHouseBuildProjectPg', e)
    return null
  }
}

export async function listHouseBuildProjectsByUserIdPg(userId: string): Promise<HouseBuildProjectRow[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<HouseBuildProjectRow>(
      `select id::text, user_id::text, name, house_info, steps, current_step,
              created_at::text, updated_at::text
       from public.house_build_projects
       where user_id = $1::uuid
       order by updated_at desc`,
      [userId]
    )
  } catch (e) {
    console.error('[house-build-projects-pg] listHouseBuildProjectsByUserIdPg', e)
    return []
  }
}

export async function getHouseBuildProjectForUserPg(
  projectId: string,
  userId: string
): Promise<HouseBuildProjectRow | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<HouseBuildProjectRow>(
      `select id::text, user_id::text, name, house_info, steps, current_step,
              created_at::text, updated_at::text
       from public.house_build_projects
       where id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [projectId, userId]
    )
  } catch (e) {
    console.error('[house-build-projects-pg] getHouseBuildProjectForUserPg', e)
    return null
  }
}

export async function updateHouseBuildProjectForUserPg(
  projectId: string,
  userId: string,
  patch: {
    name?: string | null
    house_info?: unknown
    steps?: unknown
    current_step?: string | null
  }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const sets: string[] = ['updated_at = now()']
    const vals: unknown[] = []
    let p = 1
    if (patch.name !== undefined) {
      sets.push(`name = $${p}`)
      vals.push(patch.name)
      p++
    }
    if (patch.house_info !== undefined) {
      sets.push(`house_info = $${p}::jsonb`)
      vals.push(JSON.stringify(patch.house_info))
      p++
    }
    if (patch.steps !== undefined) {
      sets.push(`steps = $${p}::jsonb`)
      vals.push(JSON.stringify(patch.steps))
      p++
    }
    if (patch.current_step !== undefined) {
      sets.push(`current_step = $${p}`)
      vals.push(patch.current_step)
      p++
    }
    vals.push(projectId, userId)
    const idParam = p
    const userParam = p + 1
    const q = `update public.house_build_projects set ${sets.join(', ')}
               where id = $${idParam}::uuid and user_id = $${userParam}::uuid`
    await pgQuery(q, vals)
    return true
  } catch (e) {
    console.error('[house-build-projects-pg] updateHouseBuildProjectForUserPg', e)
    return false
  }
}

export async function deleteHouseBuildProjectForUserPg(projectId: string, userId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(`delete from public.house_build_projects where id = $1::uuid and user_id = $2::uuid`, [
      projectId,
      userId,
    ])
    return true
  } catch (e) {
    console.error('[house-build-projects-pg] deleteHouseBuildProjectForUserPg', e)
    return false
  }
}
