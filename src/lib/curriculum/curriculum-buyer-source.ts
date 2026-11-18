/**
 * Kênh lúc khách thêm giỏ giáo trình: tạo giáo trình hoặc mở giáo trình.
 * Cùng lần chạm 30 ngày đã giữ cho thống kê thiệp — script đầu trang ghi trên mọi trang.
 */

import {
  rememberWeddingCreateSource,
  resolveRecordedCreateSource,
  weddingCreateSourceView,
  type WeddingCreateSourcePayload,
  type WeddingCreateSourceView,
} from '@/lib/wedding/wedding-create-source'

const BUYER_SOURCES = new Set(['facebook', 'tiktok', 'google_ads', 'direct', 'other'])

export function rememberCurriculumBuyerSource(): WeddingCreateSourcePayload {
  return rememberWeddingCreateSource()
}

/** Gắn kênh vào form tạo hoặc lưu giáo trình mới. */
export function appendCurriculumBuyerSource(formData: FormData): FormData {
  formData.set('buyerSource', JSON.stringify(rememberCurriculumBuyerSource()))
  return formData
}

export function parseCurriculumBuyerSourceField(raw: unknown): WeddingCreateSourcePayload | null {
  if (raw == null) return null
  let value: unknown = raw
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return null
    try {
      value = JSON.parse(text) as unknown
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  return {
    search: String(row.search ?? ''),
    referrer: String(row.referrer ?? ''),
    pageHost: String(row.pageHost ?? ''),
  }
}

export function curriculumBuyerSourceForStorage(
  record: { source: string; detail: string } | null | undefined,
): { source: string; detail: string } {
  const source = BUYER_SOURCES.has(record?.source ?? '') ? String(record?.source) : ''
  const detail = source
    ? String(record?.detail ?? '')
        .replace(/[\u0000-\u001F<>]/g, '')
        .trim()
        .slice(0, 160)
    : ''
  return { source, detail }
}

export function recordedCurriculumBuyerSource(
  raw: unknown,
  referer: string | null | undefined,
): { source: string; detail: string } {
  return curriculumBuyerSourceForStorage(resolveRecordedCreateSource(parseCurriculumBuyerSourceField(raw), referer))
}

export function curriculumBuyerSourceView(source: string, detail: string): WeddingCreateSourceView {
  return weddingCreateSourceView(source, detail)
}
