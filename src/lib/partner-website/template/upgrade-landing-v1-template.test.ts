import { describe, expect, it } from 'vitest'
import { buildDefaultLandingV1Site } from '@/lib/partner-website/template/default-landing-v1'
import { upgradeLandingV1Pages } from '@/lib/partner-website/template/upgrade-landing-v1-template'

describe('upgradeLandingV1Pages', () => {
  it('adds personalization sections when missing', () => {
    const site = buildDefaultLandingV1Site({ locale: 'vi', title: 'Shop' })
    const home = site.pages[0]!
    const without = home.sections.filter(
      (s) =>
        s.type !== 'recently-viewed-v1' &&
        s.type !== 'favorites-v1' &&
        s.type !== 'recommended-for-you-v1'
    )
    const pages = [{ ...home, sections: without }]
    const result = upgradeLandingV1Pages({ pages, locale: 'vi' })
    expect(result.changed).toBe(true)
    const types = result.pages[0]!.sections.map((s) => s.type)
    expect(types).toContain('recently-viewed-v1')
    expect(types).toContain('favorites-v1')
    expect(types).toContain('recommended-for-you-v1')
    const prodIdx = types.indexOf('products-v1')
    const recentIdx = types.indexOf('recently-viewed-v1')
    expect(recentIdx).toBeGreaterThan(prodIdx)
  })

  it('is idempotent when sections already exist', () => {
    const site = buildDefaultLandingV1Site({ locale: 'en', title: 'Shop' })
    const result = upgradeLandingV1Pages({ pages: site.pages, locale: 'en' })
    expect(result.changed).toBe(false)
  })
})
