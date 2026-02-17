'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { UsageMetadata } from '@google/generative-ai'

export interface ApiUsageLogParams {
  userId?: string | null
  model: string
  feature: string
  promptTokenCount: number
  candidatesTokenCount: number
  totalTokenCount: number
  /** Độ phân giải ảnh trả về: '2K' | '4K' | null (không trả ảnh) */
  imageSize?: '2K' | '4K' | null
}

/**
 * Ghi log sử dụng API vào DB. Fire-and-forget, không block luồng chính.
 * Dùng service role để insert – hoạt động cả khi gọi từ API route (process-translate) không có session.
 */
export async function trackApiUsage(params: ApiUsageLogParams): Promise<void> {
  const {
    userId,
    model,
    feature,
    promptTokenCount,
    candidatesTokenCount,
    totalTokenCount,
    imageSize,
  } = params

  if (totalTokenCount <= 0) return

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[trackApiUsage] Thiếu SUPABASE_SERVICE_ROLE_KEY')
    return
  }

  try {
    let effectiveUserId = userId ?? null
    if (effectiveUserId == null) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      effectiveUserId = user?.id ?? null
    }

    const adminSupabase = createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await adminSupabase.from('api_usage_log').insert({
      user_id: effectiveUserId ?? null,
      model,
      feature,
      prompt_token_count: promptTokenCount,
      candidates_token_count: candidatesTokenCount,
      total_token_count: totalTokenCount,
      image_size: imageSize ?? null,
    })
  } catch (err) {
    console.error('[trackApiUsage]', err)
  }
}

/**
 * Trích xuất usage từ response và gọi trackApiUsage.
 * @param imageSize - Độ phân giải ảnh trả về ('2K' | '4K') nếu là lượt gọi sinh ảnh, undefined nếu không trả ảnh.
 */
export async function trackFromUsageMetadata(
  usageMetadata: UsageMetadata | undefined,
  model: string,
  feature: string,
  userId?: string | null,
  imageSize?: '2K' | '4K' | null
): Promise<void> {
  if (!usageMetadata) return
  const prompt = usageMetadata.promptTokenCount ?? 0
  const candidates = usageMetadata.candidatesTokenCount ?? 0
  const total = usageMetadata.totalTokenCount ?? prompt + candidates
  if (total <= 0) return
  await trackApiUsage({
    userId,
    model,
    feature,
    promptTokenCount: prompt,
    candidatesTokenCount: candidates,
    totalTokenCount: total,
    imageSize: imageSize ?? null,
  })
}
