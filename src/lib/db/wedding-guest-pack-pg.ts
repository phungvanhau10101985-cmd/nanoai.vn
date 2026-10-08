import { randomBytes } from 'crypto'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { listActivePaymentConfigs } from '@/lib/db/payments-repo'
import { buildSePayQrImgUrl } from '@/lib/sepay-qr'
import { notifyWeddingGuestPackPurchased } from '@/lib/wedding/wedding-card-retention-notify'
import {
  buildWeddingGuestSideQuotas,
  parseWeddingGuestPackId,
  weddingGuestCap,
  weddingGuestPackById,
  weddingGuestPackListPriceVnd,
  weddingGuestPackRank,
  weddingGuestPackSideLabel,
  weddingGuestPackUpgradeVnd,
  type WeddingGuestPackId,
  type WeddingGuestPackSide,
  type WeddingGuestSideQuotas,
} from '@/lib/wedding/wedding-guest-pack'

export type WeddingGuestPackPaymentRow = {
  id: string
  userId: string
  cardId: string
  packId: WeddingGuestPackId
  amount: number
  listPrice: number
  transactionContent: string
  bankAccount: string
  bankName: string
  accountHolderName: string
  qrUrl: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
}

function requirePg() {
  if (!isPgConfigured()) throw new Error('DATABASE_URL is not set')
}

export async function loadWeddingGuestPackQuotas(
  cardId: string,
  userId: string,
): Promise<WeddingGuestSideQuotas | null> {
  requirePg()
  const row = await pgQueryOne<{
    groom_guest_pack: string | null
    bride_guest_pack: string | null
    groom_count: number
    bride_count: number
  }>(
    `select c.groom_guest_pack,
            c.bride_guest_pack,
            (select count(*)::int
               from public.wedding_card_invited_guests g
              where g.wedding_card_id = c.id
                and g.invite_venue is distinct from 'bride_home') as groom_count,
            (select count(*)::int
               from public.wedding_card_invited_guests g
              where g.wedding_card_id = c.id
                and g.invite_venue = 'bride_home') as bride_count
     from public.wedding_cards c
     where c.id = $1::uuid and c.user_id = $2::uuid
     limit 1`,
    [cardId, userId],
  )
  if (!row) return null
  return buildWeddingGuestSideQuotas({
    groomPack: parseWeddingGuestPackId(row.groom_guest_pack),
    bridePack: parseWeddingGuestPackId(row.bride_guest_pack),
    groomCount: Number(row.groom_count ?? 0),
    brideCount: Number(row.bride_count ?? 0),
  })
}

export async function createWeddingGuestPackPayment(input: {
  userId: string
  cardId: string
  packId: WeddingGuestPackId
  side: WeddingGuestPackSide
}): Promise<WeddingGuestPackPaymentRow | { error: string }> {
  requirePg()
  const quotas = await loadWeddingGuestPackQuotas(input.cardId, input.userId)
  if (!quotas) return { error: 'Không tìm thấy thiệp.' }
  const quota = quotas[input.side]
  const sideLabel = weddingGuestPackSideLabel(input.side)
  const offer = quota.offers.find((item) => item.id === input.packId)
  if (!offer?.available) {
    const cap = weddingGuestCap(input.packId)
    if (cap != null && quota.guestCount > cap) {
      return { error: `Danh sách ${sideLabel} đang có ${quota.guestCount} khách, gói này tối đa ${cap}.` }
    }
    return { error: 'Gói này không cần thanh toán thêm.' }
  }
  const amount = weddingGuestPackUpgradeVnd(quota.packId, input.packId)
  if (amount <= 0) return { error: 'Gói này không cần thanh toán thêm.' }

  const configs = await listActivePaymentConfigs()
  const config = configs[0]
  if (!config) return { error: 'Chưa cấu hình tài khoản nhận thanh toán.' }

  const token = randomBytes(4).toString('hex').toUpperCase()
  const transactionContent = `SEVQR WGP${token}`
  const qrUrl = buildSePayQrImgUrl({
    acc: config.bank_account,
    bank: config.bank_id,
    amount,
    des: transactionContent,
    template: 'compact',
  })
  const listPrice = weddingGuestPackListPriceVnd(input.packId)
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      `update public.wedding_guest_pack_payments
       set status = 'cancelled', updated_at = now()
       where wedding_card_id = $1::uuid and user_id = $2::uuid and status = 'pending' and side = $3`,
      [input.cardId, input.userId, input.side],
    )
    const inserted = await client.query(
      `insert into public.wedding_guest_pack_payments (
         user_id, wedding_card_id, side, pack_id, amount, list_price, prior_pack,
         transaction_content, bank_account, bank_name, account_holder_name, qr_url, status
       ) values (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending'
       )
       returning id::text, user_id::text, wedding_card_id::text, pack_id, amount::int, list_price::int,
                 transaction_content, bank_account, bank_name, account_holder_name, qr_url, status`,
      [
        input.userId,
        input.cardId,
        input.side,
        input.packId,
        amount,
        listPrice,
        quota.packId,
        transactionContent,
        config.bank_account,
        config.bank_name,
        config.account_holder_name ?? '',
        qrUrl,
      ],
    )
    await client.query('commit')
    const row = inserted.rows[0]
    if (!row) return { error: 'Không tạo được giao dịch.' }
    return mapPayment(row)
  } catch (error) {
    await client.query('rollback').catch(() => {})
    const message = error instanceof Error ? error.message : String(error)
    if (
      (message.includes('wedding_guest_pack_payments') && message.includes('does not exist')) ||
      message.includes('groom_guest_pack') ||
      message.includes('bride_guest_pack') ||
      (message.includes('side') && message.includes('wedding_guest_pack_payments'))
    ) {
      return { error: 'Chưa có gói riêng nhà trai / nhà gái. Chạy migration rồi thử lại.' }
    }
    return { error: 'Không tạo được mã thanh toán.' }
  } finally {
    client.release()
  }
}

export async function getWeddingGuestPackPaymentForUser(
  paymentId: string,
  userId: string,
): Promise<(WeddingGuestPackPaymentRow & { cardId: string }) | null> {
  requirePg()
  const row = await pgQueryOne<Record<string, unknown>>(
    `select id::text, user_id::text, wedding_card_id::text, pack_id, amount::int, list_price::int,
            transaction_content, bank_account, bank_name, account_holder_name, qr_url, status
     from public.wedding_guest_pack_payments
     where id = $1::uuid and user_id = $2::uuid
     limit 1`,
    [paymentId, userId],
  )
  return row ? mapPayment(row) : null
}

export async function sepayFindWeddingGuestPackPaymentByTransactionId(
  transactionId: string,
): Promise<{ id: string; status: string } | null> {
  if (!isPgConfigured() || !transactionId.trim()) return null
  return pgQueryOne<{ id: string; status: string }>(
    `select id::text, status
     from public.wedding_guest_pack_payments
     where transaction_id = $1
     limit 1`,
    [transactionId.trim()],
  )
}

export async function sepayFindPendingWeddingGuestPackPaymentMatch(
  normalizedContentUpper: string,
  amountIn: number,
): Promise<{ id: string; user_id: string; pack_id: WeddingGuestPackId } | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ id: string; user_id: string; pack_id: string }>(
    `select id::text, user_id::text, pack_id
     from public.wedding_guest_pack_payments
     where status = 'pending'
       and upper(trim(transaction_content)) = $1
       and amount = $2::int
     order by created_at desc
     limit 1`,
    [normalizedContentUpper, Math.round(amountIn)],
  )
  const packId = parseWeddingGuestPackId(row?.pack_id)
  if (!row || !packId) return null
  return { id: row.id, user_id: row.user_id, pack_id: packId }
}

export async function completeWeddingGuestPackPayment(input: {
  paymentId: string
  transactionId: string | null
  normalizedContent: string
  sepayData: Record<string, unknown>
}): Promise<{ ok: true; packId: WeddingGuestPackId; cardId: string } | { error: string }> {
  requirePg()
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const paymentRes = await client.query<{
      user_id: string
      wedding_card_id: string
      pack_id: string
      side: string
    }>(
      `update public.wedding_guest_pack_payments
       set status = 'completed',
           transaction_id = $2,
           transaction_content = $3,
           sepay_data = $4::jsonb,
           completed_at = now(),
           updated_at = now()
       where id = $1::uuid and status = 'pending'
       returning user_id::text, wedding_card_id::text, pack_id, side`,
      [input.paymentId, input.transactionId, input.normalizedContent, JSON.stringify(input.sepayData)],
    )
    const payment = paymentRes.rows[0]
    const packId = parseWeddingGuestPackId(payment?.pack_id)
    const side: WeddingGuestPackSide = payment?.side === 'bride' ? 'bride' : 'groom'
    if (!payment || !packId) {
      await client.query('rollback')
      return { error: 'payment_not_pending_or_not_found' }
    }
    const nextRank = weddingGuestPackRank(packId)
    const column = side === 'bride' ? 'bride_guest_pack' : 'groom_guest_pack'
    await client.query(
      `update public.wedding_cards
       set ${column} = $3, updated_at = now()
       where id = $1::uuid
         and user_id = $2::uuid
         and (
           case coalesce(${column}, '')
             when 'p50' then 1
             when 'p100' then 2
             when 'unlimited' then 3
             else 0
           end
         ) < $4::int`,
      [payment.wedding_card_id, payment.user_id, packId, nextRank],
    )
    await client.query('commit')
    await notifyWeddingGuestPackPurchased({
      userId: payment.user_id,
      cardId: payment.wedding_card_id,
      side,
    }).catch((error) => {
      console.error('[wedding-guest-pack] notify', error)
    })
    return { ok: true, packId, cardId: payment.wedding_card_id }
  } catch (error) {
    await client.query('rollback').catch(() => {})
    return { error: error instanceof Error ? error.message : String(error) }
  } finally {
    client.release()
  }
}

function mapPayment(row: Record<string, unknown>): WeddingGuestPackPaymentRow {
  const packId = parseWeddingGuestPackId(row.pack_id) ?? 'p50'
  weddingGuestPackById(packId)
  const statusRaw = String(row.status ?? 'pending')
  const status =
    statusRaw === 'completed' || statusRaw === 'failed' || statusRaw === 'cancelled' ? statusRaw : 'pending'
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId ?? ''),
    cardId: String(row.wedding_card_id ?? row.cardId ?? ''),
    packId,
    amount: Number(row.amount ?? 0),
    listPrice: Number(row.list_price ?? row.listPrice ?? 0),
    transactionContent: String(row.transaction_content ?? ''),
    bankAccount: String(row.bank_account ?? ''),
    bankName: String(row.bank_name ?? ''),
    accountHolderName: String(row.account_holder_name ?? ''),
    qrUrl: String(row.qr_url ?? ''),
    status,
  }
}
