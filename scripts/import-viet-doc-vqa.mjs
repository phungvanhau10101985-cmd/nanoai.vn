#!/usr/bin/env node
/**
 * Import Viet-Doc-VQA-flash2 từ Hugging Face vào worksheet_official_questions.
 * Dùng Node.js + hyparquet (pure JS, không cần Python/C++).
 *
 * Chạy: npm run import:viet-doc-vqa
 * Yêu cầu: .env.local có HUGGINGFACE_TOKEN và SUPABASE_*
 * Bước 1: Chấp nhận điều khoản tại https://huggingface.co/datasets/5CD-AI/Viet-Doc-VQA-flash2
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

const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq < 0) continue
  let v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  env[t.slice(0, eq).trim()] = v
}

const hfToken = env.HUGGINGFACE_TOKEN?.trim()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!hfToken || !supabaseUrl || !supabaseKey) {
  console.error('Thiếu HUGGINGFACE_TOKEN hoặc SUPABASE_* trong .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const REPO = '5CD-AI/Viet-Doc-VQA-flash2'
const MAX_ROWS = parseInt(process.env.VIET_DOC_VQA_MAX_ROWS || '5000', 10)
const DRY_RUN = process.argv.includes('--dry-run')

function inferSubject(text) {
  const t = text.toLowerCase()
  if (/\b(toán|số|phương trình|hàm|tích phân|đạo hàm)\b/.test(t)) return 'toan'
  if (/\b(vật lý|lực|điện|quang)\b/.test(t)) return 'vat-ly'
  if (/\b(hóa học|phản ứng|nguyên tố)\b/.test(t)) return 'hoa-hoc'
  if (/\b(sinh học|tế bào|di truyền)\b/.test(t)) return 'sinh-hoc'
  if (/\b(lịch sử|chiến tranh|triều đại)\b/.test(t)) return 'lich-su'
  if (/\b(địa lý|bản đồ|khí hậu)\b/.test(t)) return 'dia-ly'
  if (/\b(tiếng anh|english|verb|noun)\b/.test(t)) return 'tieng-anh'
  if (/\b(ngữ văn|văn học|thơ|truyện)\b/.test(t)) return 'ngu-van'
  return 'khac'
}

function extractQAPairs(conv) {
  const pairs = []
  if (!Array.isArray(conv)) return pairs
  let lastUser = null
  for (const turn of conv) {
    if (!turn || typeof turn !== 'object') continue
    const role = (turn.role || turn.from || '').toLowerCase()
    const content = String(turn.content ?? turn.value ?? '').trim()
    if (!content) continue
    if (role === 'user' || role === 'human') lastUser = content
    else if ((role === 'assistant' || role === 'gpt') && lastUser) {
      pairs.push({ question: lastUser, answer: content })
      lastUser = null
    }
  }
  return pairs
}

async function listParquetFiles() {
  const out = []
  async function walk(path) {
    const url = `https://huggingface.co/api/datasets/${REPO}/tree/main${path ? '/' + path : ''}`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${hfToken}` } })
    if (!r.ok) return
    const items = await r.json()
    for (const item of items) {
      const p = path ? `${path}/${item.path}` : item.path
      if (item.type === 'directory') await walk(p)
      else if (p.endsWith('.parquet')) out.push(p)
    }
  }
  await walk('')
  return out
}

async function main() {
  console.log('Đang tải Viet-Doc-VQA-flash2 từ Hugging Face (gated)...')
  if (DRY_RUN) console.log('  [DRY-RUN] Chỉ xem cấu trúc, không insert.')

  const files = await listParquetFiles()
  if (!files.length) {
    console.error('Không tìm thấy file parquet.')
    process.exit(1)
  }
  console.log(`Tìm thấy ${files.length} file parquet.`)

  let imported = 0
  let skipped = 0
  let rowCount = 0

  const { downloadFile } = await import('@huggingface/hub')
  const { parquetReadObjects } = await import('hyparquet')
  const repo = { type: 'dataset', name: REPO }

  for (const pf of files) {
    if (rowCount >= MAX_ROWS) break
    let data
    try {
      const blob = await downloadFile({ repo, path: pf, accessToken: hfToken })
      const buffer = await blob.arrayBuffer()
      data = await parquetReadObjects({ file: buffer })
    } catch (e) {
      console.log(`  Bỏ qua ${pf}: ${e.message}`)
      if (e.message?.includes('403')) {
        console.error('\n  Lỗi 403: Token không tải được file. Thử:')
        console.error('  1. Chấp nhận điều khoản tại https://huggingface.co/datasets/5CD-AI/Viet-Doc-VQA-flash2')
        console.error('  2. Tạo token mới (Read) tại https://huggingface.co/settings/tokens')
        console.error('  3. Kiểm tra: huggingface-cli download 5CD-AI/Viet-Doc-VQA-flash2 --repo-type dataset data/data/train-00000-of-00011.parquet')
      }
      continue
    }

    const keys = data[0] ? Object.keys(data[0]) : []
    const colConv = keys.find((k) => /conversation|qn/i.test(k)) || 'conversations'
    const colDesc = keys.find((k) => /description/i.test(k)) || 'Description'

    for (let idx = 0; idx < data.length && rowCount < MAX_ROWS; idx++) {
      const row = data[idx]
      let conv = row[colConv]
      if (typeof conv === 'string') {
        try {
          conv = JSON.parse(conv)
        } catch {
          skipped++
          continue
        }
      }

      const desc = (row[colDesc] || '').trim()
      const pairs = extractQAPairs(conv)

      for (let i = 0; i < pairs.length; i++) {
        const q = (pairs[i].question || '').trim()
        const a = (pairs[i].answer || '').trim()
        if (!q || !a || q.length < 10) {
          skipped++
          continue
        }

        const rec = {
          subject_id: inferSubject(q + ' ' + desc),
          grade_level_id: 'lop-6',
          textbook_set_id: 'ket-noi-tri-thuc',
          lesson_order: null,
          question_text: q,
          options: [a],
          correct_index: 0,
          explanation: null,
          source: 'viet_doc_vqa',
          external_id: `viet_doc_vqa_${pf.replace(/\//g, '_')}_${idx}_${i}`,
        }

        if (DRY_RUN && imported === 0) console.log('Mẫu:', JSON.stringify(rec, null, 2))

        if (!DRY_RUN) {
          try {
            await supabase.from('worksheet_official_questions').insert(rec)
            imported++
          } catch (e) {
            if (!String(e).includes('23505')) console.warn('Lỗi:', e.message)
            skipped++
          }
        } else {
          imported++
        }
      }
      rowCount++
      if (rowCount % 500 === 0) {
        console.log(`  Đã xử lý ${rowCount} dòng, import ${imported}, bỏ qua ${skipped}`)
      }
    }
  }

  console.log(`\nHoàn thành. Tổng import: ${imported}, bỏ qua: ${skipped}`)
  if (DRY_RUN) console.log('Chạy không có --dry-run để thực sự import.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
