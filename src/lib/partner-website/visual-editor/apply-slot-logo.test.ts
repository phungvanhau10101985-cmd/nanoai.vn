import { describe, expect, it } from 'vitest'
import {
  applySlotLogoToHtml,
  applySlotLogoToProject,
  extractLogoInventoryFromProject,
  extractSlotLogoUrlFromHtml,
} from './apply-slot-logo'

const HEADER = 'https://cdn.example/header.png'
const FOOTER = 'https://cdn.example/footer.png'
const CHAT = 'https://cdn.example/chat.png'
const NEXT_H = 'https://cdn.example/header-2.png'
const NEXT_F = 'https://cdn.example/footer-2.png'

const headerHtml = `<header class="pw-header">
  <a class="pw-brand" href="/"><img class="pw-logo" src="${HEADER}" alt="Shop" data-pw-logo-slot="header"/>
  <span class="pw-wordmark">Shop</span></a>
  <button data-pw-chrome-btn="chat"><span class="pw-chrome-icon-wrap"><img class="pw-chrome-chat-logo" src="${CHAT}"/></span></button>
</header>
<footer class="pw-footer"><div class="pw-shop-footer-brand"><img class="pw-shop-footer-logo" src="${FOOTER}" data-pw-logo-slot="footer"/></div></footer>`

describe('apply-slot-logo', () => {
  it('extracts header, footer, and chat independently', () => {
    expect(extractSlotLogoUrlFromHtml(headerHtml, 'header')).toBe(HEADER)
    expect(extractSlotLogoUrlFromHtml(headerHtml, 'footer')).toBe(FOOTER)
    expect(extractSlotLogoUrlFromHtml(headerHtml, 'chat')).toBe(CHAT)
  })

  it('overwrites only the header slot', () => {
    const next = applySlotLogoToHtml(headerHtml, 'header', NEXT_H)
    expect(next).toContain(NEXT_H)
    expect(next).toContain(FOOTER)
    expect(next).toContain(CHAT)
    expect(next).not.toContain(HEADER)
  })

  it('overwrites only the footer slot', () => {
    const next = applySlotLogoToHtml(headerHtml, 'footer', NEXT_F)
    expect(next).toContain(HEADER)
    expect(next).toContain(NEXT_F)
    expect(next).not.toContain(FOOTER)
    expect(next).toContain(CHAT)
  })

  it('applies a slot to one device without touching the others', () => {
    const project = applySlotLogoToProject(
      {
        entryPath: 'index.html',
        files: [
          { path: 'index.html', kind: 'html', content: headerHtml },
          { path: 'index.mobile.html', kind: 'html', content: headerHtml },
        ],
      },
      'header',
      NEXT_H,
      'mobile'
    )
    const desk = project.files.find((f) => f.path === 'index.html')?.content || ''
    const mob = project.files.find((f) => f.path === 'index.mobile.html')?.content || ''
    expect(desk).toContain(HEADER)
    expect(desk).not.toContain(NEXT_H)
    expect(mob).toContain(NEXT_H)
    expect(mob).toContain(FOOTER)
  })

  it('applies chat icon to every device', () => {
    const nextChat = 'https://cdn.example/chat-2.png'
    const project = applySlotLogoToProject(
      {
        entryPath: 'index.html',
        files: [
          { path: 'index.html', kind: 'html', content: headerHtml },
          { path: 'index.mobile.html', kind: 'html', content: headerHtml },
        ],
      },
      'chat',
      nextChat,
      'mobile'
    )
    const desk = project.files.find((f) => f.path === 'index.html')?.content || ''
    const mob = project.files.find((f) => f.path === 'index.mobile.html')?.content || ''
    expect(desk).toContain(nextChat)
    expect(mob).toContain(nextChat)
    expect(desk).toContain(HEADER)
    expect(mob).toContain(HEADER)
  })

  it('reads inventory from each device home file', () => {
    const inv = extractLogoInventoryFromProject(
      {
        entryPath: 'index.html',
        files: [
          { path: 'index.html', kind: 'html', content: headerHtml },
          {
            path: 'index.mobile.html',
            kind: 'html',
            content: headerHtml.replace(HEADER, 'https://cdn.example/mobile-h.png'),
          },
        ],
      },
      'https://cdn.example/favicon.png',
      'https://cdn.example/chat-theme.png'
    )
    expect(inv.faviconUrl).toBe('https://cdn.example/favicon.png')
    expect(inv.chatUrl).toBe('https://cdn.example/chat-theme.png')
    expect(inv.header.desktop).toBe(HEADER)
    expect(inv.header.mobile).toBe('https://cdn.example/mobile-h.png')
    expect(inv.footer.desktop).toBe(FOOTER)
  })
})
