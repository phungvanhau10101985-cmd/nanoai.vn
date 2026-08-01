import { describe, expect, it } from 'vitest'
import {
  classifyGuestHonorific,
  normalizeHonorificText,
  resolveHostReferenceStyle,
  stripQuyHonorificPrefix,
} from './wedding-guest-honorific-map'

describe('stripQuyHonorificPrefix', () => {
  it('removes Quý prefix', () => {
    expect(stripQuyHonorificPrefix('Quý anh')).toBe('Anh')
    expect(stripQuyHonorificPrefix('quý chị')).toBe('chị')
  })

  it('keeps honorific without Quý', () => {
    expect(stripQuyHonorificPrefix('Chú')).toBe('Chú')
  })
})

describe('classifyGuestHonorific', () => {
  it('classifies multi-word phrases', () => {
    expect(classifyGuestHonorific('Ông nội')).toBe('elder')
    expect(classifyGuestHonorific('Anh rể')).toBe('older_sibling')
    expect(classifyGuestHonorific('Em gái')).toBe('younger')
  })

  it('treats Quý anh like Anh after stripping', () => {
    expect(classifyGuestHonorific('Quý anh')).toBe('older_sibling')
    expect(classifyGuestHonorific('Quý ông')).toBe('elder')
    expect(normalizeHonorificText('Quý chị')).toBe('chị')
  })

  it('classifies single-word honorifics', () => {
    expect(classifyGuestHonorific('Ba')).toBe('parent')
    expect(classifyGuestHonorific('Bạn')).toBe('peer')
  })
})

describe('resolveHostReferenceStyle', () => {
  it('maps Quý anh same as Anh', () => {
    expect(resolveHostReferenceStyle('Quý anh', 'groom').pronoun).toBe('Em')
    expect(resolveHostReferenceStyle('Anh', 'groom').pronoun).toBe('Em')
  })
})
