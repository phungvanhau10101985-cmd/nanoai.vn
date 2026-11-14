/**
 * Việc nền shop chạy ngoài process Next (:3000) để RSS web không chạm trần 2200 MiB.
 * PM2: nanoai-shop-cron. HTTP /api/cron/* vẫn gọi được tay.
 */
import { config } from 'dotenv'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env')
const localPath = resolve(cwd, '.env.local')
if (existsSync(envPath)) config({ path: envPath })
if (existsSync(localPath)) config({ path: localPath, override: true })
process.env.NANOAI_SHOP_CRON_WORKER = '1'
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\r/g, '').trim()
}

const FAST_MS = 5_000
const MINUTE_MS = 60_000
const SLOT_PATH = resolve(tmpdir(), 'nanoai-shop-cron-slots.json')

type VnNow = { key: string; hour: number; minute: number }

function vnNow(date = new Date()): VnNow {
  const bag: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)) {
    bag[part.type] = part.value
  }
  let hour = Number(bag.hour)
  if (hour === 24) hour = 0
  return {
    key: `${bag.year}-${bag.month}-${bag.day}`,
    hour,
    minute: Number(bag.minute),
  }
}

function loadSlots(): Set<string> {
  try {
    const parsed = JSON.parse(readFileSync(SLOT_PATH, 'utf8')) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item) => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

const fired = loadSlots()

function claimSlot(id: string, hour: number, minute: number, now: VnNow): boolean {
  if (now.hour !== hour || now.minute !== minute) return false
  const slot = `${id}:${now.key}:${hour}:${minute}`
  if (fired.has(slot)) return false
  for (const key of [...fired]) {
    if (!key.includes(`:${now.key}:`)) fired.delete(key)
  }
  fired.add(slot)
  try {
    writeFileSync(SLOT_PATH, JSON.stringify([...fired]))
  } catch (e) {
    console.warn('[shop-cron] slot file', e instanceof Error ? e.message : e)
  }
  return true
}

function summarize(value: unknown): string {
  try {
    const text = JSON.stringify(value)
    return text.length > 400 ? `${text.slice(0, 400)}…` : text
  } catch {
    return ''
  }
}

async function step(name: string, fn: () => Promise<unknown>, logOk = true): Promise<unknown> {
  const started = Date.now()
  try {
    const result = await fn()
    if (logOk) console.log(`[shop-cron] ${name} ${Date.now() - started}ms ${summarize(result)}`)
    return result
  } catch (e) {
    console.error(`[shop-cron] ${name} failed`, e instanceof Error ? e.message : e)
    return null
  }
}

function resumedCount(value: unknown): number {
  if (!value || typeof value !== 'object' || !('resumed' in value)) return 0
  const n = Number((value as { resumed?: unknown }).resumed)
  return Number.isFinite(n) ? n : 0
}

let fastBusy = false
async function fastTick(): Promise<void> {
  if (fastBusy) return
  fastBusy = true
  try {
    const jobs = await import('../src/lib/cron/nanoai-shop-cron-jobs')
    const image = await step('image-localization-resume', () => jobs.runImageLocalizationResumeCron(), false)
    const listing = await step('listing-import-resume', () => jobs.runListingImportResumeCron(), false)
    if (resumedCount(image) > 0) console.log(`[shop-cron] image-localization-resume ${summarize(image)}`)
    if (resumedCount(listing) > 0) console.log(`[shop-cron] listing-import-resume ${summarize(listing)}`)
  } finally {
    fastBusy = false
  }
}

let minuteBusy = false
async function minuteTick(): Promise<void> {
  if (minuteBusy) return
  minuteBusy = true
  try {
    const jobs = await import('../src/lib/cron/nanoai-shop-cron-jobs')
    const now = vnNow()
    await step('source-stock-check', () => jobs.runSourceStockResumeCron(), false)
    await step('messaging-partner-ai', () => jobs.runPartnerAiCron())
    await step('partner-bunny-cdn-provision', () => jobs.runBunnyCdnProvisionCron())
    await step('partner-outfit-picks', () => jobs.runOutfitPicksCron())
    await step('partner-ladipage-on-view', () => jobs.runLadipageOnViewCron())
    await step('partner-marketing-campaign', () => jobs.runMarketingCampaignCron())
    await step('partner-customer-notifications', () => jobs.runCustomerNotificationCron())
    if (now.minute % 3 === 0) await step('partner-custom-domain-ssl', () => jobs.runCustomDomainSslCron())
    if (now.minute % 5 === 0) await step('partner-inventory-bunny-delete', () => jobs.runBunnyDeleteCron())
    if (now.minute % 10 === 5 && !(now.hour === 2 && now.minute === 25)) {
      await step('partner-marketing-banners-catchup', () => jobs.runMarketingBannersCron(1))
    }
    if (now.minute % 15 === 0) await step('partner-order-shipment-timeline', () => jobs.runOrderShipmentCron())
  } finally {
    minuteBusy = false
  }
}

async function clockTick(): Promise<void> {
  const jobs = await import('../src/lib/cron/nanoai-shop-cron-jobs')
  const now = vnNow()
  if (now.minute === 0 && now.hour % 6 === 0 && claimSlot('partner-review-reminders', now.hour, 0, now)) {
    void step('partner-review-reminders', () => jobs.runReviewReminderCron())
  }
  if (claimSlot('partner-marketing-banners', 2, 25, now)) {
    void step('partner-marketing-banners', () => jobs.runMarketingBannersCron())
  }
  if (claimSlot('messaging-inventory-embed-backfill', 3, 20, now)) {
    void step('messaging-inventory-embed-backfill', () => jobs.runInventoryEmbedCron())
  }
  if (claimSlot('messaging-logo-cleanup', 3, 30, now)) {
    void step('messaging-logo-cleanup', () => jobs.runLogoCleanupCron())
  }
  if (claimSlot('wedding-reminder', 8, 0, now)) {
    void step('wedding-reminder', () => jobs.runWeddingReminderCron())
  }
  if (claimSlot('homework-unsolved-digest', 8, 30, now)) {
    void step('homework-unsolved-digest', () => jobs.runHomeworkDigestCron())
  }
  if (claimSlot('partner-email-daily', 9, 0, now)) {
    void step('partner-email-daily', () => jobs.runEmailDailyCron())
  }
}

async function main(): Promise<void> {
  console.log('[shop-cron] start', new Date().toISOString())
  await fastTick()
  await minuteTick()
  await clockTick()
  setInterval(() => void fastTick(), FAST_MS)
  setInterval(() => void minuteTick(), MINUTE_MS)
  setInterval(() => void clockTick(), MINUTE_MS)
}

main().catch((e) => {
  console.error('[shop-cron] fatal', e)
  process.exit(1)
})
