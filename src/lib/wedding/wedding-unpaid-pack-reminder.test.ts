import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WEDDING_UNPAID_PACK_REMINDER_DAYS,
  buildWeddingUnpaidPackReminderMail,
  selectUnpaidPackReminder,
  weddingUnpaidPackEditPath,
} from './wedding-unpaid-pack-reminder'

test('nhắc đúng 15 ngày trước ngày cưới đã điền', () => {
  const pick = selectUnpaidPackReminder({
    todayIso: '2026-10-01',
    createdOnIso: '2026-09-01',
    dates: ['2026-10-16', null, null],
  })
  assert.equal(WEDDING_UNPAID_PACK_REMINDER_DAYS, 15)
  assert.deepEqual(pick, { dateIso: '2026-10-16', daysBefore: 15 })
})

test('ngày còn xa hơn 15 ngày thì chưa gửi', () => {
  assert.equal(
    selectUnpaidPackReminder({
      todayIso: '2026-10-01',
      createdOnIso: '2026-09-01',
      dates: ['2026-10-17'],
    }),
    null,
  )
})

test('cron lỡ đúng ngày thì gửi bù nếu thiệp đã có từ mốc 15 ngày', () => {
  assert.deepEqual(
    selectUnpaidPackReminder({
      todayIso: '2026-10-03',
      createdOnIso: '2026-09-01',
      dates: ['2026-10-16'],
    }),
    { dateIso: '2026-10-16', daysBefore: 13 },
  )
  assert.equal(
    selectUnpaidPackReminder({
      todayIso: '2026-10-03',
      createdOnIso: '2026-10-02',
      dates: ['2026-10-16'],
    }),
    null,
  )
})

test('đã nhắc rồi hoặc ngày đã qua thì không chọn lại', () => {
  assert.equal(
    selectUnpaidPackReminder({
      todayIso: '2026-10-01',
      createdOnIso: '2026-09-01',
      dates: ['2026-10-16'],
      alreadySent: true,
    }),
    null,
  )
  assert.equal(
    selectUnpaidPackReminder({
      todayIso: '2026-10-20',
      createdOnIso: '2026-09-01',
      dates: ['2026-10-16'],
    }),
    null,
  )
})

test('hai ngày thì nhắc ngày sớm hơn đang tới hạn', () => {
  assert.deepEqual(
    selectUnpaidPackReminder({
      todayIso: '2026-10-01',
      createdOnIso: '2026-09-01',
      dates: ['2026-11-01', '2026-10-16', '2026-10-16'],
    }),
    { dateIso: '2026-10-16', daysBefore: 15 },
  )
})

test('thư có link sửa thiệp và nói chưa mua gói', () => {
  const editUrl = 'https://nanoai.vn/tao-thiep-moi-cuoi-ai?cardId=card-1'
  const mail = buildWeddingUnpaidPackReminderMail({
    locale: 'vi',
    groomName: 'Minh',
    brideName: 'Lan & <Hoa>',
    dateIso: '2026-10-16',
    daysBefore: 15,
    editUrl,
  })
  assert.match(mail.subject, /Còn 15 ngày đến ngày cưới Minh & Lan & <Hoa>/)
  assert.match(mail.body, /chưa mua gói khách mời/)
  assert.match(mail.body, /3 khách đầu/)
  assert.match(mail.text, new RegExp(editUrl.replace(/[?]/g, '\\?')))
  assert.match(mail.html, /Sửa thiệp/)
  assert.match(mail.html, /href="https:\/\/nanoai\.vn\/tao-thiep-moi-cuoi-ai\?cardId=card-1"/)
  assert.match(mail.html, /Lan &amp; &lt;Hoa&gt;/)
  assert.equal(weddingUnpaidPackEditPath('card 1'), '/tao-thiep-moi-cuoi-ai?cardId=card%201')
})

test('bản tiếng Anh, Trung, Nhật, Hàn đều có nút sửa thiệp', () => {
  for (const locale of ['en', 'zh', 'ja', 'ko'] as const) {
    const mail = buildWeddingUnpaidPackReminderMail({
      locale,
      groomName: 'Minh',
      brideName: 'Lan',
      dateIso: '2026-10-16',
      daysBefore: 15,
      editUrl: 'https://nanoai.vn/tao-thiep-moi-cuoi-ai?cardId=card-1',
    })
    assert.match(mail.html, /card-1/)
    assert.ok(mail.subject.length > 0)
    assert.ok(mail.body.length > 0)
  }
})
