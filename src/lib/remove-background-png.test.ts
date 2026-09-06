import { describe, expect, it } from 'vitest'
import {
  LOGO_REMOVE_BG_MASK_PROMPT,
  PRODUCT_REMOVE_BG_MASK_PROMPT,
  REMOVE_BG_PNG_CREDIT,
  chargedCreditsForLogoCreate,
  removeBgMaskPrompt,
  requiredCreditsForLogoCreate,
} from './remove-background-png-prompts'

describe('removeBgMaskPrompt', () => {
  it('product variant keeps logo blocks intact (xoa-nen-png)', () => {
    const p = removeBgMaskPrompt('product')
    expect(p).toBe(PRODUCT_REMOVE_BG_MASK_PROMPT)
    expect(p).toContain('do NOT remove background from logo areas')
    expect(p).toContain('Keep logo + its background block')
  })

  it('logo variant cuts canvas around the mark', () => {
    const p = removeBgMaskPrompt('logo')
    expect(p).toBe(LOGO_REMOVE_BG_MASK_PROMPT)
    expect(p).toContain('logo mark only')
    expect(p).toContain('Cut tightly around the logo silhouette')
    expect(p).toContain('Do NOT keep a colored plate')
    expect(p).not.toContain('do NOT remove background from logo areas')
  })
})

describe('logo remove-bg credits', () => {
  it('requires generate + xoa-nen-png 1.5 up front', () => {
    expect(REMOVE_BG_PNG_CREDIT).toBe(1.5)
    expect(requiredCreditsForLogoCreate(1.5)).toBe(3)
    expect(requiredCreditsForLogoCreate(3)).toBe(4.5)
  })

  it('charges remove-bg only when the Gemini mask succeeded', () => {
    expect(chargedCreditsForLogoCreate(1.5, true)).toBe(3)
    expect(chargedCreditsForLogoCreate(1.5, false)).toBe(1.5)
    expect(chargedCreditsForLogoCreate(3, true)).toBe(4.5)
    expect(chargedCreditsForLogoCreate(3, false)).toBe(3)
  })
})
