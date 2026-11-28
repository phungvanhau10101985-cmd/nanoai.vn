import fs from 'fs'
import os from 'os'
import path from 'path'

import { pgQuery } from '@/lib/db/pg-query'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'

const DAY_MS = 24 * 60 * 60 * 1000

export class AiApiStopped extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiApiStopped'
  }
}

export function isAiApiStopped(error: unknown): boolean {
  return error instanceof AiApiStopped || (error instanceof Error && error.name === 'AiApiStopped')
}

type OpenIssue = { detail: string; sent_at: string }

function statePath(): string {
  return path.join(os.tmpdir(), 'nanoai-ai-run-alerts.json')
}

function loadOpen(): Record<string, OpenIssue> {
  try {
    const data = JSON.parse(fs.readFileSync(statePath(), 'utf8')) as { open?: Record<string, OpenIssue> }
    return data.open && typeof data.open === 'object' ? data.open : {}
  } catch {
    return {}
  }
}

function saveOpen(open: Record<string, OpenIssue>): void {
  fs.writeFileSync(statePath(), JSON.stringify({ open }))
}

function due(sentAt: string, now: number): boolean {
  const sent = Date.parse(sentAt || '')
  if (!Number.isFinite(sent)) return true
  return now - sent >= DAY_MS
}

function sameAi(needle: string, name: string): boolean {
  const left = needle.trim().toLowerCase()
  const right = name.trim().toLowerCase()
  if (!left) return true
  if (left.includes(right) || right.includes(left)) return true
  return ['gemini', 'openai', 'deepseek', 'vision'].some((token) => left.includes(token) && right.includes(token))
}

function redact(detail: string): string {
  return detail
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[key]')
    .replace(/sk-[A-Za-z0-9]{10,}/g, '[key]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [key]')
}

const sending = new Set<string>()

export function aiIsPaused(namePart = ''): boolean {
  const needle = namePart.trim().toLowerCase()
  const now = Date.now()
  return Object.entries(loadOpen()).some(([name, row]) => {
    if (needle && !sameAi(needle, name)) return false
    return !due(row?.sent_at || '', now)
  })
}

async function adminEmails(): Promise<string[]> {
  const fromEnv = (process.env.ADMIN_ERROR_NOTIFY_EMAIL || '')
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.includes('@'))
  if (fromEnv.length) return Array.from(new Set(fromEnv))
  try {
    const rows = await pgQuery<{ email: string | null }>(
      `select u.email
       from public.profiles p
       join auth.users u on u.id = p.id
       where p.role = 'admin' and coalesce(u.email, '') <> ''`
    )
    return Array.from(new Set(rows.map((row) => String(row.email || '').trim()).filter((email) => email.includes('@'))))
  } catch {
    return []
  }
}

export async function notifyAiDown(model: string, detail: string): Promise<void> {
  const name = (model || 'AI').trim() || 'AI'
  if (sending.has(name)) return
  sending.add(name)
  const message = redact(String(detail || 'Không rõ lỗi').replace(/\s+/g, ' ').slice(0, 800))
  const now = Date.now()
  const open = loadOpen()
  const row = open[name]
  if (row && !due(row.sent_at, now)) {
    open[name] = { ...row, detail: message }
    saveOpen(open)
    sending.delete(name)
    return
  }
  open[name] = { detail: message, sent_at: new Date(now).toISOString() }
  saveOpen(open)
  sending.delete(name)
  if (!isSmtpConfigured()) return
  const recipients = await adminEmails()
  const subject = `[nanoai.vn] Model AI không chạy: ${name}`
  const text = [
    `Model ${name} không chạy được.`,
    '',
    `Lỗi: ${message}`,
    '',
    'Job đang dùng model này đã dừng, không gọi tiếp.',
    'Cần xử lý API key, credit hoặc billing.',
    'Nếu chưa xử lý, email này gửi lại mỗi 24 giờ.',
  ].join('\n')
  await Promise.all(recipients.map((to) => sendSmtpMail({ to, subject, text }).catch(() => undefined)))
}

export function markAiOk(model: string): void {
  const name = (model || '').trim()
  if (!name) return
  const open = loadOpen()
  const keys = Object.keys(open).filter((key) => sameAi(name, key))
  if (!keys.length) return
  for (const key of keys) delete open[key]
  saveOpen(open)
}

const DOWN_STATUS = new Set([401, 402, 403, 429])

export function aiHost(url: string): '' | 'Gemini' | 'OpenAI' | 'DeepSeek' {
  const raw = url.toLowerCase()
  if (raw.includes('generativelanguage.googleapis.com')) return 'Gemini'
  if (raw.includes('api.openai.com')) return 'OpenAI'
  if (raw.includes('api.deepseek.com')) return 'DeepSeek'
  return ''
}

export function aiStatusStops(status: number): boolean {
  return DOWN_STATUS.has(status) || status >= 500
}
