import type { Browser, BrowserContext, Page } from 'playwright'
import { seedPlaywrightContextCookies, tryPandamallPlaywrightAutoLogin } from './listing-import-cookies'
import { IMPORT_USER_AGENT } from './scrape-common'

export class ListingImportPlaywrightError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ListingImportPlaywrightError'
  }
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

export async function withListingImportPage(
  pageUrl: string,
  scrapeJs: string,
  clickTexts: string[],
  opts?: {
    partnerId?: string | null
    preferHosts?: string[]
    pandamallLogin?: boolean
  }
): Promise<Record<string, unknown>> {
  const { chromium } = await loadPlaywright()
  const headless = String(process.env.SOURCE_STOCK_CHECK_HEADLESS ?? 'true').toLowerCase() !== 'false'
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null
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
    for (const text of clickTexts) {
      try {
        const loc = page.locator(`text=${text}`).first()
        if ((await loc.count()) > 0) await loc.click({ timeout: 2500 })
      } catch {
        try {
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
        } catch {
          /* ignore */
        }
      }
      await page.waitForTimeout(1200)
    }
    for (const y of [800, 1800, 3200, 5200, 7600]) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y)
      await page.waitForTimeout(600)
    }
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
    const raw = (await page.evaluate(scrapeJs)) as unknown
    if (!raw || typeof raw !== 'object') {
      throw new ListingImportPlaywrightError('Scraper trả về dữ liệu không hợp lệ.')
    }
    return raw as Record<string, unknown>
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
}
