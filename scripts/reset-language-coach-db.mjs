#!/usr/bin/env node
/**
 * Xóa toàn bộ dữ liệu language_coach trong DB để test lại hệ thống.
 * CHỈ dùng cho môi trường development/test.
 *
 * Chạy: node scripts/reset-language-coach-db.mjs
 * Hoặc: npm run reset-db:language-coach
 *
 * Yêu cầu: .env.local có NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

if (!existsSync(envPath)) {
  console.error('Không tìm thấy .env.local')
  process.exit(1)
}

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
if (!url || !key) {
  console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local')
  process.exit(1)
}

// Chỉ cho phép khi có flag hoặc development (NODE_ENV mặc định undefined = dev)
const force = process.argv.includes('--force')
const isProd = process.env.NODE_ENV === 'production'
if (isProd && !force) {
  console.error('Đang chạy production. Thêm --force để bỏ qua (cẩn thận!).')
  process.exit(1)
}

const supabase = createClient(url, key)

/** Thứ tự xóa: bảng con trước (có FK) */
const TABLES = [
  'language_coach_live_lesson_turns',
  'language_coach_live_lesson_purchases',
  'language_coach_live_lesson_starts',
  'language_coach_live_lessons',
  'language_coach_preset_turns',
  'language_coach_turn_diagnostics',
  'language_coach_messages',
  'language_coach_session_memories',
  'language_coach_daily_words',
  'language_coach_completed_lessons',
  'language_coach_ended_sessions',
  'language_coach_hidden_sessions',
  'language_coach_credit_events',
  'language_coach_review_queue',
  'language_coach_learning_goals',
  'language_coach_progress_daily',
  'language_coach_assessments',
  'language_coach_tokenizations',
  'language_coach_dialogue_replay_cache',
  'language_coach_phrase_cache',
  'language_coach_vocab_cache',
  'language_coach_meaning_fix_failed',
  'language_coach_transliteration_cache',
  'language_coach_opening_translation_cache',
  'language_coach_tts_cache',
  'language_coach_cache_daily_stats',
  'language_coach_custom_topics',
  'language_coach_topic_curricula',
]

/** Bảng dùng cột khác làm PK */
const TABLE_PK = {
  language_coach_cache_daily_stats: 'stat_date',
  language_coach_opening_translation_cache: 'cache_key',
}

async function deleteAllFromTable(table) {
  const pk = TABLE_PK[table] || 'id'
  let total = 0
  const batchSize = 500
  for (;;) {
    const { data: rows, error: selErr } = await supabase
      .from(table)
      .select(pk)
      .limit(batchSize)
    if (selErr) return { ok: false, error: selErr.message }
    if (!rows || rows.length === 0) break
    const values = rows.map((r) => r[pk])
    const { error: delErr } = await supabase.from(table).delete().in(pk, values)
    if (delErr) return { ok: false, error: delErr.message }
    total += values.length
    if (rows.length < batchSize) break
  }
  return { ok: true, count: total }
}

async function main() {
  console.log('Đang xóa dữ liệu language_coach...')
  let failed = 0
  for (const table of TABLES) {
    try {
      const result = await deleteAllFromTable(table)
      if (result.ok) {
        const count = result.count ?? 0
        console.log(`  ✓ ${table}${count > 0 ? ` (${count} dòng)` : ''}`)
      } else {
        console.error(`  ✗ ${table}: ${result.error}`)
        failed++
      }
    } catch (e) {
      console.error(`  ✗ ${table}:`, e instanceof Error ? e.message : String(e))
      failed++
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} bảng xóa thất bại.`)
    process.exit(1)
  }
  console.log('\nĐã xóa xong toàn bộ dữ liệu language_coach.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
