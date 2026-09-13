import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import { isVietnamProvinceName, matchVietnamProvince } from '@/lib/partner-website/shop/vietnam-provinces'

function money(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

export async function fetchPartnerShippingProvinceFeesFromPg(
  partnerId: string
): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  const pid = String(partnerId || '').trim()
  if (!isPgConfigured() || !pid) return out
  try {
    const rows = await pgQuery<{ province: string; fee_amount: string | number }>(
      `select province, fee_amount
         from public.messaging_partner_shipping_province_fees
        where partner_id = $1::uuid`,
      [pid]
    )
    for (const row of rows) {
      const province = matchVietnamProvince(row.province)
      if (!province) continue
      out[province] = money(row.fee_amount)
    }
  } catch (e) {
    console.warn('[fetchPartnerShippingProvinceFeesFromPg]', e)
  }
  return out
}

export async function replacePartnerShippingProvinceFeesFromPg(input: {
  partnerId: string
  rates: Array<{ province: string; feeAmount: number }>
}): Promise<Record<string, number>> {
  const pid = String(input.partnerId || '').trim()
  if (!isPgConfigured() || !pid) return {}
  const next: Record<string, number> = {}
  for (const row of input.rates) {
    const province = isVietnamProvinceName(String(row.province || '').trim())
      ? String(row.province).trim()
      : matchVietnamProvince(row.province)
    if (!province) continue
    next[province] = money(row.feeAmount)
  }
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    await client.query(
      `delete from public.messaging_partner_shipping_province_fees where partner_id = $1::uuid`,
      [pid]
    )
    const entries = Object.entries(next)
    if (entries.length > 0) {
      const values: string[] = []
      const params: unknown[] = [pid]
      let i = 2
      for (const [province, fee] of entries) {
        values.push(`($1::uuid, $${i}::text, $${i + 1}::numeric)`)
        params.push(province, fee)
        i += 2
      }
      await client.query(
        `insert into public.messaging_partner_shipping_province_fees
           (partner_id, province, fee_amount)
         values ${values.join(', ')}`,
        params
      )
    }
    await client.query('commit')
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    client.release()
  }
  return next
}
