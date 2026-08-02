import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

/** System pages shipped with every shop — not shown in create-page picker. */
export const PARTNER_WEBSITE_SYSTEM_404_PATH = '404.html'

type Copy = {
  title: string
  heading: string
  body: string
  homeCta: string
  codeLabel: string
}

function copyForLocale(locale: WebLocale): Copy {
  if (locale === 'en') {
    return {
      title: 'Page not found',
      heading: 'Page not found',
      body: 'The page you opened does not exist or has been moved.',
      homeCta: 'Back to home',
      codeLabel: '404',
    }
  }
  if (locale === 'zh') {
    return {
      title: '页面未找到',
      heading: '页面未找到',
      body: '您访问的页面不存在或已被移动。',
      homeCta: '返回首页',
      codeLabel: '404',
    }
  }
  if (locale === 'ja') {
    return {
      title: 'ページが見つかりません',
      heading: 'ページが見つかりません',
      body: 'お探しのページは存在しないか、移動されました。',
      homeCta: 'ホームへ戻る',
      codeLabel: '404',
    }
  }
  if (locale === 'ko') {
    return {
      title: '페이지를 찾을 수 없음',
      heading: '페이지를 찾을 수 없습니다',
      body: '요청하신 페이지가 없거나 이동되었습니다.',
      homeCta: '홈으로',
      codeLabel: '404',
    }
  }
  return {
    title: 'Không tìm thấy trang',
    heading: 'Không tìm thấy trang',
    body: 'Trang bạn mở không tồn tại hoặc đã được chuyển đi.',
    homeCta: 'Về trang chủ',
    codeLabel: '404',
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildDefaultPartnerWebsite404Html(input: {
  shopTitle: string
  locale: WebLocale
  homeHref?: string
}): string {
  const c = copyForLocale(input.locale)
  const shop = escapeHtml(input.shopTitle.trim() || 'Shop')
  const homeHref = escapeHtml(input.homeHref?.trim() || '/')
  return `<!DOCTYPE html>
<html lang="${escapeHtml(input.locale)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${escapeHtml(c.title)} · ${shop}</title>
  <style>
    :root {
      --bg: #f7f4ef;
      --ink: #1c1917;
      --muted: #78716c;
      --line: #e7e5e4;
      --accent: #0f766e;
      --accent-ink: #f0fdfa;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(900px 420px at 10% -10%, rgba(15,118,110,.12), transparent 55%),
        radial-gradient(700px 360px at 100% 0%, rgba(180,83,9,.08), transparent 50%),
        var(--bg);
    }
    .card {
      width: min(440px, 100%);
      text-align: center;
      padding: 36px 28px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: rgba(255,255,255,.82);
      backdrop-filter: blur(8px);
      box-shadow: 0 16px 40px rgba(28,25,23,.06);
    }
    .code {
      display: inline-block;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .14em;
      color: var(--accent);
      margin-bottom: 12px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(1.35rem, 2.4vw, 1.7rem);
      line-height: 1.25;
      font-weight: 700;
    }
    p {
      margin: 0 0 22px;
      color: var(--muted);
      font-size: 0.98rem;
      line-height: 1.55;
    }
    .shop {
      margin: 0 0 18px;
      font-size: 0.85rem;
      color: var(--muted);
    }
    a.cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      background: var(--accent);
      color: var(--accent-ink);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
    }
    a.cta:hover { filter: brightness(1.05); }
  </style>
</head>
<body>
  <main class="card">
    <div class="code">${escapeHtml(c.codeLabel)}</div>
    <h1>${escapeHtml(c.heading)}</h1>
    <p>${escapeHtml(c.body)}</p>
    <p class="shop">${shop}</p>
    <a class="cta" href="${homeHref}">${escapeHtml(c.homeCta)}</a>
  </main>
</body>
</html>`
}

export function getPartnerWebsite404HtmlFromProject(
  project: PartnerWebsiteProject | null | undefined,
  opts: { shopTitle: string; locale: WebLocale; homeHref?: string }
): string {
  const existing = project?.files.find((f) => f.path === PARTNER_WEBSITE_SYSTEM_404_PATH)?.content?.trim()
  if (existing) return existing
  return buildDefaultPartnerWebsite404Html(opts)
}

/** Inject default system pages (404) if missing. Does not overwrite custom 404.html. */
export function ensurePartnerWebsiteSystemPages(
  project: PartnerWebsiteProject,
  opts: { shopTitle: string; locale: WebLocale; homeHref?: string }
): PartnerWebsiteProject {
  const has404 = project.files.some(
    (f) => f.path === PARTNER_WEBSITE_SYSTEM_404_PATH && f.content.trim().length > 0
  )
  if (has404) return project
  return {
    ...project,
    files: [
      ...project.files,
      {
        path: PARTNER_WEBSITE_SYSTEM_404_PATH,
        kind: 'html',
        content: buildDefaultPartnerWebsite404Html(opts),
      },
    ],
  }
}
