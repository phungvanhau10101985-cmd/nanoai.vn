const { readFileSync, existsSync } = require('fs')
const { join } = require('path')
const { Pool } = require('pg')
const Redis = require('ioredis')

const PID = '37a7cb4b-1faf-44b7-9265-76f2e8dfe248'
const SLUG = 'gudo-vn-3f93'
const APPLY = process.argv.includes('--apply')
const COMPANY = {
  title: 'Thông tin đơn vị sở hữu website',
  crumb: 'Thông tin đơn vị',
  seo: 'Thông tin đơn vị gudo.vn',
  desc: 'Hộ Kinh Doanh gudo.vn · Mã HKD GUDOVN01. Địa chỉ trụ sở sẽ cập nhật sau khi hoàn tất đăng ký.',
  body:
    '<p>Website <strong>gudo.vn</strong> do <strong>Hộ Kinh Doanh gudo.vn</strong> vận hành.</p>' +
    '<p>Mã hộ kinh doanh: <strong>GUDOVN01</strong> (mã tạm — sẽ cập nhật sau khi hoàn tất đăng ký).</p>' +
    '<p>Địa chỉ trụ sở sẽ được bổ sung sau khi hộ kinh doanh đăng ký xong.</p>' +
    '<p>Email: <a href="mailto:hotro@gudo.vn">hotro@gudo.vn</a>. Khách liên hệ nhanh qua Chat mua trên website.</p>',
}
const DEVICES = ['', '.laptop', '.tablet', '.mobile']

function loadEnv(dir) {
  for (const f of ['.env.local', '.env']) {
    const p = join(dir, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[k]) process.env[k] = v
    }
  }
}

function parseFiles(raw) {
  if (Array.isArray(raw)) return raw
  if (raw && Array.isArray(raw.files)) return raw.files
  return []
}

function replaceTaggedBlock(html, attr, inner) {
  const re = new RegExp('<(div|section|article)\\b([^>]*\\b' + attr + '\\b[^>]*)>([\\s\\S]*?)</\\1>', 'i')
  if (!re.test(html)) return html
  return html.replace(re, '<$1$2>' + inner + '</$1>')
}

function makeCompanyFromContact(html) {
  let out = String(html || '')
  out = out.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '<title>' + COMPANY.seo + '</title>')
  out = out.replace(
    /<meta\b([^>]*name=["']description["'][^>]*)>/i,
    (full, attrs) => {
      if (/\bcontent=/i.test(attrs)) {
        return '<meta' + attrs.replace(/\bcontent=(["'])[\s\S]*?\1/i, 'content="' + COMPANY.desc.replace(/"/g, '&quot;') + '"') + '>'
      }
      return '<meta' + attrs + ' content="' + COMPANY.desc.replace(/"/g, '&quot;') + '">'
    }
  )
  out = out.replace(
    /<(h1)\b([^>]*\bdata-pw-info-title\b[^>]*)>[\s\S]*?<\/\1>/i,
    '<h1$2>' + COMPANY.title + '</h1>'
  )
  out = out.replace(
    /(<span\b[^>]*data-pw-el=["']crumb["'][^>]*>)[\s\S]*?(<\/span>)/i,
    (full, open, close, offset, all) => {
      const before = all.slice(0, offset)
      if (/data-pw-el=["']crumb["']/.test(before.slice(before.lastIndexOf('<nav')))) {
        return open + COMPANY.crumb + close
      }
      return full
    }
  )
  // last breadcrumb crumb is the page name
  out = out.replace(
    /(<nav\b[^>]*data-pw-region=["']breadcrumb["'][\s\S]*?<span\b[^>]*data-pw-el=["']crumb["'][^>]*>)[\s\S]*?(<\/span>\s*<\/nav>)/i,
    '$1' + COMPANY.crumb + '$2'
  )
  out = replaceTaggedBlock(out, 'data-pw-info-body', COMPANY.body)
  out = out.replace(/<section\b[^>]*pw-lead-form[\s\S]*?<\/section>/i, '')
  out = out.replace(/data-pw-article-kind=["'][^"']*["']/i, 'data-pw-article-kind="company"')
  out = out.replace(/\/contact(?=["'#?\s>])/g, '/company')
  return out
}

async function bumpSite(slug) {
  const url = String(process.env.REDIS_URL || '').trim()
  if (!url) {
    console.log('redis skip')
    return
  }
  const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 800, commandTimeout: 800 })
  try {
    console.log('redis site ver', await redis.incr('pw:site:' + slug + ':ver'))
  } finally {
    redis.disconnect()
  }
}

async function main() {
  loadEnv(process.cwd())
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  try {
    const row = await pool.query(
      'select id::text, project_files_json, theme_json from messaging_partner_websites where partner_id = $1::uuid',
      [PID]
    )
    if (!row.rows[0]) throw new Error('website missing')
    const project = row.rows[0].project_files_json
    const files = parseFiles(project)
    const byPath = new Map(files.map((f) => [String(f.path || ''), f]))
    let added = 0
    const nextFiles = files.slice()
    for (const suffix of DEVICES) {
      const srcPath = 'contact' + suffix + '.html'
      const dstPath = 'company' + suffix + '.html'
      const src = byPath.get(srcPath)
      if (!src || !src.content) {
        console.log('missing source', srcPath)
        continue
      }
      const content = makeCompanyFromContact(src.content)
      const existing = byPath.get(dstPath)
      if (existing) {
        existing.content = content
        added += 1
        console.log('updated', dstPath, content.length)
      } else {
        const created = { path: dstPath, content }
        nextFiles.push(created)
        byPath.set(dstPath, created)
        added += 1
        console.log('created', dstPath, content.length)
      }
    }
    const theme =
      row.rows[0].theme_json && typeof row.rows[0].theme_json === 'object'
        ? Object.assign({}, row.rows[0].theme_json)
        : {}
    const keys = Array.isArray(theme.visualPageKeys) ? theme.visualPageKeys.slice() : []
    if (!keys.includes('company')) {
      keys.push('company')
      theme.visualPageKeys = keys
      console.log('visualPageKeys +company')
    }
    const sample = byPath.get('company.html')
    const bodyIdx = sample ? String(sample.content).indexOf('data-pw-info-body') : -1
    console.log('sample_body', bodyIdx >= 0 ? JSON.stringify(String(sample.content).slice(bodyIdx, bodyIdx + 420)) : 'none')
    if (!APPLY) {
      console.log('dry-run added', added, '(pass --apply to write)')
      return
    }
    const nextProject = Array.isArray(project) ? nextFiles : Object.assign({}, project, { files: nextFiles })
    await pool.query(
      "update messaging_partner_websites set project_files_json=$2::jsonb, theme_json=$3::jsonb, updated_at=timezone('utc'::text, now()) where partner_id=$1::uuid",
      [PID, JSON.stringify(nextProject), JSON.stringify(theme)]
    )
    await bumpSite(SLUG)
    console.log('applied company pages', added)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
