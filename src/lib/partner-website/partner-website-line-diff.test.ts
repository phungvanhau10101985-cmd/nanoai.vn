import { describe, expect, it } from 'vitest'
import {
  buildFileDiff,
  diffLineArrays,
  diffProjectByPath,
  diffText,
  formatDiffForDisplay,
} from '@/lib/partner-website/partner-website-line-diff'

describe('diffLineArrays', () => {
  it('detects insertions and deletions', () => {
    const lines = diffLineArrays(['a', 'b', 'c'], ['a', 'x', 'c'])
    expect(lines.filter((l) => l.type === 'remove').map((l) => l.text)).toEqual(['b'])
    expect(lines.filter((l) => l.type === 'add').map((l) => l.text)).toEqual(['x'])
  })
})

describe('buildFileDiff', () => {
  it('counts added and removed lines', () => {
    const diff = buildFileDiff('css/main.css', '.hero { color: red; }', '.hero { color: blue; }')
    expect(diff.added).toBe(1)
    expect(diff.removed).toBe(1)
    expect(diff.path).toBe('css/main.css')
  })
})

describe('diffProjectByPath', () => {
  it('returns only changed files', () => {
    const diffs = diffProjectByPath(
      { 'index.html': '<html></html>', 'css/a.css': 'a' },
      { 'index.html': '<html></html>', 'css/a.css': 'b' }
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0]?.path).toBe('css/a.css')
  })
})

describe('formatDiffForDisplay', () => {
  it('prefixes lines with + and -', () => {
    const diff = buildFileDiff('x', 'old', 'new')
    const text = formatDiffForDisplay(diff)
    expect(text).toMatch(/^-/)
    expect(text).toMatch(/^\+/m)
  })
})

describe('diffText', () => {
  it('returns same-type lines when identical', () => {
    const lines = diffText('a\nb', 'a\nb')
    expect(lines.every((l) => l.type === 'same')).toBe(true)
  })
})
