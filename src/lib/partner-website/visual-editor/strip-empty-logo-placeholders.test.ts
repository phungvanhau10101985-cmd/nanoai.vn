import { describe, expect, it } from 'vitest'
import { stripEmptyLogoPlaceholdersFromHtml } from './strip-empty-logo-placeholders'

describe('stripEmptyLogoPlaceholdersFromHtml', () => {
  it('removes empty drawn logo and shows the wordmark again', () => {
    const html = `<a class="pw-brand" href="/"><img class="pw-logo" data-pw-logo-added="1" data-pw-logo-empty="1" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="logo"/><span class="pw-wordmark" data-pw-logo-wordmark-hidden="1" style="display:none">188.com.vn</span></a>`
    const next = stripEmptyLogoPlaceholdersFromHtml(html)
    expect(next).not.toContain('data-pw-logo-empty')
    expect(next).not.toContain('<img')
    expect(next).toContain('188.com.vn')
    expect(next).not.toContain('data-pw-logo-wordmark-hidden')
  })

  it('keeps a real uploaded logo', () => {
    const html = `<a class="pw-brand"><img class="pw-logo" src="https://cdn.example/logo.png" alt="188"/></a>`
    expect(stripEmptyLogoPlaceholdersFromHtml(html)).toBe(html)
  })

  it('keeps a real https logo even if the empty flag was left on', () => {
    const html = `<a class="pw-brand" href="/"><img class="pw-logo" data-pw-logo-added="1" data-pw-logo-empty="1" src="https://cdn.example/logo.png" alt="logo"/><span class="pw-wordmark" data-pw-logo-wordmark-hidden="1" style="display:none">188.com.vn</span></a>`
    const next = stripEmptyLogoPlaceholdersFromHtml(html)
    expect(next).toContain('https://cdn.example/logo.png')
    expect(next).toContain('<img')
    expect(next).not.toContain('data-pw-logo-empty')
    expect(next).toContain('data-pw-logo-wordmark-hidden')
  })

  it('keeps a positioned floated logo instead of seating it back into the brand', () => {
    const html = `<header class="pw-header"><div class="pw-brand-cluster"><a class="pw-brand" href="/"><span class="pw-wordmark" data-pw-logo-wordmark-hidden="1" style="display:none">188.com.vn</span></a></div><span class="pw-logo-frame" data-pw-logo-frame="1" data-pw-logo-float="1" style="position:absolute;left:12px;top:8px;width:140px;height:36px"><img class="pw-logo" src="https://cdn.example/desk-logo.png" alt="logo"/></span></header>`
    const next = stripEmptyLogoPlaceholdersFromHtml(html)
    expect(next).toContain('https://cdn.example/desk-logo.png')
    expect(next).toContain('data-pw-logo-float="1"')
    expect(next).toContain('left:12px')
    expect(next).toContain('top:8px')
    expect(next).toContain('data-pw-logo-wordmark-hidden')
  })

  it('seats an unpositioned orphan logo back into the brand', () => {
    const html = `<header class="pw-header"><div class="pw-brand-cluster"><a class="pw-brand" href="/"><span class="pw-wordmark">188.com.vn</span></a></div><span class="pw-logo-frame" data-pw-logo-frame="1" style="width:140px;height:36px"><img class="pw-logo" src="https://cdn.example/desk-logo.png" alt="logo"/></span></header>`
    const next = stripEmptyLogoPlaceholdersFromHtml(html)
    expect(next).toContain('https://cdn.example/desk-logo.png')
    expect(next).toMatch(/<a class="pw-brand"[^>]*>[\s\S]*pw-logo-frame/)
    expect(next).not.toContain('data-pw-logo-float')
  })

  it('keeps the sized editor logo and drops the leftover tiny brand copy', () => {
    const html = `<header class="pw-header"><span class="pw-logo-frame" data-pw-logo-frame="1" data-pw-logo-float="1" style="width:180px;height:48px"><img class="pw-logo" src="https://cdn.example/new.png" alt="logo"/></span><div class="pw-header-main"><div class="pw-brand-cluster"><button class="pw-cat-btn">Danh mục</button><a class="pw-brand" href="/"><img class="pw-logo" src="https://cdn.example/old.png" alt="188"/></a></div></div></header>`
    const next = stripEmptyLogoPlaceholdersFromHtml(html)
    expect(next.match(/<img\b/g)?.length).toBe(1)
    expect(next).toContain('https://cdn.example/new.png')
    expect(next).not.toContain('https://cdn.example/old.png')
    expect(next).toContain('width:180px')
    expect(next).toContain('pw-cat-btn')
    expect(next).not.toContain('data-pw-logo-float')
    expect(next).toMatch(/<a class="pw-brand"[^>]*>[\s\S]*pw-logo-frame/)
  })

  it('seats a same-src floated logo into the brand instead of dropping it', () => {
    const html = `<header class="pw-header"><div class="pw-brand-cluster"><a class="pw-brand" href="/"><img class="pw-logo" src="https://cdn.example/logo.png" alt="188"/><span class="pw-wordmark" data-pw-logo-wordmark-hidden="1" style="display:none">188.com.vn</span></a></div><span class="pw-logo-frame" data-pw-logo-frame="1" data-pw-logo-float="1" style="width:160px;height:40px"><img class="pw-logo" src="https://cdn.example/logo.png" alt="logo"/></span></header>`
    const next = stripEmptyLogoPlaceholdersFromHtml(html)
    expect(next.match(/<img\b/g)?.length).toBe(1)
    expect(next.match(/class="pw-logo-frame"/g)?.length).toBe(1)
    expect(next).toContain('https://cdn.example/logo.png')
    expect(next).toContain('width:160px')
    expect(next).toMatch(/<a class="pw-brand"[^>]*>[\s\S]*pw-logo-frame/)
  })

  it('keeps one header logo when two tiny copies sit in the brand cluster', () => {
    const html = `<header class="pw-header"><div class="pw-brand-cluster"><a class="pw-brand" href="/"><img class="pw-logo" src="https://cdn.example/a.png" alt="1"/><img class="pw-logo" src="https://cdn.example/a.png" alt="2"/></a></div></header>`
    const next = stripEmptyLogoPlaceholdersFromHtml(html)
    expect(next.match(/<img\b/g)?.length).toBe(1)
  })

  it('keeps only the first header logo frame', () => {
    const frame = `<span class="pw-logo-frame" data-pw-logo-frame="1"><a class="pw-brand" href="/"><img class="pw-logo" src="https://cdn.example/logo.png" alt="logo"/></a></span>`
    const html = `<div class="pw-shop-brand-cluster"><button class="pw-shop-cat-btn">Menu</button>${frame}${frame}${frame}</div>`
    const next = stripEmptyLogoPlaceholdersFromHtml(html)
    expect(next.match(/class="pw-logo-frame"/g)?.length).toBe(1)
    expect(next.match(/<img\b/g)?.length).toBe(1)
    expect(next).toContain('pw-shop-cat-btn')
  })
})
