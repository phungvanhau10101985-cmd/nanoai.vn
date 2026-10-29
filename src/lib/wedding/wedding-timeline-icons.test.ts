import assert from 'node:assert/strict'
import test from 'node:test'
import { weddingTimelineIconKind, weddingTimelineIconSrc } from './wedding-timeline-icons'

test('timeline icons follow each schedule topic, and the title wins over the note', () => {
  assert.equal(weddingTimelineIconKind('Đón khách - Chụp ảnh lưu niệm cùng cô dâu chú rể'), 'welcome')
  assert.equal(weddingTimelineIconKind('Làm lễ - Nghi thức thành hôn và lời chúc phúc từ hai bên gia đình'), 'ceremony')
  assert.equal(weddingTimelineIconKind('Phùng Hậu và Diệu Lan cùng quan khách'), 'guests')
  assert.equal(weddingTimelineIconKind('Giao lưu - Âm nhạc, chụp ảnh và lưu giữ khoảnh khắc đáng nhớ'), 'music')
  assert.equal(weddingTimelineIconKind('Chụp ảnh lưu niệm'), 'photo')
  assert.equal(weddingTimelineIconKind('Khai tiệc'), 'banquet')
  assert.equal(weddingTimelineIconKind('Cắt bánh kem'), 'cake')
  assert.equal(weddingTimelineIconKind('Welcome guests'), 'welcome')
  assert.equal(weddingTimelineIconKind(''), 'welcome')
  assert.equal(weddingTimelineIconSrc('ceremony'), '/wedding/timeline-icons/timeline-ceremony.png')
  assert.equal(weddingTimelineIconSrc('music'), '/wedding/timeline-icons/timeline-music.png')
})
