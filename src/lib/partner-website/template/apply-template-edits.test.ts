import { describe, expect, it } from 'vitest'
import { applyTemplateEditPayload } from '@/lib/partner-website/template/apply-template-edits'
import { buildDefaultLandingV1Site } from '@/lib/partner-website/template/default-landing-v1'

describe('applyTemplateEditPayload', () => {
  it('updates hero title via sectionOps', () => {
    const site = buildDefaultLandingV1Site({ locale: 'vi', title: 'Shop A' })
    const heroId = site.pages[0]!.sections[0]!.id
    const result = applyTemplateEditPayload(
      site,
      {
        sectionOps: [{ op: 'update', sectionId: heroId, props: { title: 'New Hero' } }],
      },
      ['hero-v1', 'features-v1', 'faq-v1', 'chat-cta-v1', 'footer-v1']
    )
    expect(result.errors).toHaveLength(0)
    expect(result.site.pages[0]!.sections[0]!.props.title).toBe('New Hero')
  })

  it('blocks removing platform-locked chat section', () => {
    const site = buildDefaultLandingV1Site({ locale: 'en', title: 'Shop' })
    const chat = site.pages[0]!.sections.find((s) => s.type === 'chat-cta-v1')
    expect(chat).toBeDefined()
    const result = applyTemplateEditPayload(
      site,
      { sectionOps: [{ op: 'remove', sectionId: chat!.id }] },
      ['hero-v1', 'chat-cta-v1']
    )
    expect(result.errors.some((e) => e.includes('platform'))).toBe(true)
  })
})
