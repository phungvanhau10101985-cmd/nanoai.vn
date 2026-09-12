import {
  fetchPartnerCustomerProfileByEmailFromPg,
  upsertPartnerCustomerProfileByEmailFromPg,
} from '@/lib/db/messaging-partner-customer-profiles-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import {
  httpAvatarUrl,
  shopCustomerLoginLabel,
  type ShopCustomerLoginIdentity,
} from '@/lib/partner-website/shop/partner-site-login-identity'

export async function resolveShopCustomerLoginIdentity(input: {
  partnerId: string
  email?: string | null
  linkedUserId?: string | null
}): Promise<ShopCustomerLoginIdentity> {
  const email = String(input.email ?? '').trim().toLowerCase()
  const linkedUserId = String(input.linkedUserId ?? '').trim()
  let customerName = ''
  if (email) {
    const row = await fetchPartnerCustomerProfileByEmailFromPg({
      partnerId: input.partnerId,
      emailNormalized: email,
    })
    customerName = String(row?.customer_name ?? '').trim()
  }

  let profileName = ''
  let avatarUrl: string | null = null
  if (isPgConfigured() && (linkedUserId || email)) {
    try {
      const row = linkedUserId
        ? await pgQueryOne<{ full_name: string | null; avatar_url: string | null; picture: string | null }>(
            `select p.full_name, p.avatar_url,
                    nullif(trim(coalesce(u.raw_user_meta_data->>'picture', u.raw_user_meta_data->>'avatar_url')), '') as picture
             from auth.users u
             left join public.profiles p on p.id = u.id
             where u.id = $1::uuid
             limit 1`,
            [linkedUserId]
          )
        : await pgQueryOne<{ full_name: string | null; avatar_url: string | null; picture: string | null }>(
            `select p.full_name, p.avatar_url,
                    nullif(trim(coalesce(u.raw_user_meta_data->>'picture', u.raw_user_meta_data->>'avatar_url')), '') as picture
             from auth.users u
             left join public.profiles p on p.id = u.id
             where lower(coalesce(u.email, '')) = $1
             order by u.created_at asc
             limit 1`,
            [email]
          )
      profileName = String(row?.full_name ?? '').trim()
      avatarUrl = httpAvatarUrl(row?.avatar_url) || httpAvatarUrl(row?.picture)
    } catch (e) {
      console.warn('[resolveShopCustomerLoginIdentity]', e)
    }
  }

  return {
    name: shopCustomerLoginLabel({ customerName, profileName, email }),
    avatarUrl,
  }
}

export async function persistShopCustomerGoogleIdentity(input: {
  userId: string
  partnerId?: string | null
  email: string
  name?: string | null
  picture?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  const userId = input.userId.trim()
  const email = input.email.trim().toLowerCase()
  const name = String(input.name ?? '').trim().slice(0, 180)
  const picture = httpAvatarUrl(input.picture)
  if (!userId) return

  try {
    await pgQueryOne(
      `insert into public.profiles (id, full_name, avatar_url, updated_at)
       values ($1::uuid, $2, $3, now())
       on conflict (id) do update set
         full_name = coalesce(nullif(trim(public.profiles.full_name), ''), excluded.full_name),
         avatar_url = coalesce(nullif(trim(excluded.avatar_url), ''), public.profiles.avatar_url),
         updated_at = now()`,
      [userId, name || null, picture]
    )
  } catch (e) {
    console.warn('[persistShopCustomerGoogleIdentity] profiles', e)
  }

  const partnerId = String(input.partnerId ?? '').trim()
  if (!partnerId || !email || !name) return
  try {
    const existing = await fetchPartnerCustomerProfileByEmailFromPg({
      partnerId,
      emailNormalized: email,
    })
    if (existing?.customer_name?.trim()) return
    await upsertPartnerCustomerProfileByEmailFromPg({
      partnerId,
      emailNormalized: email,
      emailRaw: email,
      customerName: name,
      customerPhone: existing?.customer_phone ?? '',
      shippingAddress: existing?.shipping_address ?? '',
      gender: existing?.gender ?? null,
      dateOfBirth: existing?.date_of_birth ?? null,
    })
  } catch (e) {
    console.warn('[persistShopCustomerGoogleIdentity] shop profile', e)
  }
}
