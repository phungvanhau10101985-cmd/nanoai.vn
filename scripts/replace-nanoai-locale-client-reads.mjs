/**
 * Thay đoạn parse document.cookie (nanoai_locale) bằng readWebLocaleFromDocumentCookie().
 * Chạy: node scripts/replace-nanoai-locale-client-reads.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const skip = new Set([
  'src/lib/i18n/read-web-locale-cookie.ts',
  'src/lib/i18n/config.ts',
])

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts)$/.test(e.name)) acc.push(p)
  }
  return acc
}

const files = walk(path.join(root, 'src'))
  .map((p) => path.relative(root, p).replace(/\\/g, '/'))
  .filter((rel) => {
    if (skip.has(rel)) return false
    try {
      return fs.readFileSync(path.join(root, rel), 'utf8').includes('nanoai_locale=')
    } catch {
      return false
    }
  })

function addImport(content) {
  if (content.includes("from '@/lib/i18n/read-web-locale-cookie'")) return content
  if (content.startsWith("'use client'")) {
    return content.replace(
      /^'use client'\r?\n/,
      "'use client'\n\nimport { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'\n"
    )
  }
  const m = content.match(/^import /m)
  if (m && m.index != null) {
    return (
      content.slice(0, m.index) +
      "import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'\n" +
      content.slice(m.index)
    )
  }
  return content
}

/** Chuỗi 5 dòng parse cookie nanoai_locale (không gồm .toLowerCase). */
const BLOCK_CORE =
  /document\.cookie\s*\n\s*\.split\(';'\)\s*\n\s*\.map\(\(x\)\s*=>\s*x\.trim\(\)\)\s*\n\s*\.find\(\(x\)\s*=>\s*x\.startsWith\('nanoai_locale='\)\)\s*\n\s*\?\.split\('='\)\[1\]\s*\n\s*\?\.trim\(\)/g

function processFile(relPath) {
  const full = path.join(root, relPath)
  let s = fs.readFileSync(full, 'utf8')
  const original = s

  // 1) Block + optional .toLowerCase() on next lines
  const reWithLower = new RegExp(
    String(BLOCK_CORE.source) + String(/(\s*\n\s*\.toLowerCase\(\))?/.source),
    'g'
  )
  let n = 0
  s = s.replace(reWithLower, () => {
    n++
    return 'readWebLocaleFromDocumentCookie()'
  })

  // 2) Một số file dùng tab / lệch indent — thử pattern lỏng hơn (một lần)
  if (n === 0 && s.includes("nanoai_locale=")) {
    const loose =
      /document\.cookie[\s\S]{0,800}?\.startsWith\('nanoai_locale='\)[\s\S]{0,200}?\?\.trim\(\)(\s*\n\s*\.toLowerCase\(\))?/g
    const matches = s.match(loose)
    if (matches && matches.length === 1) {
      s = s.replace(loose, 'readWebLocaleFromDocumentCookie()')
      n = 1
    }
  }

  if (s === original) return false

  if (s.includes('readWebLocaleFromDocumentCookie')) {
    s = addImport(s)
  }

  fs.writeFileSync(full, s, 'utf8')
  return true
}

let updated = 0
for (const f of files) {
  const rel = f.replace(/\\/g, '/')
  if (skip.has(rel)) continue
  if (processFile(rel)) {
    console.log(rel)
    updated++
  }
}
console.log('done, updated', updated, 'files')
