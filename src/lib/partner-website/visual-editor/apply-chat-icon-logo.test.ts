import { describe, expect, it } from 'vitest'
import { applyChatIconLogoToHtml, applyChatIconLogoToProject } from './apply-chat-icon-logo'

const ICON = 'https://cdn.example.com/chat-icon.png'
const NEXT = 'https://cdn.example.com/chat-icon-2.png'

describe('apply-chat-icon-logo', () => {
  it('updates existing Chat mua img and stamps shared flag', () => {
    const html = `<button type="button" data-pw-chrome-btn="chat" data-nanoai-open-chat>
    <span class="pw-chrome-icon-wrap">
      <img class="pw-chrome-chat-logo" src="https://cdn.example.com/old.png" alt="" />
    </span>
  </button>`
    const next = applyChatIconLogoToHtml(html, ICON)
    expect(next).toContain('src="https://cdn.example.com/chat-icon.png"')
    expect(next).toContain('data-pw-chat-icon-logo="1"')
    expect(next).not.toContain('old.png')
  })

  it('inserts img when Chat mua only has svg', () => {
    const html = `<button type="button" class="pw-chat-open" data-pw-chrome-btn="chat">
    <span class="pw-chrome-icon-wrap"><svg viewBox="0 0 24 24"></svg></span>
  </button>`
    const next = applyChatIconLogoToHtml(html, ICON)
    expect(next).toContain('pw-chrome-chat-logo')
    expect(next).toContain('src="https://cdn.example.com/chat-icon.png"')
    expect(next).not.toContain('<svg')
    expect(next).toContain('data-pw-chat-icon-logo="1"')
  })

  it('leaves shop logo and other chrome alone', () => {
    const html = `<a class="pw-brand"><img class="pw-logo" src="https://cdn.example.com/shop.png" alt="Shop"/></a>
  <a data-pw-chrome-btn="chat-zalo"><span class="pw-chrome-icon-wrap"><svg></svg></span></a>`
    expect(applyChatIconLogoToHtml(html, ICON)).toBe(html)
  })

  it('stamps every device HTML file from one source', () => {
    const project = applyChatIconLogoToProject(
      {
        entryPath: 'index.html',
        files: [
          {
            path: 'index.html',
            kind: 'html',
            content: `<button data-pw-chrome-btn="chat"><span class="pw-chrome-icon-wrap"><img class="pw-chrome-chat-logo" src="https://old/d.png"/></span></button>`,
          },
          {
            path: 'index.tablet.html',
            kind: 'html',
            content: `<button data-pw-chrome-btn="chat"><span class="pw-chrome-icon-wrap"><img class="pw-chrome-chat-logo" src="https://old/t.png"/></span></button>`,
          },
          {
            path: 'index.mobile.html',
            kind: 'html',
            content: `<button data-pw-chrome-btn="chat"><span class="pw-chrome-icon-wrap"><img class="pw-chrome-chat-logo" src="https://old/m.png"/></span></button>`,
          },
        ],
      },
      NEXT
    )
    for (const f of project.files) {
      expect(f.content).toContain('chat-icon-2.png')
      expect(f.content).toContain('data-pw-chat-icon-logo="1"')
      expect(f.content).not.toContain('old/')
    }
  })
})
