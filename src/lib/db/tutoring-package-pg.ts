import { spendCreditsIdempotent } from '@/lib/db/credits-balance'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import {
  TUTORING_ENDING_SOON_DAYS,
  TUTORING_PACKAGE_CHARGE_TYPE,
  TUTORING_TRIAL_SLOTS,
  nextTutoringAccessEnd,
  tutoringAccessDaysLeft,
  tutoringGraceDaysLeft,
  tutoringPackagePhase,
  tutoringPackageQuote,
  tutoringTrialEndsAt,
  type TutoringPackagePhase,
} from '@/lib/lop/tutoring-package'

type PackageRow = { class_slots: number; access_ends_at: Date | string }

function isMissingRelation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /does not exist|relation/i.test(msg)
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function readTutoringPackage(userId: string): Promise<{ slots: number; accessEndsAt: Date } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<PackageRow>(
      `select class_slots, access_ends_at
       from public.teacher_tutoring_packages
       where user_id = $1::uuid
       limit 1`,
      [userId]
    )
    const accessEndsAt = asDate(row?.access_ends_at)
    const slots = Number(row?.class_slots)
    if (!row || !accessEndsAt || !Number.isInteger(slots)) return null
    return { slots, accessEndsAt }
  } catch (err) {
    if (isMissingRelation(err)) return null
    throw err
  }
}

export async function countOpenTutoringClasses(teacherId: string): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const row = await pgQueryOne<{ n: number }>(
      `select count(*)::int as n
       from public.classes
       where teacher_id = $1::uuid
         and class_kind = 'tutoring'
         and dissolved_at is null`,
      [teacherId]
    )
    return Number(row?.n) || 0
  } catch (err) {
    if (isMissingRelation(err)) return 0
    throw err
  }
}

export async function dissolveLapsedTutoringClasses(teacherId: string, now = new Date()): Promise<number> {
  const pack = await readTutoringPackage(teacherId)
  if (!pack || tutoringPackagePhase(pack.accessEndsAt, now) !== 'lapsed') return 0
  if (!isPgConfigured()) return 0
  try {
    const rows = await pgQuery<{ id: string }>(
      `update public.classes
       set dissolved_at = now()
       where teacher_id = $1::uuid
         and class_kind = 'tutoring'
         and dissolved_at is null
       returning id::text`,
      [teacherId]
    )
    return rows.length
  } catch (err) {
    if (isMissingRelation(err)) return 0
    throw err
  }
}

export async function tutoringTeacherGrace(teacherId: string, now = new Date()): Promise<{
  phase: TutoringPackagePhase
  daysLeft: number | null
  slots: number
}> {
  const existing = await readTutoringPackage(teacherId)
  if (!existing && (await countOpenTutoringClasses(teacherId)) > 0) {
    await beginTutoringTrial(teacherId, now)
  }
  await dissolveLapsedTutoringClasses(teacherId, now)
  const pack = await readTutoringPackage(teacherId)
  const phase = tutoringPackagePhase(pack?.accessEndsAt ?? null, now)
  return {
    phase,
    daysLeft: pack && phase === 'grace' ? tutoringGraceDaysLeft(pack.accessEndsAt, now) : null,
    slots: pack?.slots ?? 0,
  }
}

export async function tutoringCreateGate(
  teacherId: string,
  now = new Date()
): Promise<'ok' | 'trial' | 'grace' | 'slots' | 'buy'> {
  const grace = await tutoringTeacherGrace(teacherId, now)
  if (grace.phase === 'grace') return 'grace'
  const count = await countOpenTutoringClasses(teacherId)
  if (grace.phase === 'active') return count < grace.slots ? 'ok' : 'slots'
  if (grace.phase === 'none' && count === 0) return 'trial'
  return 'buy'
}

export async function beginTutoringTrial(teacherId: string, now = new Date()): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `insert into public.teacher_tutoring_packages (user_id, class_slots, access_ends_at)
     values ($1::uuid, $2, $3::timestamptz)
     on conflict (user_id) do nothing`,
    [teacherId, TUTORING_TRIAL_SLOTS, tutoringTrialEndsAt(now).toISOString()]
  )
}

/** Giải tán lớp học thêm đã quá 30 ngày của chính người xem và của các lớp người xem đang học. */
export async function dissolveLapsedTutoringClassesVisibleTo(userId: string, now = new Date()): Promise<void> {
  await dissolveLapsedTutoringClasses(userId, now)
  if (!isPgConfigured()) return
  let teacherIds: { teacher_id: string }[] = []
  try {
    teacherIds = await pgQuery(
      `select distinct c.teacher_id::text as teacher_id
       from public.classes c
       join public.class_members m on m.class_id = c.id and m.user_id = $1::uuid
       where c.class_kind = 'tutoring'
         and c.dissolved_at is null
         and c.teacher_id <> $1::uuid`,
      [userId]
    )
  } catch (err) {
    if (isMissingRelation(err)) return
    throw err
  }
  for (const row of teacherIds) {
    await dissolveLapsedTutoringClasses(row.teacher_id, now)
  }
}

export async function listTutoringGraceClassIds(viewerId: string, now = new Date()): Promise<{
  classIds: string[]
  daysLeft: number | null
  endingDaysLeft: number | null
}> {
  await dissolveLapsedTutoringClassesVisibleTo(viewerId, now)
  const own = await tutoringTeacherGrace(viewerId, now)
  if (!isPgConfigured()) return { classIds: [], daysLeft: own.daysLeft, endingDaysLeft: null }
  let rows: { id: string; access_ends_at: Date | string }[] = []
  try {
    rows = await pgQuery(
      `select c.id::text, p.access_ends_at
       from public.classes c
       join public.teacher_tutoring_packages p on p.user_id = c.teacher_id
       where c.class_kind = 'tutoring'
         and c.dissolved_at is null
         and (
           c.teacher_id = $1::uuid
           or exists (
             select 1 from public.class_subjects cs
             where cs.class_id = c.id and cs.teacher_id = $1::uuid
           )
         )`,
      [viewerId]
    )
  } catch (err) {
    if (isMissingRelation(err)) return { classIds: [], daysLeft: own.daysLeft, endingDaysLeft: null }
    throw err
  }
  const classIds: string[] = []
  let soonest: number | null = own.daysLeft
  let endingDaysLeft: number | null = null
  for (const row of rows) {
    const ends = asDate(row.access_ends_at)
    if (!ends) continue
    const phase = tutoringPackagePhase(ends, now)
    if (phase === 'grace') {
      classIds.push(row.id)
      const days = tutoringGraceDaysLeft(ends, now)
      if (soonest == null || days < soonest) soonest = days
      continue
    }
    if (phase !== 'active') continue
    const daysLeft = tutoringAccessDaysLeft(ends, now)
    if (daysLeft > TUTORING_ENDING_SOON_DAYS) continue
    if (endingDaysLeft == null || daysLeft < endingDaysLeft) endingDaysLeft = daysLeft
  }
  return { classIds, daysLeft: soonest, endingDaysLeft }
}

export async function tutoringClassFeatureBlock(
  classId: string,
  now = new Date()
): Promise<'missing' | 'open' | 'grace' | 'dissolved'> {
  if (!isPgConfigured()) return 'missing'
  try {
    const row = await pgQueryOne<{
      class_kind: string
      teacher_id: string
      dissolved_at: Date | string | null
    }>(
      `select coalesce(class_kind, 'school') as class_kind, teacher_id::text, dissolved_at
       from public.classes
       where id = $1::uuid
       limit 1`,
      [classId]
    )
    if (!row) return 'missing'
    if (row.dissolved_at) return 'dissolved'
    if (row.class_kind !== 'tutoring') return 'open'
    const grace = await tutoringTeacherGrace(row.teacher_id, now)
    if (grace.phase === 'grace') return 'grace'
    if (grace.phase === 'lapsed') return 'dissolved'
    return 'open'
  } catch (err) {
    if (isMissingRelation(err)) return 'open'
    throw err
  }
}

export async function readTutoringJoinBlock(
  classId: string,
  now = new Date()
): Promise<'open' | 'closed' | 'dissolved' | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      class_kind: string
      teacher_id: string
      dissolved_at: Date | string | null
    }>(
      `select coalesce(class_kind, 'school') as class_kind, teacher_id::text, dissolved_at
       from public.classes
       where id = $1::uuid
       limit 1`,
      [classId]
    )
    if (!row) return null
    if (row.dissolved_at) return 'dissolved'
    if (row.class_kind !== 'tutoring') return 'open'
    const grace = await tutoringTeacherGrace(row.teacher_id, now)
    if (grace.phase === 'grace' || grace.phase === 'lapsed') return 'closed'
    return 'open'
  } catch (err) {
    if (isMissingRelation(err)) return 'open'
    throw err
  }
}

export async function purchaseTutoringPackage(input: {
  userId: string
  planId: string
  slots: number
  now?: Date
}): Promise<
  | { ok: true; accessEndsAt: string; credits: number; priceVnd: number; slots: number; newBalance: number }
  | { ok: false; error: string; credits: number; priceVnd: number }
> {
  const quote = tutoringPackageQuote(input.planId, input.slots)
  if (!quote) return { ok: false, error: 'bad_plan', credits: 0, priceVnd: 0 }
  const now = input.now ?? new Date()
  await dissolveLapsedTutoringClasses(input.userId, now)
  const count = await countOpenTutoringClasses(input.userId)
  if (input.slots < count) {
    return { ok: false, error: 'slots_below_classes', credits: quote.credits, priceVnd: quote.priceVnd }
  }
  const current = await readTutoringPackage(input.userId)
  const accessEndsAt = nextTutoringAccessEnd(
    current && tutoringPackagePhase(current.accessEndsAt, now) === 'active' ? current.accessEndsAt : null,
    quote.days,
    now
  )
  const eventKey = `tutoring_package:${input.userId}:${input.planId}:${input.slots}:${accessEndsAt.toISOString()}`
  const charged = await spendCreditsIdempotent({
    userId: input.userId,
    amount: quote.credits,
    eventKey,
    chargeType: TUTORING_PACKAGE_CHARGE_TYPE,
    sessionId: null,
    metadataJson: JSON.stringify({
      kind: 'tutoring_class_package',
      plan: input.planId,
      slots: input.slots,
      days: quote.days,
      priceVnd: quote.priceVnd,
      credits: quote.credits,
      accessEndsAt: accessEndsAt.toISOString(),
    }),
  })
  if (!charged.ok) {
    return { ok: false, error: charged.error || 'charge_failed', credits: quote.credits, priceVnd: quote.priceVnd }
  }
  await pgQuery(
    `insert into public.teacher_tutoring_packages (user_id, class_slots, access_ends_at, updated_at)
     values ($1::uuid, $2, $3::timestamptz, now())
     on conflict (user_id) do update
     set class_slots = excluded.class_slots,
         access_ends_at = excluded.access_ends_at,
         updated_at = now()`,
    [input.userId, input.slots, accessEndsAt.toISOString()]
  )
  return {
    ok: true,
    accessEndsAt: accessEndsAt.toISOString(),
    credits: quote.credits,
    priceVnd: quote.priceVnd,
    slots: input.slots,
    newBalance: charged.newBalance,
  }
}
