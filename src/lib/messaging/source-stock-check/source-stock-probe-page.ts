import type { Browser, BrowserContext, Page } from 'playwright'
import { seedPlaywrightContextCookies, tryPandamallPlaywrightAutoLogin } from '@/lib/messaging/listing-import/listing-import-cookies'
import { ListingImportPlaywrightError } from '@/lib/messaging/listing-import/playwright-browser'
import { IMPORT_USER_AGENT } from '@/lib/messaging/listing-import/scrape-common'
import { sourceStockCheckHeadless, sourceStockCheckPlaywrightTimeoutMs } from './source-stock-config'

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    throw new ListingImportPlaywrightError(
      'Thiếu Playwright để kiểm tra nguồn. Cài `playwright` rồi chạy `npx playwright install chromium`.'
    )
  }
}

export type SourceStockProbeSnap = {
  blocked?: boolean
  login?: boolean
  ctaFound?: boolean
  addToCartFound?: boolean
  looksLikePdp?: boolean
  title?: string
  href?: string
}

export async function withSourceStockProbePage(opts: {
  pageUrl: string
  partnerId?: string | null
  preferHosts?: string[]
  locale?: string
  timezoneId?: string
  clickAcceptRisks?: boolean
  waitLocator?: string
  waitText?: string
  pandamallLogin?: boolean
  probeJs: string
}): Promise<{ snap: SourceStockProbeSnap; html: string; title: string; href: string }> {
  const { chromium } = await loadPlaywright()
  const timeoutMs = sourceStockCheckPlaywrightTimeoutMs()
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null
  try {
    browser = await chromium.launch({
      headless: sourceStockCheckHeadless(),
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
    context = await browser.newContext({
      viewport: { width: 1366, height: 1000 },
      locale: opts.locale || 'vi-VN',
      timezoneId: opts.timezoneId || 'Asia/Ho_Chi_Minh',
      userAgent: process.env.IMPORT_1688_USER_AGENT || IMPORT_USER_AGENT,
    })
    page = await context.newPage()
    try {
      await seedPlaywrightContextCookies({
        context,
        page,
        partnerId: opts.partnerId,
        preferHosts: opts.preferHosts,
        targetUrl: opts.pageUrl,
      })
    } catch (e) {
      console.warn('[source-stock] seed cookies', e instanceof Error ? e.message : e)
    }
    await page.goto(opts.pageUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    try {
      await page.waitForLoadState('networkidle', { timeout: Math.min(20_000, timeoutMs) })
    } catch {
      /* SPA */
    }
    await page.waitForTimeout(1_800)
    if (opts.clickAcceptRisks) {
      await clickCssbuyAcceptRisks(page)
      await page.waitForTimeout(1_200)
      await clickCssbuyAcceptRisks(page)
      await page.waitForTimeout(800)
    }
    if (opts.pandamallLogin) {
      try {
        await tryPandamallPlaywrightAutoLogin(page, opts.pageUrl, opts.partnerId)
        await page.waitForTimeout(1_200)
      } catch {
        /* ignore */
      }
    }
    if (opts.waitLocator) {
      try {
        await page.locator(opts.waitLocator).first().waitFor({
          state: 'visible',
          timeout: Math.min(18_000, timeoutMs),
        })
      } catch {
        if (opts.waitText) {
          try {
            await page.getByText(opts.waitText, { exact: false }).first().waitFor({ timeout: 4_000 })
          } catch {
            /* ignore */
          }
        }
      }
    }
    await page.waitForTimeout(400)
    const snap = (await page.evaluate(opts.probeJs)) as SourceStockProbeSnap
    const html = (await page.content()) || ''
    let title = ''
    try {
      title = (await page.title()) || ''
    } catch {
      title = ''
    }
    const href = page.url() || opts.pageUrl
    return { snap: snap && typeof snap === 'object' ? snap : {}, html, title, href }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    if (/Executable doesn't exist|playwright install/i.test(detail)) {
      throw new ListingImportPlaywrightError(`${detail} — Cài Chromium: npx playwright install chromium`)
    }
    throw e
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

async function clickCssbuyAcceptRisks(page: Page): Promise<boolean> {
  try {
    const loc = page.getByText('I accept the risks', { exact: false })
    if ((await loc.count()) > 0) {
      await loc.first().click({ timeout: 4_000 })
      return true
    }
  } catch {
    /* ignore */
  }
  try {
    return Boolean(
      await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('div,button,a,span,p')).find((n) => {
          const t = ((n as HTMLElement).innerText || '').trim()
          return /^i accept the risks$/i.test(t)
        })
        if (!el) return false
        ;(el as HTMLElement).click()
        return true
      })
    )
  } catch {
    return false
  }
}
