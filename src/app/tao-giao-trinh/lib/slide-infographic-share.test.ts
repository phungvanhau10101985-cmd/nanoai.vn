import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeStoredSlideImages, useSharedSlideImages, type SlideInfographic } from './slide-infographic'

function image(url: string, ink = false): SlideInfographic {
  return {
    summary: 'tom tat',
    mermaid: 'flowchart TD',
    imageUrl: url,
    generatedAt: '2026-11-27T12:00:00.000Z',
    ...(ink ? { inkWidth: 100, inkHeight: 50, inkLines: [{ text: 'A', x: 1, y: 2, w: 3, h: 4 }] } : {}),
  }
}

test('lưu chữ không xóa ảnh đã có', () => {
  const stored = [{ assistantImage: image('https://cdn.example/a.webp') }]
  const incoming = [{ title: 'Giữ chữ', assistantImage: undefined }]
  const merged = mergeStoredSlideImages(incoming, stored)
  assert.equal(merged[0]?.assistantImage?.imageUrl, 'https://cdn.example/a.webp')
  assert.equal(merged[0]?.title, 'Giữ chữ')
})

test('ảnh mới thay ảnh cũ', () => {
  const stored = [{ assistantImage: image('https://cdn.example/a.webp') }]
  const incoming = [{ assistantImage: image('https://cdn.example/b.webp') }]
  const merged = mergeStoredSlideImages(incoming, stored)
  assert.equal(merged[0]?.assistantImage?.imageUrl, 'https://cdn.example/b.webp')
})

test('slide riêng dùng đúng ảnh của slide chung', () => {
  const shared = [{ assistantImage: image('https://cdn.example/shared.webp', true) }]
  const personal = [{ assistantImage: image('https://cdn.example/own.webp'), title: 'Bản riêng' }]
  const shown = useSharedSlideImages(personal, shared)
  assert.equal(shown[0]?.assistantImage?.imageUrl, 'https://cdn.example/shared.webp')
  assert.equal(shown[0]?.assistantImage?.inkLines?.[0]?.text, 'A')
  assert.equal(shown[0]?.title, 'Bản riêng')
})

test('cùng URL thì giữ khung chữ đang có trên bản đang đọc', () => {
  const shared = [{ assistantImage: image('https://cdn.example/shared.webp') }]
  const personal = [{ assistantImage: image('https://cdn.example/shared.webp', true) }]
  const shown = useSharedSlideImages(personal, shared)
  assert.equal(shown[0]?.assistantImage?.inkLines?.[0]?.text, 'A')
})
