import { getPgPool } from '@/lib/db/pool'
import type { WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import { parseWeddingOrnamentList } from '@/lib/wedding/wedding-background-ornament-store'

function isMissingTable(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '42P01'
}

export async function listWeddingOrnamentLayouts(): Promise<Record<string, WeddingBackgroundOrnament[]>> {
  try {
    const res = await getPgPool().query<{ layout_key: string; ornaments: unknown }>(
      `select layout_key, ornaments from public.wedding_background_ornament_layouts`,
    )
    const layouts: Record<string, WeddingBackgroundOrnament[]> = {}
    for (const row of res.rows) {
      const ornaments = parseWeddingOrnamentList(row.ornaments)
      if (ornaments && row.layout_key) layouts[row.layout_key] = ornaments
    }
    return layouts
  } catch (error) {
    if (isMissingTable(error)) return {}
    throw error
  }
}

export async function loadWeddingOrnamentLayout(layoutKey: string): Promise<WeddingBackgroundOrnament[] | null> {
  const key = layoutKey.trim()
  if (!key) return null
  try {
    const res = await getPgPool().query<{ ornaments: unknown }>(
      `select ornaments from public.wedding_background_ornament_layouts where layout_key = $1`,
      [key],
    )
    if (!res.rows[0]) return null
    return parseWeddingOrnamentList(res.rows[0].ornaments)
  } catch (error) {
    if (isMissingTable(error)) return null
    throw error
  }
}

export async function saveWeddingOrnamentLayout(input: {
  layoutKey: string
  ornaments: WeddingBackgroundOrnament[]
  userId: string
}): Promise<void> {
  await getPgPool().query(
    `insert into public.wedding_background_ornament_layouts (layout_key, ornaments, updated_by, updated_at)
     values ($1, $2::jsonb, $3::uuid, timezone('utc'::text, now()))
     on conflict (layout_key) do update
       set ornaments = excluded.ornaments,
           updated_by = excluded.updated_by,
           updated_at = timezone('utc'::text, now())`,
    [input.layoutKey, JSON.stringify(input.ornaments), input.userId],
  )
}

export async function deleteWeddingOrnamentLayout(layoutKey: string): Promise<void> {
  await getPgPool().query(`delete from public.wedding_background_ornament_layouts where layout_key = $1`, [layoutKey])
}
