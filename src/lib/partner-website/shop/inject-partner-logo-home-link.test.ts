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
    expect(next).toContain('var FALLBACK="/"')
  })

  it('wraps the floated logo frame as a real home link with a pointer cursor', () => {
    const html = '<html><body></body></html>'
    const next = injectPartnerLogoHomeLinkScript(html, '188-com-vn-u560', true)
    expect(next).toContain('data-pw-logo-float')
    expect(next).toContain('wrapUnit')
    expect(next).toContain('repairPercentLogoHomes')
    expect(next).toContain("setProperty('cursor','pointer')")
    expect(next).not.toContain("link.style.display='contents'")
    expect(next).not.toContain("unit.style.setProperty('width','100%','important')")
    expect(next).not.toContain("unit.style.setProperty('height','100%','important')")
  })

  it('forces a live click on the logo to assign the shop home', () => {
    const next = injectPartnerLogoHomeLinkScript('<html><body></body></html>', '188-com-vn-u560', true)
    expect(next).toContain('function currentHome()')
    expect(next).toContain('location.assign(dest)')
    expect(next).toContain("addEventListener('click',onLogoClick,true)")
    expect(next).toContain('logoUnderPoint')
  })
})
