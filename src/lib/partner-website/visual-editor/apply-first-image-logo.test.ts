import { describe, expect, it } from 'vitest'
import {
  applyFirstImageLogoToHtml,
  applyFirstImageLogoToProject,
  extractFilledLogoUrl,
  htmlHasFilledLogoImage,
  projectHasFilledLogoImage,
} from './apply-first-image-logo'

const LOGO = 'https://cdn.example/logo.png'

describe('apply-first-image-logo', () => {
  it('extracts the first filled logo url', () => {
    expect(extractFilledLogoUrl('<span class="pw-wordmark">188.com.vn</span>')).toBe('')
    expect(extractFilledLogoUrl(`<img class="pw-logo" src="${LOGO}" alt="x"/>`)).toBe(LOGO)
  })

  it('detects filled vs text-only logo html', () => {
    expect(htmlHasFilledLogoImage('<a class="pw-brand"><span class="pw-wordmark">188.com.vn</span></a>')).toBe(
      false
    )
    expect(
      htmlHasFilledLogoImage(`<img class="pw-logo" src="${LOGO}" alt="188.com.vn"/>`)
    ).toBe(true)
    expect(htmlHasFilledLogoImage('<img class="pw-logo" src="data:image/gif;base64,xx" alt="logo"/>')).toBe(
      false
    )
    expect(
      projectHasFilledLogoImage({
        entryPath: 'index.html',
        files: [
          { path: 'index.html', kind: 'html', content: '<span class="pw-wordmark">Shop</span>' },
          { path: 'index.mobile.html', kind: 'html', content: `<img class="pw-logo" src="${LOGO}"/>` },
        ],
      })
    ).toBe(true)
  })

  it('replaces desktop and mobile text wordmarks with the first image', () => {
    const desktop =
      '<header><a class="pw-brand" href="/"><span class="pw-wordmark">188.com.vn</span></a></header>'
    const mobile =
      '<header><a class="pw-shop-brand" href="/">188.com.vn</a></header>'
    const project = applyFirstImageLogoToProject(
      {
        entryPath: 'index.html',
        files: [
          { path: 'index.html', kind: 'html', content: desktop },
          { path: 'index.mobile.html', kind: 'html', content: mobile },
          { path: 'theme.css', kind: 'css', content: 'body{}' },
        ],
      },
      LOGO,
      '188.com.vn'
    )
    const desk = project.files.find((f) => f.path === 'index.html')?.content || ''
    const mob = project.files.find((f) => f.path === 'index.mobile.html')?.content || ''
    expect(desk).toContain(`src="${LOGO}"`)
    expect(desk).toContain('data-pw-logo-wordmark-hidden="1"')
    expect(desk).toContain('188.com.vn')
    expect(mob).toContain(`src="${LOGO}"`)
    expect(mob).toContain('data-pw-logo-wordmark-hidden="1"')
    expect(project.files.find((f) => f.path === 'theme.css')?.content).toBe('body{}')
  })

  it('fills empty placeholder imgs and hides leftover wordmarks', () => {
    const html = applyFirstImageLogoToHtml(
      '<a class="pw-brand" href="/"><img class="pw-logo" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-pw-logo-empty="1" alt="logo"/><span class="pw-wordmark">188.com.vn</span></a>',
      LOGO
    )
    expect(html).toContain(`src="${LOGO}"`)
    expect(html).not.toContain('data-pw-logo-empty')
    expect(html).toContain('data-pw-logo-wordmark-hidden="1"')
  })

  it('does not overwrite an already-filled image logo on later edits', () => {
    const existing = `<a class="pw-brand" href="/"><img class="pw-logo" src="https://cdn.example/old.png" alt="x"/><span class="pw-wordmark" data-pw-logo-wordmark-hidden="1" style="display:none">Shop</span></a>`
    expect(applyFirstImageLogoToHtml(existing, LOGO)).toBe(existing)
  })

  it('hides leftover raw brand text beside the first image', () => {
    const html = applyFirstImageLogoToHtml(
      `<a class="pw-shop-brand" href="/"><img class="pw-logo" src="${LOGO}" alt="x"/>188.com.vn</a>`,
      LOGO
    )
    expect(html).toContain(`src="${LOGO}"`)
    expect(html).toContain('data-pw-logo-wordmark-hidden="1"')
    expect(html).toContain('188.com.vn')
    expect(html).not.toMatch(/src="[^"]+"[^>]*>\s*188\.com\.vn\s*<\/a>/)
  })

  it('replaces footer shop-name text with the first image', () => {
    const html = applyFirstImageLogoToHtml(
      '<div class="pw-shop-footer-brand"><p class="pw-shop-footer-name">188.com.vn</p><p class="pw-shop-footer-hint">Mua sắm trực tuyến</p></div>',
      LOGO,
      '188.com.vn'
    )
    expect(html).toContain(`src="${LOGO}"`)
    expect(html).toContain('pw-shop-footer-logo')
    expect(html).toContain('data-pw-logo-wordmark-hidden="1"')
    expect(html).toContain('Mua sắm trực tuyến')
    expect(html).not.toMatch(/<p class="pw-shop-footer-name">188\.com\.vn<\/p>/)
  })

  it('does not inject a brand logo when a floated header logo already exists', () => {
    const html = `<header><a class="pw-brand" href="/"><span class="pw-wordmark">188.com.vn</span></a><span class="pw-logo-frame" data-pw-logo-float="1" style="left:80px;top:12px"><img class="pw-logo" src="${LOGO}" alt="logo"/></span></header>`
    const next = applyFirstImageLogoToHtml(html, LOGO)
    expect(next.match(/<img\b/g)?.length).toBe(1)
    expect(next).toContain('data-pw-logo-float')
    expect(next).toContain('left:80px')
    expect(next).not.toMatch(/<a class="pw-brand"[^>]*>\s*<img class="pw-logo"/)
  })

  it('does not treat pw-brand-cluster as a brand link', () => {
    const html = '<div class="pw-brand-cluster"><nav>Danh mục</nav></div>'
    expect(applyFirstImageLogoToHtml(html, LOGO)).toBe(html)
  })
})
