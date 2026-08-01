import type { WebLocale } from '@/lib/i18n/config'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { readLandingSectionBrief, type LandingDesignStepKey } from '@/lib/hub-chat/hub-studio-preset-flows'
import {
  collectLandingPageSections,
  landingPageTitle,
  type LandingPageSection,
} from '@/lib/hub-chat/landing-page-sections'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export type ParsedSectionCopy = {
  headline?: string
  subheadline?: string
  cta?: string
  bullets: string[]
  raw: string
}

export type LandingTheme = {
  primary: string
  accent: string
  bg: string
  text: string
  muted: string
}

const DEFAULT_THEME: LandingTheme = {
  primary: '#1e3a5f',
  accent: '#f97316',
  bg: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
}

const LANG: Record<WebLocale, string> = {
  vi: 'vi',
  en: 'en',
  zh: 'zh',
  ja: 'ja',
  ko: 'ko',
}

const UI: Record<
  WebLocale,
  {
    ctaDefault: string
    featuresTitle: string
    pricingTitle: string
    testimonialsTitle: string
    faqTitle: string
    footerCta: string
    footerNote: string
  }
> = {
  vi: {
    ctaDefault: 'Bắt đầu ngay',
    featuresTitle: 'Tính năng nổi bật',
    pricingTitle: 'Bảng giá',
    testimonialsTitle: 'Khách hàng nói gì',
    faqTitle: 'Câu hỏi thường gặp',
    footerCta: 'Sẵn sàng bắt đầu?',
    footerNote: 'Landing page — chỉnh sửa trực tiếp file HTML này.',
  },
  en: {
    ctaDefault: 'Get started',
    featuresTitle: 'Key features',
    pricingTitle: 'Pricing',
    testimonialsTitle: 'What customers say',
    faqTitle: 'FAQ',
    footerCta: 'Ready to get started?',
    footerNote: 'Landing page — edit this HTML file directly.',
  },
  zh: {
    ctaDefault: '立即开始',
    featuresTitle: '核心功能',
    pricingTitle: '价格',
    testimonialsTitle: '客户评价',
    faqTitle: '常见问题',
    footerCta: '准备好开始了吗？',
    footerNote: '落地页 — 可直接编辑此 HTML 文件。',
  },
  ja: {
    ctaDefault: '今すぐ始める',
    featuresTitle: '主な機能',
    pricingTitle: '料金',
    testimonialsTitle: 'お客様の声',
    faqTitle: 'よくある質問',
    footerCta: '始める準備はできましたか？',
    footerNote: 'ランディングページ — このHTMLを直接編集できます。',
  },
  ko: {
    ctaDefault: '지금 시작',
    featuresTitle: '주요 기능',
    pricingTitle: '요금',
    testimonialsTitle: '고객 후기',
    faqTitle: '자주 묻는 질문',
    footerCta: '시작할 준비가 되셨나요?',
    footerNote: '랜딩 페이지 — 이 HTML 파일을 직접 편집하세요.',
  },
}

function extractHexColors(text: string): string[] {
  const matches = text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
  return [...new Set(matches.map((c) => c.toLowerCase()))]
}

export function resolveLandingTheme(briefNotes: Record<string, string>): LandingTheme {
  const palette = briefNotes.color_palette?.trim() ?? ''
  const hex = extractHexColors(palette)
  if (hex.length >= 2) {
    return {
      ...DEFAULT_THEME,
      primary: hex[0]!,
      accent: hex[1]!,
    }
  }
  if (hex.length === 1) {
    return { ...DEFAULT_THEME, primary: hex[0]! }
  }
  const mood = (briefNotes.style_mood ?? '').toLowerCase()
  if (mood.includes('dark') || mood.includes('tối')) {
    return {
      primary: '#6366f1',
      accent: '#22d3ee',
      bg: '#0f172a',
      text: '#f8fafc',
      muted: '#94a3b8',
    }
  }
  return DEFAULT_THEME
}

function pickField(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]?.trim()) return m[1].trim().replace(/^["'«]|["'»]$/g, '')
  }
  return undefined
}

export function parseLandingSectionCopy(text: string): ParsedSectionCopy {
  const raw = text.trim()
  if (!raw) return { bullets: [], raw: '' }

  const headline = pickField(raw, [
    /(?:headline|tiêu đề|标题|見出し|헤드라인)\s*[:：]\s*["'«]?([^·|]+?)["'»]?(?:\s*[·|]|$)/iu,
    /^["'«]([^"'»]+)["'»]/u,
  ])
  const subheadline = pickField(raw, [
    /(?:sub(?:headline)?|phụ đề|副标题|サブ|서브)\s*[:：]\s*["'«]?([^·|]+?)["'»]?(?:\s*[·|]|$)/iu,
  ])
  const cta = pickField(raw, [
    /(?:cta|nút|按钮|ボタン|버튼)\s*[:：]\s*["'«]?([^·|]+?)["'»]?(?:\s*[·|]|$)/iu,
  ])

  const bullets = raw
    .split(/[·•|\n]/)
    .map((part) => part.trim())
    .filter((part) => {
      if (part.length < 3) return false
      if (/^(headline|sub|cta|tiêu đề|phụ đề)/iu.test(part)) return false
      return true
    })
    .map((part) => part.replace(/^\(\d+\)\s*/, '').replace(/^\d+[.)]\s*/, ''))

  return { headline, subheadline, cta, bullets, raw }
}

function sectionCopy(session: HubStudioSession, key: LandingDesignStepKey): ParsedSectionCopy {
  return parseLandingSectionCopy(readLandingSectionBrief(key, session.briefNotes))
}

function mockupImg(section: LandingPageSection | undefined, className: string): string {
  if (!section?.url) return ''
  return `<figure class="${className}"><img src="${escapeAttr(section.url)}" alt="${escapeAttr(section.label)}" loading="lazy" /></figure>`
}

function bulletList(items: string[]): string {
  const usable = items.filter((x) => x.length >= 2)
  if (!usable.length) return ''
  return `<ul class="lp-list">${usable.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function buildStyles(theme: LandingTheme): string {
  return `:root {
  --lp-primary: ${theme.primary};
  --lp-accent: ${theme.accent};
  --lp-bg: ${theme.bg};
  --lp-text: ${theme.text};
  --lp-muted: ${theme.muted};
  --lp-radius: 14px;
  --lp-max: 1120px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: var(--lp-bg); color: var(--lp-text); line-height: 1.6;
}
a { color: inherit; }
.lp-container { width: min(100% - 32px, var(--lp-max)); margin-inline: auto; }
.lp-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 0; }
.lp-logo { max-height: 40px; max-width: 160px; object-fit: contain; }
.lp-brand { font-weight: 700; font-size: 1.125rem; }
.lp-nav a { margin-left: 16px; text-decoration: none; color: var(--lp-muted); font-size: 0.875rem; }
.lp-hero { display: grid; gap: 32px; align-items: center; padding: 48px 0 64px; }
@media (min-width: 900px) { .lp-hero { grid-template-columns: 1.1fr 0.9fr; } }
.lp-hero h1 { font-size: clamp(2rem, 4vw, 3.25rem); line-height: 1.1; margin: 0 0 16px; letter-spacing: -0.02em; }
.lp-hero .lp-lead { font-size: 1.125rem; color: var(--lp-muted); margin: 0 0 24px; max-width: 42ch; }
.lp-btn {
  display: inline-block; padding: 14px 22px; border-radius: 999px; text-decoration: none;
  font-weight: 600; font-size: 0.95rem; border: none; cursor: pointer;
}
.lp-btn-primary { background: linear-gradient(135deg, var(--lp-primary), var(--lp-accent)); color: #fff; }
.lp-btn-secondary { background: transparent; border: 1px solid color-mix(in srgb, var(--lp-text) 20%, transparent); }
.lp-section { padding: 56px 0; }
.lp-section h2 { font-size: clamp(1.5rem, 3vw, 2rem); margin: 0 0 12px; }
.lp-section .lp-sub { color: var(--lp-muted); margin: 0 0 28px; }
.lp-list { display: grid; gap: 12px; padding: 0; list-style: none; margin: 0; }
@media (min-width: 768px) { .lp-list { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.lp-list li {
  padding: 16px; border-radius: var(--lp-radius);
  background: color-mix(in srgb, var(--lp-primary) 6%, var(--lp-bg));
  border: 1px solid color-mix(in srgb, var(--lp-text) 8%, transparent);
}
.lp-pricing { display: grid; gap: 16px; }
@media (min-width: 768px) { .lp-pricing { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.lp-price-card {
  padding: 24px; border-radius: var(--lp-radius); border: 1px solid color-mix(in srgb, var(--lp-text) 12%, transparent);
}
.lp-price-card.is-highlight { border-color: var(--lp-accent); box-shadow: 0 12px 40px color-mix(in srgb, var(--lp-accent) 25%, transparent); }
.lp-price-tier { font-weight: 600; margin: 0 0 16px; }
.lp-quote { padding: 20px; border-radius: var(--lp-radius); background: color-mix(in srgb, var(--lp-primary) 5%, var(--lp-bg)); margin-bottom: 12px; }
.lp-faq-item { border-bottom: 1px solid color-mix(in srgb, var(--lp-text) 10%, transparent); padding: 12px 0; }
.lp-faq-item summary { cursor: pointer; font-weight: 600; }
.lp-faq-item p { color: var(--lp-muted); margin: 8px 0 0; }
.lp-footer {
  padding: 56px 0; text-align: center;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--lp-primary) 8%, var(--lp-bg)));
}
.lp-footer h2 { margin: 0 0 16px; }
.lp-mockup img { width: 100%; height: auto; border-radius: var(--lp-radius); border: 1px solid color-mix(in srgb, var(--lp-text) 10%, transparent); }
.lp-mockup-inline { margin-top: 24px; }
.lp-note { font-size: 0.75rem; color: var(--lp-muted); margin-top: 16px; }`
}

export function buildSemanticLandingPageHtml(input: {
  session: HubStudioSession
  locale: WebLocale
  sections?: LandingPageSection[]
}): string {
  const { session, locale } = input
  const sections = input.sections ?? collectLandingPageSections(session, locale)
  const sectionByKey = new Map(sections.map((s) => [s.key, s]))
  const ui = UI[locale]
  const title = landingPageTitle(session)
  const theme = resolveLandingTheme(session.briefNotes)
  const logoUrl = session.landingPage?.logoUrl?.trim()
  const valueProp = session.briefNotes.value_prop?.trim() ?? ''
  const audience = session.briefNotes.target_audience?.trim() ?? ''

  const pageCopy = sectionCopy(session, 'landing_full')
  const heroHeadline = pageCopy.headline ?? title
  const heroSub = pageCopy.subheadline ?? valueProp
  const heroCta = pageCopy.cta ?? ui.ctaDefault

  const featureBullets =
    pageCopy.bullets.length > 0
      ? pageCopy.bullets
      : valueProp
        ? [valueProp]
        : []

  const fullMockup = mockupImg(sectionByKey.get('landing_full'), 'lp-mockup lp-mockup-full')

  const metaDescription = escapeHtml(valueProp || heroSub || title)

  const headerLogo = logoUrl
    ? `<img class="lp-logo" src="${escapeAttr(logoUrl)}" alt="${escapeAttr(title)}" />`
    : `<span class="lp-brand">${escapeHtml(title)}</span>`

  const parts: string[] = []

  parts.push(`<!DOCTYPE html>
<html lang="${LANG[locale]}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${metaDescription}" />
  <title>${escapeHtml(title)}</title>
  <style>${buildStyles(theme)}</style>
</head>
<body>
  <header class="lp-container lp-header">
    ${headerLogo}
  </header>

  <main>
    <section class="lp-container lp-hero" id="hero">
      <div>
        <h1>${escapeHtml(heroHeadline)}</h1>
        <p class="lp-lead">${escapeHtml(heroSub)}</p>
        ${audience ? `<p class="lp-lead">${escapeHtml(audience)}</p>` : ''}
        <a class="lp-btn lp-btn-primary" href="#contact">${escapeHtml(heroCta)}</a>
      </div>
    </section>`)

  if (featureBullets.length) {
    parts.push(`
    <section class="lp-section" id="features">
      <div class="lp-container">
        <h2>${escapeHtml(ui.featuresTitle)}</h2>
        ${bulletList(featureBullets)}
      </div>
    </section>`)
  }

  if (fullMockup) {
    parts.push(`
    <section class="lp-section" id="mockup">
      <div class="lp-container">
        <h2>${escapeHtml(title)}</h2>
        ${fullMockup}
      </div>
    </section>`)
  }

  parts.push(`
    <section class="lp-footer" id="contact">
      <div class="lp-container">
        <h2>${escapeHtml(ui.footerCta)}</h2>
        <a class="lp-btn lp-btn-primary" href="#">${escapeHtml(heroCta)}</a>
        <p class="lp-note">${escapeHtml(ui.footerNote)}</p>
      </div>
    </section>
  </main>
</body>
</html>`)

  return parts.join('')
}

export function isCompleteLandingHtml(html: string): boolean {
  const trimmed = html.trim()
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')
}

export function landingHtmlOrGenerate(input: {
  session: HubStudioSession
  locale: WebLocale
  htmlSource?: string | null
}): string {
  const saved = input.htmlSource?.trim()
  if (saved && isCompleteLandingHtml(saved)) return saved
  return buildSemanticLandingPageHtml({ session: input.session, locale: input.locale })
}
