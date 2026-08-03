import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  fetchPartnerCustomDomainsNeedingSslPg,
  updatePartnerCustomDomainVerificationPg,
} from '@/lib/db/messaging-partner-custom-domains-pg'
import { verifyPartnerCustomDomainCname, probePartnerCustomDomainSsl } from '@/lib/messaging/partner-custom-domain-dns'
import { isPgConfigured } from '@/lib/db/pool'

const execFileAsync = promisify(execFile)

export type PartnerCustomDomainSslWorkerResult = {
  scanned: number
  provisionAttempted: number
  provisionOk: number
  sslActive: number
  stillPending: number
  errors: string[]
}

function provisionScriptPath(): string | null {
  const fromEnv = process.env.PARTNER_DOMAIN_SSL_PROVISION_SCRIPT?.trim()
  if (fromEnv) return fromEnv
  return process.env.PARTNER_DOMAIN_SSL_AUTO_PROVISION === '1'
    ? 'deploy/provision-partner-domain-ssl.sh'
    : null
}

async function runProvisionScript(hostname: string): Promise<{ ok: boolean; detail: string }> {
  const script = provisionScriptPath()
  if (!script) {
    return { ok: false, detail: 'PARTNER_DOMAIN_SSL_AUTO_PROVISION not enabled' }
  }
  const useSudo = process.env.PARTNER_DOMAIN_SSL_USE_SUDO === '1'
  const cmd = useSudo ? 'sudo' : 'bash'
  const args = useSudo ? ['-n', 'bash', script, hostname] : [script, hostname]
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      timeout: 300_000,
      maxBuffer: 2 * 1024 * 1024,
    })
    const detail = [stdout, stderr].filter(Boolean).join('\n').trim()
    return { ok: true, detail: detail || 'provision script ok' }
  } catch (e) {
    const err = e as { message?: string; stdout?: string; stderr?: string; code?: number }
    const detail = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n').trim()
    return { ok: false, detail: detail || `provision exit ${err.code ?? '?'}` }
  }
}

/** Cron/worker: DNS đã OK → (tuỳ chọn) chạy script cấp SSL trên VPS → probe HTTPS → cập nhật DB. */
export async function runPartnerCustomDomainSslWorker(limit = 10): Promise<PartnerCustomDomainSslWorkerResult> {
  const result: PartnerCustomDomainSslWorkerResult = {
    scanned: 0,
    provisionAttempted: 0,
    provisionOk: 0,
    sslActive: 0,
    stillPending: 0,
    errors: [],
  }

  if (!isPgConfigured()) {
    result.errors.push('DATABASE_URL not configured')
    return result
  }

  const rows = await fetchPartnerCustomDomainsNeedingSslPg(limit)
  result.scanned = rows.length

  for (const row of rows) {
    const host = row.hostname.trim().toLowerCase()
    if (!host) continue

    const cname = await verifyPartnerCustomDomainCname(host)
    if (!cname.ok) {
      await updatePartnerCustomDomainVerificationPg({
        partnerId: row.partner_id,
        dnsVerified: false,
        sslStatus: 'pending',
        sslLastError: cname.detail,
      })
      result.stillPending += 1
      continue
    }

    let ssl = await probePartnerCustomDomainSsl(host)
    if (!ssl.ok && provisionScriptPath()) {
      result.provisionAttempted += 1
      const prov = await runProvisionScript(host)
      if (prov.ok) {
        result.provisionOk += 1
        ssl = await probePartnerCustomDomainSsl(host)
      } else {
        result.errors.push(`${host}: ${prov.detail.slice(0, 500)}`)
      }
    }

    const sslStatus = ssl.ok ? 'ssl_active' : 'dns_ok'
    await updatePartnerCustomDomainVerificationPg({
      partnerId: row.partner_id,
      dnsVerified: true,
      sslStatus,
      sslLastError: ssl.ok ? null : ssl.detail,
    })

    if (ssl.ok) result.sslActive += 1
    else result.stillPending += 1
  }

  return result
}
