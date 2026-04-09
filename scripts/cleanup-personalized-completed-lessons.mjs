#!/usr/bin/env node
/**
 * Cần: DATABASE_URL trong .env.local
 */
import { pgQuery, pgQueryRaw } from './pg-query.mjs'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

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

const PERSONALIZATION_PATTERNS = [
  /\bmy\s+name\b/i,
  /\bmy\s+name(?:\s+is|\s*'s)?\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}(?:\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}){0,3}\b/u,
  /\bmy\s+name\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}(?:\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}){0,3}\b/u,
  /(?:tên\s+(?:tôi|em|mình|anh|chị)\s+là)\s+[^\n,.!?;:]{1,80}/iu,
  /我叫[^\n。！？!?，,]{1,40}/u,
  /(?:私の名前は|僕の名前は|俺の名前は)[^\n。！？!?，,]{1,40}(?:です|だ)?/u,
  /(?:제\s*이름은|내\s*이름은)\s*[^\n.!?]{1,40}/u,
  /मेरा\s+नाम\s+[^\n।.!?]{1,40}/u,
  /\bhttps?:\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]+\s*(?:\.|\s+dot\s+|\s+chấm\s+)\s*(?:com|vn|net|org|io)\b/i,
  /\b\d{2,}\s*com\s*vn\b/i,
]

function hasPersonalizationSignals(text) {
  const s = String(text || '')
  return PERSONALIZATION_PATTERNS.some((re) => re.test(s))
}

function rowHasPersonalizationSignals(transcriptJson) {
  const raw = String(transcriptJson || '').trim()
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw)
    const rows = Array.isArray(parsed) ? parsed : []
    return rows.some((row) => {
      if (!row || typeof row !== 'object') return false
      const fields = [
        row.text,
        row.mainSentence,
        row.main_sentence,
        row.correctionNote,
        row.correction_note,
        row.intentAnswer,
        row.intent_answer,
      ]
      return fields.some((x) => hasPersonalizationSignals(String(x || '')))
    })
  } catch {
    return hasPersonalizationSignals(raw)
  }
}

async function main() {
  let offset = 0
  const pageSize = 500
  const flaggedIds = []

  while (true) {
    const data = await pgQuery(
      `select id, transcript_json from language_coach_completed_lessons order by id asc limit $1 offset $2`,
      [pageSize, offset]
    )

    if (!Array.isArray(data) || data.length === 0) break

    for (const row of data) {
      if (rowHasPersonalizationSignals(row.transcript_json)) {
        flaggedIds.push(row.id)
      }
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  if (flaggedIds.length === 0) {
    console.log('No personalized completed lessons found.')
    return
  }

  let deleted = 0
  const chunk = 200
  for (let i = 0; i < flaggedIds.length; i += chunk) {
    const part = flaggedIds.slice(i, i + chunk)
    const res = await pgQueryRaw(`delete from language_coach_completed_lessons where id = any($1::uuid[])`, [part])
    if (res.rowCount == null) {
      console.error('Delete failed')
      process.exit(1)
    }
    deleted += res.rowCount
  }

  console.log(`Deleted personalized completed lessons: ${deleted}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
