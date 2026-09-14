import type { Browser, BrowserContext, Page } from 'playwright'
import { seedPlaywrightContextCookies, tryPandamallPlaywrightAutoLogin } from './listing-import-cookies'
import { IMPORT_USER_AGENT } from './scrape-common'

export class ListingImportPlaywrightError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ListingImportPlaywrightError'
  }
}

const PANDAMALL_SCROLL_VARIATION_PANELS_JS = `() => {
  document.querySelectorAll(".variation-values.ver-swipe, .variation-values").forEach((panel) => {
    try {
      const step = Math.max(80, Math.floor((panel.scrollHeight || 0) / 4));
      for (let y = 0; y <= (panel.scrollHeight || 0) + step; y += step) {
        panel.scrollTop = y;
      }
      panel.scrollTop = panel.scrollHeight || 0;
    } catch (_) {}
  });
}`

/**
 * Python Playwright auto-invokes a function expression (`() => { ... }`).
 * Node Playwright evaluates the string as an expression and cannot serialize a Function,
 * so the scrape JS must be invoked: `(() => { ... })()`.
 */
export function listingImportScrapeEvaluateExpression(scrapeJs: string): string {
  const trimmed = String(scrapeJs || '').trim()
  if (!trimmed) return trimmed
  if (/^\(\s*\)\s*=>/.test(trimmed) || /^function\b/.test(trimmed)) {
    return `(${trimmed})()`
  }
  return trimmed
}

export function isListingImportScrapeDict(raw: unknown): raw is Record<string, unknown> {
  return Boolean(raw) && typeof raw === 'object' && !Array.isArray(raw)
}

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    throw new ListingImportPlaywrightError(
      'Thiếu Playwright để cào dữ liệu. Cài `playwright` rồi chạy `npx playwright install chromium`.'
    )
  }
}

async function clickExactText(page: Page, text: string, timeoutMs = 2500): Promise<boolean> {
  try {
    const loc = page.locator(`text=${text}`).first()
    if ((await loc.count()) > 0) {
      await loc.click({ timeout: timeoutMs })
      return true
    }
  } catch {
    /* fallback evaluate */
  }
  try {
    return Boolean(
      await page.evaluate((needle) => {
        const n = String(needle || '').trim()
        const els = [...document.querySelectorAll('button, span, div, a')]
        const el = els.find((x) => ((x as HTMLElement).innerText || x.textContent || '').trim() === n)
        if (el) {
          ;(el as HTMLElement).click()
          return true
        }
        return false
      }, text)
    )
  } catch {
    return false
  }
}

/** Khớp `_scrape_vipomall_for_import_sync`: Xem thêm → Xem thêm chi tiết. */
export async function expandVipomallDetailOnPage(page: Page): Promise<void> {
  await clickExactText(page, 'Xem thêm')
  await page.waitForTimeout(1200)
  await clickExactText(page, 'Xem thêm chi tiết')
  await page.waitForTimeout(1500)
}

/** Khớp `_scroll_pandamall_variation_panels` + `_click_expand_button`. */
export async function expandPandamallDetailOnPage(page: Page): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    try {
      await page.keyboard.press('PageDown')
    } catch {
      /* ignore */
    }
    await page.waitForTimeout(500)
  }
  try {
    await page.evaluate(listingImportScrapeEvaluateExpression(PANDAMALL_SCROLL_VARIATION_PANELS_JS))
    await page.waitForTimeout(800)
    await page.evaluate(listingImportScrapeEvaluateExpression(PANDAMALL_SCROLL_VARIATION_PANELS_JS))
    await page.waitForTimeout(500)
  } catch {
    /* ignore */
  }
  let expanded = false
  try {
    expanded = Boolean(
      await page.evaluate(() => {
        const els = [...document.querySelectorAll('button, span, div, a')]
        let el = els.find((x) => ((x as HTMLElement).innerText || x.textContent || '').trim() === 'Hiển thị đầy đủ mô tả')
        if (!el) {
          const expandDiv = document.querySelector('.item-description_expand, .expand-btn')
          if (expandDiv) el = expandDiv.querySelector('button, span') || expandDiv
        }
        if (el) {
          ;(el as HTMLElement).click()
          return true
        }
        return false
      })
    )
  } catch {
    expanded = false
  }
  await page.waitForTimeout(expanded ? 3000 : 1500)
}

export async function withListingImportPage(
  pageUrl: string,
  scrapeJs: string,
  opts?: {
    partnerId?: string | null
    preferHosts?: string[]
    pandamallLogin?: boolean
    afterIdle?: (page: Page) => Promise<void>
    scrollDetailModal?: boolean
  }
): Promise<Record<string, unknown>> {
  const { chromium } = await loadPlaywright()
  const headless = String(process.env.SOURCE_STOCK_CHECK_HEADLESS ?? 'true').toLowerCase() !== 'false'
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null
  let raw: unknown
  try {
    browser = await chromium.launch({
      headless,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
    context = await browser.newContext({
      viewport: { width: 1366, height: 1000 },
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      userAgent: process.env.IMPORT_1688_USER_AGENT || IMPORT_USER_AGENT,
    })
    page = await context.newPage()
    try {
      await seedPlaywrightContextCookies({
        context,
        page,
        partnerId: opts?.partnerId,
        preferHosts: opts?.preferHosts,
        targetUrl: pageUrl,
      })
    } catch (e) {
      console.warn('[listing-import] seed cookies', e instanceof Error ? e.message : e)
    }
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    try {
      await page.waitForLoadState('networkidle', { timeout: 35_000 })
    } catch {
      /* SPA có thể không idle */
    }
    if (opts?.pandamallLogin) {
      await tryPandamallPlaywrightAutoLogin(page, pageUrl, opts?.partnerId)
    }
    await page.waitForTimeout(2500)
    for (const y of [500, 1200, 2200, 3600]) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y)
      await page.waitForTimeout(650)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(600)
    if (opts?.afterIdle) {
      await opts.afterIdle(page)
    } else {
      await expandVipomallDetailOnPage(page)
    }
    for (const y of [800, 1800, 3200, 5200, 7600]) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y)
      await page.waitForTimeout(600)
    }
    if (opts?.scrollDetailModal !== false) {
      try {
        await page.locator('.modal.show, [role="dialog"]').first().evaluate((el) => {
          try {
            ;(el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight
          } catch {
            /* ignore */
          }
        })
        await page.waitForTimeout(700)
      } catch {
        /* no modal */
      }
    }
    raw = await page.evaluate(listingImportScrapeEvaluateExpression(scrapeJs))
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    if (/Executable doesn't exist|playwright install/i.test(detail)) {
      throw new ListingImportPlaywrightError(
        `${detail} — Cài Chromium: npx playwright install chromium`
      )
    }
    throw new ListingImportPlaywrightError(`Lỗi Playwright: ${detail}`)
  } finally {
    try {
      await page?.close()
    } catch {
      /* ignore */
    }
    try {
      await context?.close()
    } catch {
      /* ignore */
    }
    try {
      await browser?.close()
    } catch {
      /* ignore */
    }
  }
  if (!isListingImportScrapeDict(raw)) {
    throw new ListingImportPlaywrightError('Scraper trả về dữ liệu không hợp lệ.')
  }
  return raw
}
