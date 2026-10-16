import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { splitLibraryByRecommendation } from './wedding-ai-library-match'

describe('splitLibraryByRecommendation', () => {
  const frames = [
    { id: 'f1', imageUrl: 'frame-from-a', referenceImageUrl: 'background-a' },
    { id: 'f2', imageUrl: 'frame-used-by-b', referenceImageUrl: '' },
    { id: 'f3', imageUrl: 'frame-other', referenceImageUrl: 'background-c' },
  ]

  it('recommends the frame created from the current background', () => {
    const split = splitLibraryByRecommendation(frames, { imageUrl: 'background-a', referenceImageUrl: '' })
    assert.deepEqual(split.recommended.map((item) => item.id), ['f1'])
    assert.deepEqual(split.rest.map((item) => item.id), ['f2', 'f3'])
  })

  it('recommends the background that was the reference of the current frame', () => {
    const backgrounds = [
      { id: 'a', imageUrl: 'background-a', referenceImageUrl: '' },
      { id: 'b', imageUrl: 'background-b', referenceImageUrl: 'frame-from-a' },
    ]
    const split = splitLibraryByRecommendation(backgrounds, {
      imageUrl: 'frame-from-a',
      referenceImageUrl: 'background-a',
    })
    assert.deepEqual(split.recommended.map((item) => item.id), ['a', 'b'])
  })

  it('returns the full library when nothing is selected yet', () => {
    const split = splitLibraryByRecommendation(frames, null)
    assert.equal(split.recommended.length, 0)
    assert.equal(split.rest.length, frames.length)
  })
})
