#!/usr/bin/env node
/**
 * Import câu hỏi VNHSGE từ Hugging Face vào worksheet_official_questions.
 * Nguồn: https://huggingface.co/datasets/roshansk23/Vietnam_HighSchool_Exam_Dataset
 *
 * Chạy: node scripts/import-vnhsge-official-questions.mjs
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

const supabase = createClient(url, key)

/** Map category_en từ VNHSGE sang subject_id dự án */
const CATEGORY_TO_SUBJECT = {
  Mathematics: 'toan',
  Physics: 'vat-ly',
  Chemistry: 'hoa-hoc',
  Biology: 'sinh-hoc',
  History: 'lich-su',
  Geography: 'dia-ly',
  'Civic Education': 'gdcd',
  English: 'tieng-anh',
}

const BATCH_SIZE = 100
const DATASET_URL = 'https://datasets-server.huggingface.co/rows'
const DATASET_PARAMS = new URLSearchParams({
  dataset: 'roshansk23/Vietnam_HighSchool_Exam_Dataset',
  config: 'default',
  split: 'train',
  length: String(BATCH_SIZE),
})

async function fetchBatch(offset, retries = 3) {
  const params = new URLSearchParams(DATASET_PARAMS)
  params.set('offset', String(offset))
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${DATASET_URL}?${params}`)
    if (res.status === 429) {
      const wait = 60 * (i + 1)
      console.warn(`  Rate limit 429, đợi ${wait}s rồi thử lại...`)
      await new Promise((r) => setTimeout(r, wait * 1000))
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    return res.json()
  }
  throw new Error('HTTP 429: Quá nhiều request. Chạy lại script sau vài phút.')
}

function parseAnswer(answerStr, optionsLength) {
  const n = parseInt(String(answerStr), 10)
  if (Number.isNaN(n)) return 0
  if (n >= 1 && n <= optionsLength) return n - 1
  if (n >= 0 && n < optionsLength) return n
  return 0
}

async function main() {
  console.log('Đang tải VNHSGE từ Hugging Face...')
  let offset = 0
  let total = 0
  let imported = 0
  let skipped = 0

  do {
    const data = await fetchBatch(offset)
    const rows = data.rows || []
    total = data.num_rows_total ?? total

    const batch = []
    for (const r of rows) {
      const row = r.row
      const rowIdx = r.row_idx ?? offset
      const subjectId = CATEGORY_TO_SUBJECT[row.category_en]
      if (!subjectId) {
        skipped++
        continue
      }

      const options = Array.isArray(row.options) ? row.options : []
      if (options.length < 2) {
        skipped++
        continue
      }

      const questionText = String(row.question || '').trim()
      if (!questionText) {
        skipped++
        continue
      }

      const correctIndex = parseAnswer(row.answer, options.length)

      batch.push({
        subject_id: subjectId,
        grade_level_id: 'lop-12',
        textbook_set_id: 'khac',
        lesson_order: null,
        question_text: questionText,
        options: options,
        correct_index: correctIndex,
        explanation: null,
        source: 'vnhsge',
        external_id: `vnhsge_${row.file_name || 'unknown'}_${offset}_${rowIdx}`,
      })
    }

    if (batch.length > 0) {
      const { error } = await supabase.from('worksheet_official_questions').insert(batch)
      if (error) {
        if (error.code === '23505') {
          for (const rec of batch) {
            const { error: insErr } = await supabase.from('worksheet_official_questions').insert(rec)
            if (!insErr) imported++
            else if (insErr.code !== '23505') console.warn('Lỗi:', insErr.message)
          }
        } else {
          console.warn('Lỗi batch:', error.message)
        }
      } else {
        imported += batch.length
      }
    }

    offset += rows.length
    console.log(`  Đã xử lý ${offset}/${total} dòng, import ${imported}, bỏ qua ${skipped}`)

    if (rows.length < BATCH_SIZE) break
    await new Promise((r) => setTimeout(r, 1500))
  } while (offset < total)

  console.log(`\nHoàn thành. Tổng import: ${imported}, bỏ qua: ${skipped}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
