/**
 * Kiểm tra file tĩnh cần cho PWA (chạy sau khi có bản build sinh sw.js nếu CI không commit sw).
 * Dùng: node scripts/verify-pwa.mjs
 */
import fs from 'fs'
import path from 'path'

const root = path.join(process.cwd(), 'public')
const required = [
  'push-sw.js',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'icons/apple-touch-icon.png',
]

let failed = false
for (const rel of required) {
  const p = path.join(root, rel)
  if (!fs.existsSync(p)) {
    console.error(`[verify-pwa] Thiếu: public/${rel}`)
    failed = true
  }
}

const swPath = path.join(root, 'sw.js')
if (!fs.existsSync(swPath)) {
  console.warn(
    '[verify-pwa] Chưa có public/sw.js — chạy `npm run build` (next-pwa tạo file này khi NODE_ENV=production).'
  )
} else {
  const sw = fs.readFileSync(swPath, 'utf8')
  if (!sw.includes('workbox') && !sw.includes('importScripts')) {
    console.warn('[verify-pwa] public/sw.js có vẻ không phải bản Workbox/next-pwa.')
  }
}

if (failed) process.exit(1)
console.log('[verify-pwa] OK — icon + push-sw đủ; sw.js kiểm tra như trên.')
