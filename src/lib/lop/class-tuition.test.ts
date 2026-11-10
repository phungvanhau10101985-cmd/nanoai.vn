import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildClassTuitionView,
  buildTransferContent,
  buildTuitionQrImageUrl,
  daysInMonth,
  firstTuitionShare,
  formatPeriodLabel,
  listPeriodsInclusive,
  parseBillingDay,
  parseTuitionAmount,
  periodAllowedForStudent,
  tuitionPeriodsForStudent,
} from './class-tuition'

const monthlyVnd = 300_000

test('first fee is the remaining days of the join month, due on a calendar date', () => {
  assert.equal(daysInMonth(2026, 11), 30)
  assert.deepEqual(firstTuitionShare(monthlyVnd, 15, 30), { billableDays: 15, amount: 150_000 })
  assert.deepEqual(firstTuitionShare(monthlyVnd, 30, 30), { billableDays: 0, amount: 0 })

  const joinedAt = new Date('2026-11-15T16:00:00.000Z')
  const beforeDue = tuitionPeriodsForStudent({
    joinedAt,
    dueAfterDays: 2,
    billingDay: 4,
    monthlyVnd,
    now: new Date('2026-11-16T16:30:00.000Z'),
    confirmedAtByPeriod: new Map(),
  })
  assert.equal(beforeDue.locked, false)
  assert.equal(beforeDue.periods[0]?.status, 'not_due')
  assert.equal(beforeDue.periods[0]?.amount, 150_000)
  assert.equal(beforeDue.periods[0]?.kind, 'partial')
  assert.deepEqual(beforeDue.periods[0]?.dueOn, { y: 2026, m: 11, d: 17 })

  const dueMorning = tuitionPeriodsForStudent({
    joinedAt,
    dueAfterDays: 2,
    billingDay: 4,
    monthlyVnd,
    now: new Date('2026-11-16T17:00:00.000Z'),
    confirmedAtByPeriod: new Map(),
  })
  assert.equal(dueMorning.locked, true)
  assert.equal(dueMorning.periods.length, 1)
  assert.equal(dueMorning.periods[0]?.status, 'unpaid')
  assert.equal(dueMorning.periods[0]?.period, '2026-11')
})

test('later months charge the full fee on the configured day and a short month clamps the day', () => {
  const joinedAt = new Date('2026-11-15T02:00:00.000Z')
  const beforeBillingDay = tuitionPeriodsForStudent({
    joinedAt,
    dueAfterDays: 2,
    billingDay: 4,
    monthlyVnd,
    now: new Date('2026-12-03T02:00:00.000Z'),
    confirmedAtByPeriod: new Map([['2026-11', '2026-11-17T02:00:00.000Z']]),
  })
  assert.equal(beforeBillingDay.locked, false)
  assert.deepEqual(
    beforeBillingDay.periods.map((row) => [row.period, row.kind, row.amount, row.status, row.dueOn.d]),
    [
      ['2026-11', 'partial', 150_000, 'confirmed', 17],
      ['2026-12', 'full', monthlyVnd, 'not_due', 4],
    ]
  )

  const onBillingDay = tuitionPeriodsForStudent({
    joinedAt,
    dueAfterDays: 2,
    billingDay: 4,
    monthlyVnd,
    now: new Date('2026-12-03T17:00:00.000Z'),
    confirmedAtByPeriod: new Map([['2026-11', '2026-11-17T02:00:00.000Z']]),
  })
  assert.equal(onBillingDay.locked, true)
  assert.equal(onBillingDay.periods[1]?.status, 'unpaid')
  assert.equal(onBillingDay.periods[1]?.amount, monthlyVnd)

  const february = tuitionPeriodsForStudent({
    joinedAt: new Date('2027-01-10T02:00:00.000Z'),
    dueAfterDays: 0,
    billingDay: 31,
    monthlyVnd,
    now: new Date('2027-02-28T02:00:00.000Z'),
    confirmedAtByPeriod: new Map([['2027-01', '2027-01-10T02:00:00.000Z']]),
  })
  assert.equal(daysInMonth(2027, 2), 28)
  assert.equal(february.periods[1]?.dueOn.d, 28)
  assert.equal(february.periods[1]?.status, 'unpaid')
})

test('the QR uses the oldest open period, and a later month cannot be confirmed early', () => {
  const joinedAt = new Date('2026-11-15T02:00:00.000Z')
  const now = new Date('2026-12-03T17:00:00.000Z')
  const view = buildClassTuitionView({
    monthlyVnd,
    dueAfterDays: 2,
    billingDay: 4,
    bankBin: '970422',
    bankName: 'MB',
    accountNo: '0123456789',
    accountName: 'NGUYEN THI DUYEN',
    className: 'Toán 10',
    isOwner: false,
    now,
    members: [{ userId: 'student-1', name: 'An', joinedAt }],
    confirmedAtByUser: new Map(),
  })
  const student = view.students[0]
  assert.ok(student)
  assert.equal(student?.locked, true)
  assert.equal(student?.payKind, 'partial')
  assert.equal(student?.payAmountLabel?.includes('150'), true)
  assert.equal(student?.unpaidCount, 2)
  const url = new URL(student?.qrImageUrl ?? '')
  assert.equal(url.searchParams.get('amount'), '150000')
  assert.equal(url.searchParams.get('addInfo'), 'Toán 10 An')

  assert.equal(
    periodAllowedForStudent({
      period: '2026-11',
      joinedAt,
      dueAfterDays: 2,
      billingDay: 4,
      monthlyVnd,
      now: new Date('2026-11-16T02:00:00.000Z'),
    }),
    true
  )
  assert.equal(
    periodAllowedForStudent({
      period: '2026-12',
      joinedAt,
      dueAfterDays: 2,
      billingDay: 4,
      monthlyVnd,
      now: new Date('2026-11-16T02:00:00.000Z'),
    }),
    false
  )
  assert.equal(parseBillingDay('4'), 4)
  assert.equal(parseBillingDay('32'), null)
  assert.equal(formatPeriodLabel('2026-11'), '11/2026')
  assert.deepEqual(listPeriodsInclusive('2026-11', '2027-01'), ['2026-11', '2026-12', '2027-01'])
})

test('transfer content is class name plus student name, and the QR carries amount', () => {
  assert.equal(buildTransferContent('  Toán 10  ', '  An  '), 'Toán 10 An')
  const longContent = buildTransferContent('Lớp rất dài', 'Tên học sinh cũng rất dài vượt quá giới hạn')
  assert.equal(longContent.length <= 50, true)
  assert.equal(longContent.startsWith('Lớp rất dài'), true)
  const url = buildTuitionQrImageUrl({
    bankBin: '970422',
    accountNo: '0123456789',
    accountName: 'NGUYEN THI DUYEN',
    amount: 500000,
    transferContent: 'Toán 10 An',
  })
  assert.ok(url)
  const parsed = new URL(url!)
  assert.equal(parsed.pathname, '/image/970422-0123456789-compact2.png')
  assert.equal(parsed.searchParams.get('amount'), '500000')
  assert.equal(parsed.searchParams.get('addInfo'), 'Toán 10 An')
  assert.equal(parsed.searchParams.get('accountName'), 'NGUYEN THI DUYEN')
  assert.equal(parseTuitionAmount('500.000'), 500000)
  assert.equal(parseTuitionAmount('999'), null)
})
