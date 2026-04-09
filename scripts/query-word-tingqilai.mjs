#!/usr/bin/env node
/**
 * Query DB for word 听起来 - check example_items_json, targetText format
 * Run: node scripts/query-word-tingqilai.mjs
 *
 * Cần: DATABASE_URL trong .env.local
 */
import { pgQuery } from './pg-query.mjs'
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

process.env.DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL
if (!process.env.DATABASE_URL?.trim()) {
  console.error('Missing DATABASE_URL in .env.local')
  process.exit(1)
}

async function main() {
  const word = '听起来'
  console.log('=== Query word:', word, '===\n')

  const daily = await pgQuery(
    `select id, word, meaning, pronunciation, example_target, example_native, meaning_items_json, example_items_json
     from language_coach_daily_words where word ilike $1`,
    [`%${word}%`]
  )
  console.log('--- language_coach_daily_words ---')
  console.log(JSON.stringify(daily, null, 2))

  const review = await pgQuery(
    `select id, word, meaning, pronunciation, meaning_items_json, example_items_json
     from language_coach_review_queue where word ilike $1`,
    [`%${word}%`]
  )
  console.log('\n--- language_coach_review_queue ---')
  console.log(JSON.stringify(review, null, 2))

  const cache = await pgQuery(
    `select word, meaning, pronunciation, example_target, example_native, meaning_items_json, example_items_json
     from language_coach_vocab_cache where word ilike $1`,
    [`%${word}%`]
  )
  console.log('\n--- language_coach_vocab_cache ---')
  console.log(JSON.stringify(cache, null, 2))
}

main().catch(console.error)
