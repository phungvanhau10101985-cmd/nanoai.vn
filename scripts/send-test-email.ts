/**
 * Gửi một email thử qua SMTP đã cấu hình (.env.local).
 * Chạy từ thư mục gốc project:
 *   npx tsx scripts/send-test-email.ts you@example.com
 */
import { existsSync } from 'node:fs'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { sendSmtpMail, isSmtpConfigured } from '../src/lib/email/smtp'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env')
const localPath = resolve(cwd, '.env.local')
if (existsSync(envPath)) {
  config({ path: envPath })
}
// .env.local ghi đè .env (chuẩn Next.js)
if (existsSync(localPath)) {
  config({ path: localPath, override: true })
}

function printSmtpDiag() {
  const keys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const
  console.error('Kiểm tra biến môi trường (không in giá trị):')
  for (const k of keys) {
    const v = process.env[k]
    const ok = Boolean(v?.trim())
    console.error(`  ${k}:`, ok ? `OK (${String(v).trim().length} ký tự)` : 'THIẾU hoặc chỉ có khoảng trắng')
  }
  console.error('')
  console.error('Nếu đã thêm SMTP vào file: lưu file UTF-8, không BOM, mỗi biến một dòng:')
  console.error('  SMTP_HOST=...')
  console.error('  SMTP_USER=thongbao@nanoai.vn')
  console.error('  SMTP_PASS=...')
  console.error('  SMTP_FROM="NanoAI <thongbao@nanoai.vn>"')
}

const to = process.argv[2]?.trim()
if (!to) {
  console.error('Usage: npx tsx scripts/send-test-email.ts <email@address>')
  process.exit(1)
}

async function main() {
  if (!isSmtpConfigured()) {
    console.error('Thiếu SMTP: cần đủ SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM trong .env.local (hoặc .env).\n')
    printSmtpDiag()
    process.exit(1)
  }

  const r = await sendSmtpMail({
    to,
    subject: '[NanoAI] Thử gửi mail (SMTP)',
    text: [
      'Đây chỉ là email kiểm tra SMTP — không có mã OTP và không có link đăng nhập (đúng thiết kế).',
      '',
      'Email đăng nhập thật (có OTP 6 số + link magic) chỉ được gửi khi bạn nhập email trên trang /auth/login và bấm «Gửi mã OTP».',
      '',
      `Thời điểm gửi thử: ${new Date().toISOString()}`,
    ].join('\n'),
    html: [
      '<p>Đây chỉ là email <strong>kiểm tra SMTP</strong> — <em>không</em> có mã OTP và <em>không</em> có link đăng nhập (đúng thiết kế).</p>',
      '<p>Email đăng nhập thật (có OTP 6 số + link magic) chỉ được gửi khi bạn nhập email trên trang <code>/auth/login</code> và bấm «Gửi mã OTP».</p>',
      `<p style="color:#666;font-size:12px">Thời điểm: ${new Date().toISOString()}</p>`,
    ].join(''),
  })

  if (r.ok) {
    console.log('Đã gửi OK tới', to)
  } else {
    console.error('Gửi thất bại:', r.error)
    process.exit(1)
  }
}

void main()
