import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOGO_GEMINI_ASPECT_RATIO,
  LOGO_GEMINI_ASPECT_RATIOS,
  normalizeLogoAspectRatioForGemini,
} from './gemini-working-aspect'

describe('normalizeLogoAspectRatioForGemini', () => {
  it('keeps allowed logo ratios', () => {
    for (const ratio of LOGO_GEMINI_ASPECT_RATIOS) {
      expect(normalizeLogoAspectRatioForGemini(ratio)).toBe(ratio)
    }
  })

  it('maps legacy wide ratios to supported ones', () => {
    expect(normalizeLogoAspectRatioForGemini('4:1')).toBe('16:9')
    expect(normalizeLogoAspectRatioForGemini('8:1')).toBe('21:9')
  })

  it('falls back to default for unknown ratios', () => {
    expect(normalizeLogoAspectRatioForGemini('1:4')).toBe(DEFAULT_LOGO_GEMINI_ASPECT_RATIO)
    expect(normalizeLogoAspectRatioForGemini('')).toBe(DEFAULT_LOGO_GEMINI_ASPECT_RATIO)
  })
})
