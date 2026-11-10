import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import {
  buildClassTuitionView,
  periodAllowedForStudent,
  periodToDate,
  tuitionPeriodsForStudent,
  type ClassTuitionView,
  type TutoringTuitionInput,
} from '@/lib/lop/class-tuition'

type TutoringClassRow = {
  name: string
  teacher_id: string
  class_kind: string
  tuition_monthly_vnd: number | null
  tuition_due_after_days: number | null
  tuition_billing_day: number | null
  tuition_bank_bin: string | null
  tuition_bank_name: string | null
  tuition_account_no: string | null
  tuition_account_name: string | null
}

async function fetchTutoringClassRow(classId: string): Promise<TutoringClassRow | null> {
  return pgQueryOne<TutoringClassRow>(
    `select c.name, c.teacher_id::text, c.class_kind,
            c.tuition_monthly_vnd, c.tuition_due_after_days, c.tuition_billing_day,
            c.tuition_bank_bin, c.tuition_bank_name, c.tuition_account_no, c.tuition_account_name
     from public.classes c
     where c.id = $1::uuid
     limit 1`,
    [classId]
  )
}

export async function loadClassTuitionViewPg(input: {
  classId: string
  viewerUserId: string
  isOwner: boolean
  now?: Date
}): Promise<ClassTuitionView | null> {
  if (!isPgConfigured()) return null
  try {
    const cls = await fetchTutoringClassRow(input.classId)
    if (!cls || cls.class_kind !== 'tutoring') return null
    const monthlyVnd = Number(cls.tuition_monthly_vnd)
    const dueAfterDays = Number(cls.tuition_due_after_days)
    const billingDay = Number(cls.tuition_billing_day)
    const bankBin = String(cls.tuition_bank_bin ?? '').trim()
    const bankName = String(cls.tuition_bank_name ?? '').trim()
    const accountNo = String(cls.tuition_account_no ?? '').trim()
    const accountName = String(cls.tuition_account_name ?? '').trim()
    if (
      !Number.isInteger(monthlyVnd) ||
      !Number.isInteger(dueAfterDays) ||
      !Number.isInteger(billingDay) ||
      billingDay < 1 ||
      billingDay > 31 ||
      !bankBin ||
      !accountNo
    ) {
      return null
    }

    const memberRows = await pgQuery<{
      user_id: string
      member_display_name: string | null
      joined_at: Date | string
    }>(
      `select user_id::text, member_display_name, joined_at
       from public.class_members
       where class_id = $1::uuid
         and user_id <> $2::uuid`,
      [input.classId, cls.teacher_id]
    )
    const visible = input.isOwner
      ? memberRows
      : memberRows.filter((row) => row.user_id === input.viewerUserId)
    if (!input.isOwner && visible.length === 0) return null

    const paymentRows = await pgQuery<{
      user_id: string
      period: string
      confirmed_at: Date | string
    }>(
      `select user_id::text, to_char(period_month, 'YYYY-MM') as period, confirmed_at
       from public.class_tuition_payments
       where class_id = $1::uuid`,
      [input.classId]
    )
    const confirmedAtByUser = new Map<string, Map<string, string>>()
    for (const row of paymentRows) {
      const byPeriod = confirmedAtByUser.get(row.user_id) ?? new Map<string, string>()
      const confirmedAt = row.confirmed_at instanceof Date ? row.confirmed_at.toISOString() : String(row.confirmed_at)
      byPeriod.set(row.period, confirmedAt)
      confirmedAtByUser.set(row.user_id, byPeriod)
    }

    return buildClassTuitionView({
      monthlyVnd,
      dueAfterDays,
      billingDay,
      bankBin,
      bankName,
      accountNo,
      accountName,
      className: String(cls.name ?? '').trim() || 'Lớp',
      isOwner: input.isOwner,
      now: input.now ?? new Date(),
      members: visible.map((row) => ({
        userId: row.user_id,
        name: String(row.member_display_name ?? '').replace(/\s+/g, ' ').trim() || 'Học sinh',
        joinedAt: row.joined_at instanceof Date ? row.joined_at : new Date(row.joined_at),
      })),
      confirmedAtByUser,
    })
  } catch (e) {
    console.error('[class-tuition-pg] loadClassTuitionViewPg', e)
    return null
  }
}

/** Số học sinh đang bị khóa vì còn kỳ đến hạn chưa được cô xác nhận. */
export async function countLockedTuitionStudentsByClassPg(
  classIds: string[],
  now = new Date()
): Promise<Record<string, number>> {
  const ids = [...new Set(classIds.map((id) => id.trim()).filter(Boolean))]
  const counts: Record<string, number> = {}
  if (!isPgConfigured() || ids.length === 0) return counts
  try {
    const rows = await pgQuery<{
      class_id: string
      monthly_vnd: number | null
      due_after_days: number | null
      billing_day: number | null
      user_id: string
      joined_at: Date | string
      period: string | null
    }>(
      `select c.id::text as class_id,
              c.tuition_monthly_vnd as monthly_vnd,
              c.tuition_due_after_days as due_after_days,
              c.tuition_billing_day as billing_day,
              m.user_id::text as user_id,
              m.joined_at,
              to_char(p.period_month, 'YYYY-MM') as period
       from public.classes c
       join public.class_members m
         on m.class_id = c.id
        and m.user_id <> c.teacher_id
       left join public.class_tuition_payments p
         on p.class_id = c.id
        and p.user_id = m.user_id
       where c.id = any($1::uuid[])
         and c.class_kind = 'tutoring'
         and c.dissolved_at is null`,
      [ids]
    )
    const byStudent = new Map<
      string,
      {
        classId: string
        monthly: number
        days: number
        billing: number
        joinedAt: Date
        periods: Map<string, string>
      }
    >()
    for (const row of rows) {
      const key = `${row.class_id}:${row.user_id}`
      let student = byStudent.get(key)
      if (!student) {
        const joinedAt = row.joined_at instanceof Date ? row.joined_at : new Date(row.joined_at)
        student = {
          classId: row.class_id,
          monthly: Number(row.monthly_vnd),
          days: Number(row.due_after_days),
          billing: Number(row.billing_day),
          joinedAt,
          periods: new Map(),
        }
        byStudent.set(key, student)
      }
      if (row.period) student.periods.set(row.period, now.toISOString())
    }
    for (const student of byStudent.values()) {
      if (
        !Number.isInteger(student.monthly) ||
        !Number.isInteger(student.days) ||
        !Number.isInteger(student.billing) ||
        Number.isNaN(student.joinedAt.getTime())
      ) {
        continue
      }
      const schedule = tuitionPeriodsForStudent({
        joinedAt: student.joinedAt,
        dueAfterDays: student.days,
        billingDay: student.billing,
        monthlyVnd: student.monthly,
        now,
        confirmedAtByPeriod: student.periods,
      })
      if (!schedule.locked) continue
      counts[student.classId] = (counts[student.classId] ?? 0) + 1
    }
    return counts
  } catch (e) {
    console.error('[class-tuition-pg] countLockedTuitionStudentsByClassPg', e)
    return counts
  }
}

export async function updateTutoringTuitionSettingsPg(input: {
  classId: string
  teacherId: string
  tuition: TutoringTuitionInput
}): Promise<'ok' | 'not_owner' | 'not_tutoring' | null> {
  if (!isPgConfigured()) return null
  try {
    const cls = await fetchTutoringClassRow(input.classId)
    if (!cls) return 'not_tutoring'
    if (cls.teacher_id !== input.teacherId) return 'not_owner'
    if (cls.class_kind !== 'tutoring') return 'not_tutoring'
    const row = await pgQueryOne<{ id: string }>(
      `update public.classes
       set tuition_monthly_vnd = $3,
           tuition_due_after_days = $4,
           tuition_billing_day = $5,
           tuition_bank_bin = $6,
           tuition_bank_name = $7,
           tuition_account_no = $8,
           tuition_account_name = $9
       where id = $1::uuid
         and teacher_id = $2::uuid
         and class_kind = 'tutoring'
       returning id::text`,
      [
        input.classId,
        input.teacherId,
        input.tuition.monthlyVnd,
        input.tuition.dueAfterDays,
        input.tuition.billingDay,
        input.tuition.bankBin,
        input.tuition.bankName,
        input.tuition.accountNo,
        input.tuition.accountName,
      ]
    )
    return row ? 'ok' : null
  } catch (e) {
    console.error('[class-tuition-pg] updateTutoringTuitionSettingsPg', e)
    return null
  }
}

export async function setClassTuitionPaymentPg(input: {
  classId: string
  teacherId: string
  memberUserId: string
  period: string
  confirmed: boolean
  now?: Date
}): Promise<'ok' | 'not_owner' | 'not_member' | 'bad_period' | 'not_tutoring' | null> {
  if (!isPgConfigured()) return null
  const periodDate = periodToDate(input.period)
  if (!periodDate) return 'bad_period'
  try {
    const cls = await fetchTutoringClassRow(input.classId)
    if (!cls) return 'not_tutoring'
    if (cls.teacher_id !== input.teacherId) return 'not_owner'
    if (cls.class_kind !== 'tutoring') return 'not_tutoring'
    const dueAfterDays = Number(cls.tuition_due_after_days)
    const billingDay = Number(cls.tuition_billing_day)
    const monthlyVnd = Number(cls.tuition_monthly_vnd)
    if (!Number.isInteger(dueAfterDays) || !Number.isInteger(billingDay) || !Number.isInteger(monthlyVnd)) {
      return 'not_tutoring'
    }

    const member = await pgQueryOne<{ joined_at: Date | string }>(
      `select m.joined_at
       from public.class_members m
       join public.classes c on c.id = m.class_id
       where m.class_id = $1::uuid
         and m.user_id = $2::uuid
         and m.user_id <> c.teacher_id
       limit 1`,
      [input.classId, input.memberUserId]
    )
    if (!member) return 'not_member'
    const joinedAt = member.joined_at instanceof Date ? member.joined_at : new Date(member.joined_at)
    if (
      !periodAllowedForStudent({
        period: input.period,
        joinedAt,
        dueAfterDays,
        billingDay,
        monthlyVnd,
        now: input.now ?? new Date(),
      })
    ) {
      return 'bad_period'
    }

    if (!input.confirmed) {
      await pgQuery(
        `delete from public.class_tuition_payments
         where class_id = $1::uuid
           and user_id = $2::uuid
           and period_month = $3::date`,
        [input.classId, input.memberUserId, periodDate]
      )
      return 'ok'
    }

    await pgQuery(
      `insert into public.class_tuition_payments (class_id, user_id, period_month, confirmed_by)
       values ($1::uuid, $2::uuid, $3::date, $4::uuid)
       on conflict (class_id, user_id, period_month) do nothing`,
      [input.classId, input.memberUserId, periodDate, input.teacherId]
    )
    return 'ok'
  } catch (e) {
    console.error('[class-tuition-pg] setClassTuitionPaymentPg', e)
    return null
  }
}
