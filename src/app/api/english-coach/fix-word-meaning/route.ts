import { NextResponse } from 'next/server'
import { getInternalBaseUrl } from '@/lib/internal-url'
import { getUserForAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchDailyWordsPendingMeaningFixPg,
  fetchReviewQueuePendingMeaningFixPg,
  findVocabCacheIdByWordLanguagesPg,
  insertMeaningFixFailedPg,
  listMeaningFixFailedPg,
  setDailyWordMeaningFixAttemptedPg,
  setReviewQueueMeaningFixAttemptedPg,
  updateDailyWordMeaningFieldsPg,
  updateReviewQueueMeaningFieldsPg,
  updateVocabCacheMeaningFieldsPg,
} from '@/lib/db/language-coach-meaning-examples-fix-pg'

function hasCjk(s: string): boolean {
  return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(s)
}

function isTargetCjk(targetLang: string | null | undefined): boolean {
  const n = String(targetLang || '').toLowerCase()
  return /chinese|zh|mandarin|japanese|ja|korean|ko/.test(n)
}

function isNativeCjk(nativeLang: string | null | undefined): boolean {
  const n = String(nativeLang || '').toLowerCase()
  return /chinese|zh|mandarin|japanese|ja|korean|ko/.test(n)
}

function getMeaningText(row: { meaning?: string | null; meaning_items_json?: string | null }): string {
  const m = String(row.meaning ?? '').trim()
  if (m) return m
  try {
    const items = JSON.parse(row.meaning_items_json || '[]') as Array<{ text?: string }>
    return String(items[0]?.text ?? '').trim()
  } catch {
    return ''
  }
}

function meaningInWrongLanguage(
  row: { meaning?: string | null; meaning_items_json?: string | null; target_language?: string | null; native_language?: string | null }
): boolean {
  if (!isTargetCjk(row.target_language)) return false
  if (isNativeCjk(row.native_language)) return false
  const text = getMeaningText(row)
  if (!text) return false
  return hasCjk(text)
}

function sanitizeMeaningItems(input: unknown): Array<{ text: string; pinyin?: string }> {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      text: String((row as { text?: unknown })?.text || '').trim(),
      pinyin: String((row as { pinyin?: unknown })?.pinyin || '').trim(),
    }))
    .filter((row) => row.text)
    .slice(0, 8)
}

function sanitizeExampleItems(input: unknown): Array<{ targetText: string; targetPinyin?: string; nativeText: string }> {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      targetText: String((row as { targetText?: unknown })?.targetText || '').trim(),
      targetPinyin: String((row as { targetPinyin?: unknown })?.targetPinyin || '').trim(),
      nativeText: String((row as { nativeText?: unknown })?.nativeText || '').trim(),
    }))
    .filter((row) => row.targetText && row.nativeText)
    .slice(0, 6)
}

export async function GET() {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const role = await getProfileRoleWithFallback(auth.user!.id)
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ quản trị viên.' }, { status: 403 })
    }

    const failed = await listMeaningFixFailedPg(100)
    if (failed === null) {
      return NextResponse.json({ error: 'Không tải được danh sách lỗi.' }, { status: 500 })
    }

    return NextResponse.json({ items: failed })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST() {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const role = await getProfileRoleWithFallback(auth.user!.id)
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ quản trị viên.' }, { status: 403 })
    }

    const baseUrl = getInternalBaseUrl()

    const toFix: Array<{ table: 'daily' | 'review'; id: string; word: string; target: string; native: string; userId?: string }> = []

    const dailyRows = await fetchDailyWordsPendingMeaningFixPg()
    const reviewRows = await fetchReviewQueuePendingMeaningFixPg()
    if (dailyRows === null || reviewRows === null) {
      return NextResponse.json({ error: 'Không đọc được dữ liệu từ vựng.' }, { status: 500 })
    }

    for (const r of dailyRows) {
      if (meaningInWrongLanguage(r)) {
        toFix.push({
          table: 'daily',
          id: r.id,
          word: r.word,
          target: r.target_language || 'Chinese',
          native: r.native_language || 'Vietnamese',
          userId: r.user_id,
        })
      }
    }

    for (const r of reviewRows) {
      if (meaningInWrongLanguage(r)) {
        toFix.push({
          table: 'review',
          id: r.id,
          word: r.word,
          target: r.target_language || 'Chinese',
          native: r.native_language || 'Vietnamese',
          userId: r.user_id,
        })
      }
    }

    const byKey = new Map<string, (typeof toFix)[0]>()
    for (const r of toFix) {
      const k = `${r.word}::${r.target}::${r.native}`
      if (!byKey.has(k)) byKey.set(k, r)
    }

    let updatedDaily = 0
    let updatedReview = 0
    let updatedCache = 0
    let failedCount = 0
    const nowIso = () => new Date().toISOString()

    for (const [, r] of byKey) {
      const rowsToMark = toFix.filter((x) => x.word === r.word && x.target === r.target && x.native === r.native)
      try {
        for (const row of rowsToMark) {
          if (row.table === 'daily') {
            await setDailyWordMeaningFixAttemptedPg(row.id)
          } else {
            await setReviewQueueMeaningFixAttemptedPg(row.id)
          }
        }

        const res = await fetch(`${baseUrl}/api/english-coach/word`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: r.word,
            contextSentence: '',
            targetLanguage: r.target,
            nativeLanguage: r.native,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          meaning?: string
          pronunciation?: string
          meaningItems?: Array<{ text: string; pinyin?: string }>
          exampleItems?: Array<{ targetText: string; targetPinyin?: string; nativeText: string }>
        }

        if (!res.ok || !data.meaning) {
          const errMsg = (data as { error?: string }).error || `Status ${res.status}`
          for (const row of rowsToMark) {
            await insertMeaningFixFailedPg({
              word: r.word,
              targetLanguage: r.target,
              nativeLanguage: r.native,
              userId: row.userId || null,
              sourceTable: row.table === 'daily' ? 'language_coach_daily_words' : 'language_coach_review_queue',
              sourceId: row.id,
              errorMessage: errMsg,
            })
          }
          failedCount++
          continue
        }

        const meaningItems = sanitizeMeaningItems(data.meaningItems)
        const exampleItems = sanitizeExampleItems(data.exampleItems)
        const primaryEx = exampleItems[0]
        const meaningItemsJson = meaningItems.length > 0 ? JSON.stringify(meaningItems) : null
        const exampleItemsJson = exampleItems.length > 0 ? JSON.stringify(exampleItems) : null
        const t = nowIso()

        for (const row of rowsToMark) {
          if (row.table === 'daily') {
            const ok = await updateDailyWordMeaningFieldsPg({
              id: row.id,
              meaning: data.meaning || null,
              pronunciation: data.pronunciation || null,
              meaningItemsJson,
              exampleItemsJson,
              exampleTarget: primaryEx?.targetText || null,
              exampleNative: primaryEx?.nativeText || null,
              updatedAtIso: t,
            })
            if (ok) updatedDaily++
          } else {
            const ok = await updateReviewQueueMeaningFieldsPg({
              id: row.id,
              meaning: data.meaning || null,
              pronunciation: data.pronunciation || null,
              meaningItemsJson,
              exampleItemsJson,
              updatedAtIso: t,
            })
            if (ok) updatedReview++
          }
        }

        const cacheId = await findVocabCacheIdByWordLanguagesPg(r.word, r.target, r.native)
        if (cacheId) {
          const ok = await updateVocabCacheMeaningFieldsPg({
            id: cacheId,
            meaning: data.meaning || null,
            pronunciation: data.pronunciation || null,
            meaningItemsJson,
            exampleItemsJson,
            exampleTarget: primaryEx?.targetText || null,
            exampleNative: primaryEx?.nativeText || null,
            updatedAtIso: t,
          })
          if (ok) updatedCache++
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Lỗi không xác định'
        for (const row of rowsToMark) {
          await insertMeaningFixFailedPg({
            word: r.word,
            targetLanguage: r.target,
            nativeLanguage: r.native,
            userId: row.userId || null,
            sourceTable: row.table === 'daily' ? 'language_coach_daily_words' : 'language_coach_review_queue',
            sourceId: row.id,
            errorMessage: errMsg,
          })
        }
        failedCount++
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Đã chuẩn hóa nghĩa: ${updatedDaily} daily, ${updatedReview} review, ${updatedCache} cache. Thất bại: ${failedCount}.`,
      updatedDaily,
      updatedReview,
      updatedCache,
      failedCount,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
