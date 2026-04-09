import {
  findFacebookChannelByPageIdFromPg,
  findFacebookChannelByVerifyTokenFromPg,
  findZaloChannelByWebhookSecretFromPg,
  getFacebookSendTokenFromPg,
  getZaloSendTokenFromPg,
  upsertFacebookMessengerChannelPg,
  upsertZaloOaChannelPg,
} from '@/lib/db/messaging-partner-channels-pg'
import { isPgConfigured } from '@/lib/db/pool'

function pgNotConfiguredMessage(): string {
  return 'Database is not configured (DATABASE_URL).'
}

/** Kênh Facebook theo Page ID — chỉ Postgres. */
export async function findFacebookChannelByPageId(facebookPageId: string) {
  if (!isPgConfigured()) {
    return { error: pgNotConfiguredMessage() }
  }
  try {
    const row = await findFacebookChannelByPageIdFromPg(facebookPageId)
    if (row !== null) return { channel: row }
    return { channel: null as null }
  } catch (e) {
    console.warn('[partner-channels-db] findFacebookChannelByPageId', e)
    return { error: e instanceof Error ? e.message : 'lookup failed' }
  }
}

export async function findFacebookChannelByVerifyToken(verifyToken: string) {
  if (!isPgConfigured()) {
    return { error: pgNotConfiguredMessage() }
  }
  try {
    const row = await findFacebookChannelByVerifyTokenFromPg(verifyToken)
    if (row !== null) return { row }
    return { row: null as null }
  } catch (e) {
    console.warn('[partner-channels-db] findFacebookChannelByVerifyToken', e)
    return { error: e instanceof Error ? e.message : 'lookup failed' }
  }
}

export async function findZaloChannelByWebhookSecret(secret: string) {
  if (!isPgConfigured()) {
    return { error: pgNotConfiguredMessage() }
  }
  try {
    const row = await findZaloChannelByWebhookSecretFromPg(secret)
    if (row !== null) return { row }
    return { row: null as null }
  } catch (e) {
    console.warn('[partner-channels-db] findZaloChannelByWebhookSecret', e)
    return { error: e instanceof Error ? e.message : 'lookup failed' }
  }
}

export async function getFacebookSendToken(
  partnerId: string,
  facebookPageId: string
): Promise<{ token: string | null; error?: string }> {
  if (!isPgConfigured()) {
    return { token: null, error: pgNotConfiguredMessage() }
  }
  try {
    const tok = await getFacebookSendTokenFromPg(partnerId, facebookPageId)
    return { token: tok }
  } catch (e) {
    console.warn('[partner-channels-db] getFacebookSendToken', e)
    return { token: null, error: e instanceof Error ? e.message : 'lookup failed' }
  }
}

export async function getZaloSendToken(partnerId: string): Promise<{ token: string | null; error?: string }> {
  if (!isPgConfigured()) {
    return { token: null, error: pgNotConfiguredMessage() }
  }
  try {
    const tok = await getZaloSendTokenFromPg(partnerId)
    return { token: tok }
  } catch (e) {
    console.warn('[partner-channels-db] getZaloSendToken', e)
    return { token: null, error: e instanceof Error ? e.message : 'lookup failed' }
  }
}

export async function upsertFacebookMessengerChannel(params: {
  partnerId: string
  facebookPageId: string
  pageAccessToken: string
  webhookVerifyToken?: string | null
}) {
  if (!isPgConfigured()) {
    return { error: pgNotConfiguredMessage() }
  }
  try {
    const r = await upsertFacebookMessengerChannelPg(params)
    if ('ok' in r) return r
    return { error: r.error }
  } catch (e) {
    console.warn('[partner-channels-db] upsertFacebookMessengerChannel', e)
    return { error: e instanceof Error ? e.message : 'upsert failed' }
  }
}

export async function upsertZaloOaChannel(params: {
  partnerId: string
  zaloAccessToken: string
  zaloWebhookSecret: string
}) {
  if (!isPgConfigured()) {
    return { error: pgNotConfiguredMessage() }
  }
  try {
    const r = await upsertZaloOaChannelPg(params)
    if ('ok' in r) return r
    return { error: r.error }
  } catch (e) {
    console.warn('[partner-channels-db] upsertZaloOaChannel', e)
    return { error: e instanceof Error ? e.message : 'upsert failed' }
  }
}
