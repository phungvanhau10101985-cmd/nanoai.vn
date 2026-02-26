#!/usr/bin/env node
/**
 * Fix example_items_json where targetText is pinyin instead of original script (zh/ja/ko).
 * Re-fetches from AI and updates DB.
 * Run: node scripts/fix-example-targettext-format.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq < 0) continue
  const k = trimmed.slice(0, eq).trim()
  let v = trimmed.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  env[k] = v
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const googleKey = env.GOOGLE_API_KEY
if (!url || !key || !googleKey) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_API_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)
const genAI = new GoogleGenerativeAI(googleKey)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

function hasCjk(s) {
  return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(s)
}

function exampleItemsNeedFix(items, targetLang) {
  const norm = String(targetLang || '').toLowerCase()
  if (!norm.includes('chinese') && !norm.includes('zh') && !norm.includes('mandarin') &&
      !norm.includes('japanese') && !norm.includes('ja') && !norm.includes('korean') && !norm.includes('ko')) {
    return false
  }
  for (const item of items) {
    const t = String(item.targetText || '').trim()
    if (t && !hasCjk(t)) return true
  }
  return false
}

function sanitizeExampleItems(input) {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      targetText: String(row?.targetText || '').trim(),
      targetPinyin: String(row?.targetPinyin || '').trim(),
      nativeText: String(row?.nativeText || '').trim(),
    }))
    .filter((row) => row.targetText && row.nativeText)
    .slice(0, 6)
}

async function fetchWordFromAI(word, targetLanguage, nativeLanguage) {
  const prompt = `Bạn là giáo viên ngôn ngữ.
Hãy giải thích từ "${word}" (chỉ trả ví dụ câu, không cần giải nghĩa chi tiết).
Ngôn ngữ mục tiêu: ${targetLanguage}.
Ngôn ngữ mẹ đẻ: ${nativeLanguage}.

Yêu cầu exampleItems (2-3 ví dụ):
- targetText: PHẢI là chữ gốc (tiếng Trung = 汉字, tiếng Nhật = かな/漢字, tiếng Hàn = 한글). KHÔNG dùng pinyin/romaji cho targetText.
- targetPinyin: phiên âm Latin.
- nativeText: bản dịch.

Trả về JSON:
{"exampleItems":[{"targetText":"...","targetPinyin":"...","nativeText":"..."}]}`

  const result = await model.generateContent(prompt)
  const text = (result.response.text() || '').trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0])
    const items = sanitizeExampleItems(parsed.exampleItems)
    if (items.length === 0) return null
    return items
  } catch {
    return null
  }
}

async function main() {
  console.log('Finding rows with targetText=pinyin (wrong format)...\n')

  const { data: dailyRows } = await supabase
    .from('language_coach_daily_words')
    .select('id, user_id, word, target_language, native_language, example_items_json')
    .not('example_items_json', 'is', null)

  const { data: reviewRows } = await supabase
    .from('language_coach_review_queue')
    .select('id, user_id, word, target_language, native_language, example_items_json')
    .not('example_items_json', 'is', null)

  const toFix = []
  for (const row of dailyRows || []) {
    try {
      const items = JSON.parse(row.example_items_json || '[]')
      if (exampleItemsNeedFix(items, row.target_language)) {
        toFix.push({ table: 'daily_words', ...row, items })
      }
    } catch {}
  }
  for (const row of reviewRows || []) {
    try {
      const items = JSON.parse(row.example_items_json || '[]')
      if (exampleItemsNeedFix(items, row.target_language)) {
        toFix.push({ table: 'review_queue', ...row, items })
      }
    } catch {}
  }

  const byWord = new Map()
  for (const r of toFix) {
    const k = `${r.word}::${r.target_language || ''}::${r.native_language || ''}`
    if (!byWord.has(k)) byWord.set(k, { word: r.word, target: r.target_language, native: r.native_language, rows: [] })
    byWord.get(k).rows.push(r)
  }

  console.log(`Found ${toFix.length} rows (${byWord.size} unique words) to fix.\n`)

  for (const [k, entry] of byWord) {
    const { word, target, native, rows } = entry
    console.log(`Fetching "${word}" (${target}/${native})...`)
    const newItems = await fetchWordFromAI(word, target || 'Chinese', native || 'Vietnamese')
    if (!newItems || newItems.length === 0) {
      console.log(`  Skip: no valid examples from AI`)
      continue
    }
    entry.newItems = newItems
    const newJson = JSON.stringify(newItems)
    for (const r of rows) {
      if (r.table === 'daily_words') {
        const { error } = await supabase
          .from('language_coach_daily_words')
          .update({
            example_items_json: newJson,
            example_target: newItems[0]?.targetText || null,
            example_native: newItems[0]?.nativeText || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', r.id)
        if (error) console.error(`  daily_words ${r.id}:`, error.message)
        else console.log(`  Updated daily_words ${r.id}`)
      } else {
        const { error } = await supabase
          .from('language_coach_review_queue')
          .update({
            example_items_json: newJson,
            updated_at: new Date().toISOString(),
          })
          .eq('id', r.id)
        if (error) console.error(`  review_queue ${r.id}:`, error.message)
        else console.log(`  Updated review_queue ${r.id}`)
      }
    }
  }

  console.log('\nUpdating vocab_cache...')
  const { data: cacheRows } = await supabase
    .from('language_coach_vocab_cache')
    .select('id, word, target_language, native_language, example_items_json')
    .not('example_items_json', 'is', null)

  for (const row of cacheRows || []) {
    try {
      const items = JSON.parse(row.example_items_json || '[]')
      if (!exampleItemsNeedFix(items, row.target_language)) continue
      const k = `${row.word}::${row.target_language || ''}::${row.native_language || ''}`
      let newItems = byWord.get(k)?.newItems
      if (!newItems) {
        newItems = await fetchWordFromAI(row.word, row.target_language || 'Chinese', row.native_language || 'Vietnamese')
      }
      if (newItems?.length) {
        await supabase.from('language_coach_vocab_cache').update({
          example_items_json: JSON.stringify(newItems),
          example_target: newItems[0]?.targetText || null,
          example_native: newItems[0]?.nativeText || null,
          updated_at: new Date().toISOString(),
        }).eq('id', row.id)
        console.log(`  Updated vocab_cache ${row.word}`)
      }
    } catch (e) {
      console.error(`  vocab_cache ${row.word}:`, e.message)
    }
  }

  console.log('\nDone.')
}

main().catch(console.error)
