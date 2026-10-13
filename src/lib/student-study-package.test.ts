import assert from 'node:assert/strict'
import test from 'node:test'
import {
  STUDENT_STUDY_INCLUDES,
  STUDENT_STUDY_PLANS,
  STUDENT_STUDY_TRIAL_DAYS,
  isStudentStudyTrialActive,
  nextStudentStudyAccessEnd,
  studentStudyPackageCopy,
  studentStudyPlanCredits,
  studentStudyTrialDaysRemaining,
} from '@/lib/student-study-package'

test('student package is homework help and tutor for every grade', () => {
  assert.deepEqual(
    STUDENT_STUDY_INCLUDES.map((item) => item.href),
    ['/ho-tro-lam-bai', '/gia-su-ai']
  )
  assert.equal(STUDENT_STUDY_TRIAL_DAYS, 6)
  assert.deepEqual(
    STUDENT_STUDY_PLANS.map((plan) => [plan.id, plan.days, plan.priceVnd, studentStudyPlanCredits(plan.priceVnd)]),
    [
      ['month', 30, 39_000, 6.5],
      ['quarter', 90, 99_000, 16.5],
      ['year', 365, 360_000, 60],
    ]
  )
})

test('student trial lasts 6 days from signup', () => {
  const created = '2026-10-01T00:00:00.000Z'
  const during = new Date('2026-10-06T00:00:00.000Z')
  const after = new Date('2026-10-07T00:00:00.000Z')
  assert.equal(isStudentStudyTrialActive(created, during), true)
  assert.equal(isStudentStudyTrialActive(created, after), false)
  assert.equal(studentStudyTrialDaysRemaining(created, during), 1)
})

test('buying during trial extends past the trial end', () => {
  const now = new Date('2026-10-03T12:00:00.000Z')
  const trialEndsAt = new Date('2026-10-08T00:00:00.000Z')
  const end = nextStudentStudyAccessEnd({ paidEndsAt: null, trialEndsAt, days: 30, now })
  assert.equal(end.toISOString(), '2026-11-07T00:00:00.000Z')
})

test('student package copy names every grade and the three prices exist as labels', () => {
  for (const locale of ['vi', 'en', 'zh', 'ja', 'ko'] as const) {
    const copy = studentStudyPackageCopy(locale)
    assert.ok(copy.title.length > 0)
    assert.ok(copy.planMonth.length > 0)
    assert.ok(copy.planQuarter.length > 0)
    assert.ok(copy.planYear.length > 0)
    assert.match(copy.audience.toLowerCase(), /cấp|grade|年级|学年|학년|level|学段|段階|과정|primary|tiểu|小学|小学/)
  }
})
