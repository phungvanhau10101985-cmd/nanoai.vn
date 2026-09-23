import { bootstrapSingleProductLandingForStudio } from '@/lib/partner-website/product-studio/product-studio-ladipage-bridge'
import {
  claimLadipageOnViewJobsPg,
  enqueueLadipageOnViewJobPg,
  fetchActiveInventoryNamePg,
  finishLadipageOnViewJobPg,
  partnerHasSingleProductLandingPg,
} from '@/lib/db/messaging-partner-ladipage-on-view-pg'

/** Fire-and-forget from view_product. Never throws. */
export async function enqueueLadipageOnView(input: {
  partnerId: string
  inventoryId: string
}): Promise<void> {
  try {
    await enqueueLadipageOnViewJobPg(input)
  } catch (e) {
    console.warn('[ladipage-on-view] enqueue', e)
  }
}

export async function runLadipageOnViewBatch(limit: number): Promise<{
  claimed: number
  done: number
  skipped: number
  failed: number
}> {
  const jobs = await claimLadipageOnViewJobsPg(limit)
  let done = 0
  let skipped = 0
  let failed = 0
  for (const job of jobs) {
    try {
      const name = await fetchActiveInventoryNamePg(job.partnerId, job.inventoryId)
      if (!name) {
        await finishLadipageOnViewJobPg({ id: job.id, status: 'skipped', lastError: 'inactive' })
        skipped += 1
        continue
      }
      if (await partnerHasSingleProductLandingPg(job.partnerId, job.inventoryId)) {
        await finishLadipageOnViewJobPg({ id: job.id, status: 'done', lastError: 'landing exists' })
        done += 1
        continue
      }
      const result = await bootstrapSingleProductLandingForStudio(job.partnerId, job.inventoryId, name)
      if (!result) {
        await finishLadipageOnViewJobPg({ id: job.id, status: 'skipped', lastError: 'no website' })
        skipped += 1
        continue
      }
      await finishLadipageOnViewJobPg({
        id: job.id,
        status: 'done',
        lastError: result.warnings.length ? result.warnings.join('; ') : null,
      })
      done += 1
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const retry = job.attempts < 3
      await finishLadipageOnViewJobPg({
        id: job.id,
        status: retry ? 'pending' : 'error',
        lastError: message,
      }).catch(() => undefined)
      failed += 1
      console.warn('[ladipage-on-view] job', job.inventoryId, message)
    }
  }
  return { claimed: jobs.length, done, skipped, failed }
}
