import { escapeAttr, escapeHtml, downloadBlobFile } from '@/lib/packaging/mockup-share-html'
import type { LandingPageSection } from '@/lib/hub-chat/landing-page-sections'

function sectionBlock(section: LandingPageSection): string {
  const isMobile = section.formFactor === 'mobile'
  const img = `<img src="${escapeAttr(section.url)}" alt="${escapeAttr(section.label)}" loading="lazy" crossorigin="anonymous" />`
  if (isMobile) {
    return `<section class="section section-mobile" aria-label="${escapeAttr(section.label)}">
  <p class="section-label">${escapeHtml(section.label)}</p>
  <div class="phone-frame">${img}</div>
</section>`
  }
  return `<section class="section section-desktop" aria-label="${escapeAttr(section.label)}">
  <p class="section-label">${escapeHtml(section.label)}</p>
  <div class="section-img">${img}</div>
</section>`
}

export function buildStandaloneLandingPageHtml(input: {
  title: string
  sections: LandingPageSection[]
  logoUrl?: string | null
}): string {
  const { title, sections, logoUrl } = input
  const logoBlock = logoUrl?.trim()
    ? `<header class="site-header"><img class="site-logo" src="${escapeAttr(logoUrl.trim())}" alt="" /></header>`
    : ''
  const body = sections.map(sectionBlock).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #0f172a; color: #e2e8f0; }
    .page { max-width: 1200px; margin: 0 auto; padding: 24px 16px 48px; }
    .site-header { text-align: center; padding: 12px 0 20px; }
    .site-logo { max-height: 48px; max-width: 180px; object-fit: contain; }
    h1 { font-size: 1.25rem; font-weight: 600; text-align: center; margin: 0 0 24px; color: #f8fafc; }
    .section { margin-bottom: 28px; }
    .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin: 0 0 8px; text-align: center; }
    .section-img img { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.2); }
    .section-mobile { display: flex; flex-direction: column; align-items: center; }
    .phone-frame {
      width: min(100%, 390px); border-radius: 28px; overflow: hidden;
      border: 3px solid #334155; background: #1e293b; box-shadow: 0 20px 40px rgba(0,0,0,0.35);
    }
    .phone-frame img { display: block; width: 100%; height: auto; }
    .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="page">
    ${logoBlock}
    <h1>${escapeHtml(title)}</h1>
    ${body}
    <p class="footer">Landing page preview — full mockup image.</p>
  </div>
</body>
</html>`
}

export function downloadStandaloneLandingPageHtml(input: {
  title: string
  sections: LandingPageSection[]
  logoUrl?: string | null
  filename: string
}): void {
  const html = buildStandaloneLandingPageHtml(input)
  downloadBlobFile(new Blob([html], { type: 'text/html;charset=utf-8' }), input.filename)
}
