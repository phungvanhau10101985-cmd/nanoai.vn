import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseWeddingEventTimeline,
  serializeWeddingEventTimeline,
  weddingTimelineItemContent,
} from './wedding-event-timeline'

test('timeline edit keeps a space while the next word is being typed', () => {
  const draft = serializeWeddingEventTimeline([{ time: '16:30', title: 'Đón ', note: '' }])
  const [row] = parseWeddingEventTimeline(draft)
  assert.equal(weddingTimelineItemContent(row), 'Đón ')
  assert.equal(row.time, '16:30')
})

test('timeline edit keeps spaces between words', () => {
  const draft = serializeWeddingEventTimeline([{ time: '18:00', title: 'Đón khách', note: '' }])
  const [row] = parseWeddingEventTimeline(draft)
  assert.equal(weddingTimelineItemContent(row), 'Đón khách')
  assert.equal(serializeWeddingEventTimeline([row]), '18:00 | Đón khách')
})

test('timeline note separator still round-trips', () => {
  const source = '16:30 | Đón khách - Chụp ảnh'
  const [row] = parseWeddingEventTimeline(source)
  assert.equal(row.title, 'Đón khách')
  assert.equal(row.note, 'Chụp ảnh')
  assert.equal(weddingTimelineItemContent(row), source.slice(source.indexOf('|') + 2))
  assert.equal(serializeWeddingEventTimeline([row]), source)
})
