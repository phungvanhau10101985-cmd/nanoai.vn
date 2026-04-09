#!/usr/bin/env node
/**
 * Chuẩn hóa topic cho câu hỏi trong worksheet_official_questions.
 * Dùng Gemini 2.5 Flash để trích chủ đề/kiến thức chính từ mỗi câu hỏi.
 *
 * Chạy: node scripts/normalize-official-questions-topics.mjs
 *
 * Yêu cầu: .env có GOOGLE_API_KEY, DATABASE_URL
 */

import { pgQuery } from './pg-query.mjs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const merged = {}
  for (const name of ['.env', '.env.local']) {
    const p = join(__dirname, '..', name)
    if (!existsSync(p)) continue
    const content = readFileSync(p, 'utf8')
    for (const line of content.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq < 0) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      merged[k] = v
    }
  }
  Object.assign(process.env, merged)
  return merged
}

const env = loadEnv()
const GOOGLE_API_KEY = env.GOOGLE_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
process.env.DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL

if (!GOOGLE_API_KEY || !process.env.DATABASE_URL?.trim()) {
  console.error('Thiếu GOOGLE_API_KEY hoặc DATABASE_URL trong .env')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY)

/** Chuẩn hóa topic giống normalizeTopicForSearch (bỏ dấu, lowercase) */
const VI_REMOVE = {
  à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a', ă: 'a', ằ: 'a', ắ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
  â: 'a', ầ: 'a', ấ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a', è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e',
  ê: 'e', ề: 'e', ế: 'e', ể: 'e', ễ: 'e', ệ: 'e', ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
  ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o', ô: 'o', ồ: 'o', ố: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
  ơ: 'o', ờ: 'o', ớ: 'o', ở: 'o', ỡ: 'o', ợ: 'o', ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u',
  ư: 'u', ừ: 'u', ứ: 'u', ử: 'u', ữ: 'u', ự: 'u', ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
  đ: 'd',
}

function normalizeTopic(topic) {
  if (!topic || typeof topic !== 'string') return ''
  let s = topic.trim()
  s = s.replace(/\b(Bài|Bai)\s*\d+\s*[:.]?\s*/gi, '')
  s = s.replace(/\b(Chương|Chuong)\s*\d+\s*[:.]?\s*/gi, '')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.toLowerCase().split('').map((c) => VI_REMOVE[c] ?? c).join('')
  return s
}

const BATCH_SIZE = 25
const MODEL = 'gemini-2.5-pro'

function buildPrompt(questions) {
  const list = questions
    .map((q, i) => `${i + 1}. [${q.subject_id}] ${q.question_text.slice(0, 300)}${q.question_text.length > 300 ? '...' : ''}`)
    .join('\n')
  return `Bạn là chuyên gia giáo dục. Với mỗi câu hỏi dưới đây, trả về chủ đề/kiến thức chính (1-5 từ tiếng Việt).
Ví dụ: "Nguyên hàm", "Tích phân", "Ứng dụng tích phân", "Đạo hàm", "Cực trị hàm số", "Phương trình mặt phẳng", "Xác suất có điều kiện".

CÂU HỎI:
${list}

Trả về JSON: { "topics": ["chủ đề 1", "chủ đề 2", ...] } - mảng theo đúng thứ tự câu 1, 2, 3...
Chỉ trả về JSON, không markdown.`
}

async function extractTopics(questions) {
  const prompt = buildPrompt(questions)
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  const text = result.response?.text()?.trim() || ''
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    const topics = Array.isArray(parsed?.topics) ? parsed.topics : []
    return topics.slice(0, questions.length)
  } catch {
    return null
  }
}

async function main() {
  console.log('Chuẩn hóa topic cho câu hỏi trong worksheet_official_questions')
  console.log('Model:', MODEL)
  console.log('')

  const onlyNull = process.argv.includes('--only-null')
  const all = await pgQuery(
    onlyNull
      ? `select id, question_text, subject_id from worksheet_official_questions where topic_label is null`
      : `select id, question_text, subject_id from worksheet_official_questions`
  )

  const total = all?.length ?? 0
  console.log(`Tổng câu hỏi cần xử lý: ${total}`)
  if (total === 0) {
    console.log('Không có câu hỏi nào.')
    return
  }

  let processed = 0
  let failed = 0
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE)
    const topics = await extractTopics(batch)
    if (!topics || topics.length === 0) {
      console.warn(`  Batch ${i / BATCH_SIZE + 1}: AI không trả về topics`)
      failed += batch.length
      await new Promise((r) => setTimeout(r, 2000))
      continue
    }
    for (let j = 0; j < batch.length; j++) {
      const q = batch[j]
      const label = (topics[j] ?? '').trim().slice(0, 200)
      const normalized = normalizeTopic(label)
      try {
        await pgQuery(
          `update worksheet_official_questions set topic_label = $1, topic_normalized = $2 where id = $3::uuid`,
          [label || null, normalized || null, q.id]
        )
        processed++
      } catch (updErr) {
        console.warn('  Lỗi update:', q.id, updErr instanceof Error ? updErr.message : updErr)
        failed++
      }
    }
    console.log(`  ${Math.min(i + BATCH_SIZE, total)}/${total} - processed: ${processed}, failed: ${failed}`)
    await new Promise((r) => setTimeout(r, 500))
  }
  console.log(`\nHoàn thành. Đã chuẩn hóa: ${processed}, lỗi: ${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
