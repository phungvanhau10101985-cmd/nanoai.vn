import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  planDailyAttendanceMail,
  summarizeWeddingAttendanceSources,
  weddingNotifyRecipients,
  weddingResponseHeadcount,
} from './wedding-attendance-summary'

describe('weddingResponseHeadcount', () => {
  it('counts adults and children when the party is filled', () => {
    assert.equal(
      weddingResponseHeadcount({ status: 'attending', guestCount: 1, adultCount: 2, childCount: 1 }),
      3,
    )
  })

  it('counts one person when a decline stored zero', () => {
    assert.equal(
      weddingResponseHeadcount({ status: 'declined', guestCount: 0, adultCount: 0, childCount: 0 }),
      1,
    )
  })

  it('does not count pending guests as people', () => {
    assert.equal(
      weddingResponseHeadcount({ status: 'pending', guestCount: 4, adultCount: 2, childCount: 1 }),
      0,
    )
  })
})

describe('summarizeWeddingAttendanceSources', () => {
  it('splits households and people, and skips RSVP rows already on the guest list', () => {
    const summary = summarizeWeddingAttendanceSources(
      [
        {
          guestHonorific: 'Anh',
          guestName: 'Minh',
          inviteVenue: 'groom_home',
          status: 'attending',
          guestCount: 2,
          adultCount: 2,
          childCount: 1,
        },
        {
          guestHonorific: '',
          guestName: 'Lan',
          inviteVenue: 'bride_home',
          status: 'declined',
          guestCount: 2,
          adultCount: 0,
          childCount: 0,
        },
        {
          guestHonorific: '',
          guestName: 'Hùng',
          inviteVenue: 'groom_home',
          status: 'pending',
          guestCount: 1,
          adultCount: 0,
          childCount: 0,
        },
      ],
      [
        { guestName: 'Anh Minh', attending: true, guestCount: 9, adultCount: 9, childCount: 0 },
        { guestName: 'Khách lạ', attending: false, guestCount: 0, adultCount: 0, childCount: 0 },
      ],
    )

    assert.equal(summary.groom.guestsAttending, 1)
    assert.equal(summary.groom.peopleAttending, 3)
    assert.equal(summary.groom.guestsPending, 1)
    assert.equal(summary.bride.peopleDeclined, 2)
    assert.equal(summary.outside.peopleDeclined, 1)
    assert.equal(summary.total.guestsAttending, 1)
    assert.equal(summary.total.peopleAttending, 3)
    assert.equal(summary.total.peopleDeclined, 3)
    assert.equal(summary.total.guestsPending, 1)
  })
})

describe('planDailyAttendanceMail', () => {
  it('sends one mail for the whole jump, not one mail per person', () => {
    const plan = planDailyAttendanceMail({
      enabled: true,
      baselineSet: true,
      lastPeople: 10,
      currentPeople: 14,
      hasRecipient: true,
      alreadySentToday: false,
    })
    assert.equal(plan.send, true)
    assert.equal(plan.nextBaseline, 14)
  })

  it('does not send a second mail the same day', () => {
    const plan = planDailyAttendanceMail({
      enabled: true,
      baselineSet: true,
      lastPeople: 10,
      currentPeople: 14,
      hasRecipient: true,
      alreadySentToday: true,
    })
    assert.equal(plan.send, false)
  })

  it('skips the day when the count did not rise', () => {
    const plan = planDailyAttendanceMail({
      enabled: true,
      baselineSet: true,
      lastPeople: 10,
      currentPeople: 10,
      hasRecipient: true,
      alreadySentToday: false,
    })
    assert.equal(plan.send, false)
    assert.equal(plan.lowerBaseline, false)
  })

  it('records the current count the first time and does not email the history', () => {
    const plan = planDailyAttendanceMail({
      enabled: true,
      baselineSet: false,
      lastPeople: 0,
      currentPeople: 12,
      hasRecipient: true,
      alreadySentToday: false,
    })
    assert.equal(plan.send, false)
    assert.equal(plan.setBaseline, true)
    assert.equal(plan.nextBaseline, 12)
  })

  it('lowers the baseline without email when people go down', () => {
    const plan = planDailyAttendanceMail({
      enabled: true,
      baselineSet: true,
      lastPeople: 15,
      currentPeople: 10,
      hasRecipient: true,
      alreadySentToday: false,
    })
    assert.equal(plan.send, false)
    assert.equal(plan.lowerBaseline, true)
  })
})

describe('weddingNotifyRecipients', () => {
  it('keeps one copy when both sides share an email', () => {
    assert.deepEqual(
      weddingNotifyRecipients(' A@Example.com ', 'a@example.com'),
      ['a@example.com'],
    )
  })
})
