#!/usr/bin/env node
/**
 * Query DB for word 听起来 - check example_items_json, targetText format
 * Run: node scripts/query-word-tingqilai.mjs
 */
import { createClient } from '@supabase/supabase-js'
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
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const word = '听起来'
  console.log('=== Query word:', word, '===\n')

  const { data: daily, error: e1 } = await supabase
    .from('language_coach_daily_words')
    .select('id, word, meaning, pronunciation, example_target, example_native, meaning_items_json, example_items_json')
    .ilike('word', `%${word}%`)

  if (e1) {
    console.error('daily_words error:', e1.message)
  } else {
    console.log('--- language_coach_daily_words ---')
    console.log(JSON.stringify(daily, null, 2))
  }

  const { data: review, error: e2 } = await supabase
    .from('language_coach_review_queue')
    .select('id, word, meaning, pronunciation, meaning_items_json, example_items_json')
    .ilike('word', `%${word}%`)

  if (e2) {
    console.error('review_queue error:', e2.message)
  } else {
    console.log('\n--- language_coach_review_queue ---')
    console.log(JSON.stringify(review, null, 2))
  }

  const { data: cache, error: e3 } = await supabase
    .from('language_coach_vocab_cache')
    .select('word, meaning, pronunciation, example_target, example_native, meaning_items_json, example_items_json')
    .ilike('word', `%${word}%`)

  if (e3) {
    console.error('vocab_cache error:', e3.message)
  } else {
    console.log('\n--- language_coach_vocab_cache ---')
    console.log(JSON.stringify(cache, null, 2))
  }
}

main().catch(console.error)
