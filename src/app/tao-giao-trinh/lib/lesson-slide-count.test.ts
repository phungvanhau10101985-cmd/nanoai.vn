import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  LESSON_SLIDES_PER_LESSON,
  buildLessonSlidesFromPieces,
  fitLessonSlidesToExactCount,
  type LessonSlideDraft,
} from './lesson-slide-count'

function compact(slides: LessonSlideDraft[]): string {
  return slides
    .flatMap((slide) => slide.blocks.map((block) => block.content))
    .join('')
    .replace(/\s+/g, '')
}

function slide(title: string, content: string): LessonSlideDraft {
  return { title, blocks: [{ header: 'Nội dung', content }] }
}

describe('lesson slide count', () => {
  it('giữ nguyên khi đã đúng 10 slide', () => {
    const slides = Array.from({ length: 10 }, (_, index) => slide(`Ý ${index + 1}`, `Nội dung ý ${index + 1}.`))
    const fitted = fitLessonSlidesToExactCount(slides)
    assert.equal(fitted.length, LESSON_SLIDES_PER_LESSON)
    assert.equal(compact(fitted), compact(slides))
  })

  it('gộp slide thừa thành 10 và không bỏ ý', () => {
    const slides = Array.from({ length: 18 }, (_, index) => slide(`Ý ${index + 1}`, `Ý thứ ${index + 1} vẫn còn nguyên câu này.`))
    const fitted = fitLessonSlidesToExactCount(slides)
    assert.equal(fitted.length, 10)
    assert.equal(compact(fitted), compact(slides))
    assert.match(fitted[0].blocks.map((block) => block.content).join('\n'), /Ý thứ 1/)
    assert.match(fitted[9].blocks.map((block) => block.content).join('\n'), /Ý thứ 18/)
  })

  it('tách tiết ít ý thành 10 slide và không bỏ chữ', () => {
    const slides = [
      slide('Đạo hàm', 'Quy tắc. Ví dụ một. Bước giải. Luyện tập. Vận dụng.'),
      slide('Đạo hàm cấp hai', 'Định nghĩa. Công thức. Bài tính. Nhận xét.'),
    ]
    const fitted = fitLessonSlidesToExactCount(slides)
    assert.equal(fitted.length, 10)
    assert.equal(compact(fitted), compact(slides))
  })

  it('dựng đúng 10 slide từ mọi đoạn của tiết, kể cả đoạn dài', () => {
    const long = 'A'.repeat(900)
    const pieces = [long, ...Array.from({ length: 14 }, (_, index) => `Đoạn ${index + 1} của tiết.`)]
    const slides = buildLessonSlidesFromPieces('Tiết đạo hàm', pieces)
    assert.equal(slides.length, 10)
    assert.equal(compact(slides), pieces.join('').replace(/\s+/g, ''))
    assert.match(slides.map((item) => item.title).join('\n'), /Slide 1/)
    assert.match(slides[9].title, /Slide 10/)
  })
})
