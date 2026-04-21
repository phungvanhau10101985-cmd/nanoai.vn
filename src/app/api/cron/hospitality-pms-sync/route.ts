import { NextResponse } from 'next/server'
import {
  fetchPendingHospitalityPmsSyncJobsPg,
  updateHospitalityPmsSyncJobStatusPg,
} from '@/lib/db/hospitality-pg'
import { resolvePmsConnector } from '@/lib/hospitality/pms-connector'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function isCronAuthorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const auth = req.headers.get('authorization') || ''
  return auth === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const jobs = await fetchPendingHospitalityPmsSyncJobsPg(50)
  let done = 0
  let failed = 0
  for (const job of jobs) {
    await updateHospitalityPmsSyncJobStatusPg({ id: job.id, status: 'processing' })
    try {
      const connector = resolvePmsConnector(job.connector_key)
      const ok =
        job.direction === 'push'
          ? await connector.push(job.partner_id, {
              entity_type: (job.entity_type as 'room' | 'rate' | 'booking' | 'payment') ?? 'booking',
              entity_id: job.entity_id ?? '',
              payload: job.payload,
            })
          : await connector.pull(job.partner_id, (job.entity_type as 'room' | 'rate' | 'booking' | 'payment') ?? 'booking')
      if (!ok) {
        await updateHospitalityPmsSyncJobStatusPg({
          id: job.id,
          status: 'failed',
          last_error: 'Connector returned false',
          bump_attempt: true,
        })
        failed += 1
      } else {
        await updateHospitalityPmsSyncJobStatusPg({ id: job.id, status: 'done' })
        done += 1
      }
    } catch (e) {
      await updateHospitalityPmsSyncJobStatusPg({
        id: job.id,
        status: 'failed',
        last_error: e instanceof Error ? e.message : 'Unknown',
        bump_attempt: true,
      })
      failed += 1
    }
  }
  return NextResponse.json({ ok: true, total: jobs.length, done, failed })
}
