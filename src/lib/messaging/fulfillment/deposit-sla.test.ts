import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { depositReminderCopy, depositReminderHoursDue } from './deposit-sla'

describe('depositReminderHoursDue', () => {
  it('reminds at 2h then 20h and never invents China cancel', () => {
    const created = new Date('2026-09-01T00:00:00.000Z')
    assert.deepEqual(
      depositReminderHoursDue({ createdAt: created, now: new Date('2026-09-01T01:00:00.000Z') }),
      []
    )
    assert.deepEqual(
      depositReminderHoursDue({ createdAt: created, now: new Date('2026-09-01T03:00:00.000Z') }),
      [2]
    )
    assert.deepEqual(
      depositReminderHoursDue({
        createdAt: created,
        now: new Date('2026-09-01T21:00:00.000Z'),
        remindedAt2h: '2026-09-01T02:05:00.000Z',
      }),
      [20]
    )
  })

  it('uses shop name in reminder copy, not 188.com.vn', () => {
    const copy = depositReminderCopy({ shopName: 'My Shop', orderCode: 'DH01', hours: 2 })
    assert.match(copy.subject, /My Shop/)
    assert.equal(copy.subject.includes('188.com.vn'), false)
    assert.match(copy.text, /DH01/)
    assert.match(copy.text, /QR/)
  })

  it('includes fast-open URL when provided', () => {
    const copy = depositReminderCopy({
      shopName: 'My Shop',
      orderCode: 'DH01',
      hours: 20,
      openUrl: 'https://gudo.vn/orders/ord-1/deposit',
    })
    assert.match(copy.text, /https:\/\/gudo\.vn\/orders\/ord-1\/deposit/)
    assert.equal(copy.subjectRest, 'Nhắc đặt cọc đơn DH01')
  })
})
