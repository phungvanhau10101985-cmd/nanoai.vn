import { getPgPool } from '@/lib/db/pool'
import { parseWeddingDeviceShell, type WeddingDeviceShell } from '@/lib/wedding/wedding-section-config'
import { isWeddingSharedFrameKey, parseWeddingSharedFrame, type WeddingSharedFrame } from '@/lib/wedding/wedding-shared-frame'

function isMissingTable(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '42P01'
}

export async function loadWeddingShellLayout(layoutKey: string): Promise<WeddingDeviceShell | null> {
  const key = layoutKey.trim()
  if (!key) return null
  try {
    const res = await getPgPool().query<{ shell: unknown }>(
      `select shell from public.wedding_background_shell_layouts where layout_key = $1`,
      [key],
    )
    if (!res.rows[0]) return null
    return parseWeddingDeviceShell(res.rows[0].shell)
  } catch (error) {
    if (isMissingTable(error)) return null
    throw error
  }
}

export async function saveWeddingShellLayout(input: {
  layoutKey: string
  shell: WeddingDeviceShell
  userId: string
}): Promise<void> {
  await getPgPool().query(
    `insert into public.wedding_background_shell_layouts (layout_key, shell, updated_by, updated_at)
     values ($1, $2::jsonb, $3::uuid, timezone('utc'::text, now()))
     on conflict (layout_key) do update
       set shell = excluded.shell,
           updated_by = excluded.updated_by,
           updated_at = timezone('utc'::text, now())`,
    [input.layoutKey, JSON.stringify(input.shell), input.userId],
  )
}

export async function loadWeddingSharedFrame(layoutKey: string): Promise<WeddingSharedFrame | null> {
  const key = layoutKey.trim()
  if (!isWeddingSharedFrameKey(key)) return null
  try {
    const res = await getPgPool().query<{ shell: unknown }>(
      `select shell from public.wedding_background_shell_layouts where layout_key = $1`,
      [key],
    )
    if (!res.rows[0]) return null
    return parseWeddingSharedFrame(res.rows[0].shell)
  } catch (error) {
    if (isMissingTable(error)) return null
    throw error
  }
}

export async function listWeddingSharedFrames(): Promise<Record<string, WeddingSharedFrame>> {
  try {
    const res = await getPgPool().query<{ layout_key: string; shell: unknown }>(
      `select layout_key, shell from public.wedding_background_shell_layouts where layout_key like '%@frame'`,
    )
    const frames: Record<string, WeddingSharedFrame> = {}
    for (const row of res.rows) {
      if (!isWeddingSharedFrameKey(row.layout_key)) continue
      const parsed = parseWeddingSharedFrame(row.shell)
      if (!parsed) continue
      frames[row.layout_key.slice(0, -'@frame'.length)] = parsed
    }
    return frames
  } catch (error) {
    if (isMissingTable(error)) return {}
    throw error
  }
}

export async function saveWeddingSharedFrame(input: {
  layoutKey: string
  frame: WeddingSharedFrame
  userId: string
}): Promise<void> {
  await getPgPool().query(
    `insert into public.wedding_background_shell_layouts (layout_key, shell, updated_by, updated_at)
     values ($1, $2::jsonb, $3::uuid, timezone('utc'::text, now()))
     on conflict (layout_key) do update
       set shell = excluded.shell,
           updated_by = excluded.updated_by,
           updated_at = timezone('utc'::text, now())`,
    [input.layoutKey, JSON.stringify(input.frame), input.userId],
  )
}

export async function deleteWeddingSharedFrame(layoutKey: string): Promise<void> {
  if (!isWeddingSharedFrameKey(layoutKey)) return
  await getPgPool().query(`delete from public.wedding_background_shell_layouts where layout_key = $1`, [layoutKey])
}
