import { describe, expect, it } from 'vitest'
import { injectPartnerLogoHomeLinkScript } from './inject-partner-logo-home-link'

describe('injectPartnerLogoHomeLinkScript', () => {
  it('injects a home-link script for platform shop URLs', () => {
    const html = '<html><body><img class="pw-logo" src="https://cdn.example/logo.png"/></body></html>'
    const next = injectPartnerLogoHomeLinkScript(html, '188-com-vn-u560')
    expect(next).toContain('pw-logo-home-link')
    expect(next).toContain('/site/188-com-vn-u560')
    expect(next).toContain('img.pw-logo')
  })

  it('uses / on a custom domain', () => {
    const html = '<html><body></body></html>'
    const next = injectPartnerLogoHomeLinkScript(html, '188-com-vn-u560', true)
    expect(next).toContain('var HOME="/"')
  })
})
