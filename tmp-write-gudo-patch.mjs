import { writeFileSync } from 'fs'

const COPY = {
  brand: 'gudo.vn',
  slogan: 'gudo.vn - hàng chất giá tốt',
  blurb: 'Shop thời trang online — hàng chất, giá tốt, giao toàn quốc.',
  legal: 'Hộ Kinh Doanh gudo.vn · Mã HKD GUDOVN01',
  contact:
    'Liên hệ qua Chat mua trên website. Địa chỉ trụ sở sẽ cập nhật sau khi hoàn tất đăng ký hộ kinh doanh.',
  email: 'hotro@gudo.vn',
  hours: 'Hỗ trợ qua Chat mua (T2–CN)',
  copyright: '© 2026 gudo.vn · Hộ Kinh Doanh gudo.vn. Bảo lưu mọi quyền.',
  payment: 'Thanh toán: COD · Chuyển khoản · QR SePay',
}

const COMPANY = {
  title: 'Thông tin đơn vị sở hữu website',
  seo: 'Thông tin đơn vị gudo.vn',
  body: '<p>Website <strong>gudo.vn</strong> do <strong>Hộ Kinh Doanh gudo.vn</strong> vận hành.</p><p>Mã hộ kinh doanh: <strong>GUDOVN01</strong> (mã tạm — sẽ cập nhật sau khi hoàn tất đăng ký).</p><p>Địa chỉ trụ sở sẽ được bổ sung sau khi hộ kinh doanh đăng ký xong.</p><p>Email: <a href="mailto:hotro@gudo.vn">hotro@gudo.vn</a>. Khách liên hệ nhanh qua Chat mua trên website.</p>',
}

const CONTACT = {
  title: 'Thông tin liên hệ',
  seo: 'Liên hệ gudo.vn',
  body: '<p>Shop thời trang online <strong>gudo.vn</strong> — hàng chất, giá tốt.</p><p>Email: <a href="mailto:hotro@gudo.vn">hotro@gudo.vn</a></p><p>Chat mua trên website: hỗ trợ T2–CN.</p><p>Địa chỉ trụ sở và số điện thoại cố định sẽ cập nhật sau khi hoàn tất đăng ký hộ kinh doanh.</p>',
}

const src = `const { readFileSync, existsSync } = require('fs')
const { join } = require('path')
const { Pool } = require('pg')
const Redis = require('ioredis')

const COPY = ${JSON.stringify(COPY)}
const COMPANY = ${JSON.stringify(COMPANY)}
const CONTACT = ${JSON.stringify(CONTACT)}
const PID = '37a7cb4b-1faf-44b7-9265-76f2e8dfe248'
const SLUG = 'gudo-vn-3f93'
const APPLY = process.argv.includes('--apply')

function loadEnv(dir) {
  for (const f of ['.env.local', '.env']) {
    const p = join(dir, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\\n')) {
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

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function extractFooter(html) {
  const re = /<footer\\b[^>]*>/i
  const open = re.exec(html)
  if (!open || open.index == null) return null
  const start = open.index
  const tagRe = /<footer\\b[^>]*>|<\\/footer\\s*>/gi
  tagRe.lastIndex = start + open[0].length
  let depth = 1
  let m
  while ((m = tagRe.exec(html))) {
    if (m[0][1] === '/') {
      depth -= 1
      if (depth === 0) {
        return { start, end: m.index + m[0].length, html: html.slice(start, m.index + m[0].length) }
      }
    } else depth += 1
  }
  return null
}

function setTaggedP(block, key, innerHtml) {
  const re = new RegExp('<p\\\\b[^>]*data-pw-gudo-footer=["\\']' + key + '["\\'][^>]*>[\\\\s\\\\S]*?<\\\\/p>', 'i')
  const next = '<p data-pw-gudo-footer="' + key + '">' + innerHtml + '</p>'
  if (re.test(block)) return block.replace(re, next)
  if (/<form\\b[^>]*pw-newsletter/i.test(block)) {
    return block.replace(/(<form\\b[^>]*pw-newsletter)/i, next + '\\n      $1')
  }
  return block
}

function patchFooter(block) {
  let out = block.replace(/188\\.com\\.vn/gi, 'gudo.vn')
  out = out.replace(
    /<p\\b([^>]*\\bpw-shop-footer-name\\b[^>]*)>[\\s\\S]*?<\\/p>/i,
    '<p$1>' + esc(COPY.brand) + '</p>'
  )
  out = out.replace(
    /<p\\b([^>]*\\bpw-shop-footer-hint\\b[^>]*)>[\\s\\S]*?<\\/p>/i,
    (full, attrs) => {
      let a = String(attrs)
      if (/data-pw-seed-slogan=/i.test(a)) {
        a = a.replace(/data-pw-seed-slogan=["\\'][^"\\']*["\\']/i, 'data-pw-seed-slogan="' + esc(COPY.slogan) + '"')
      } else a += ' data-pw-seed-slogan="' + esc(COPY.slogan) + '"'
      return '<p' + a + '>' + esc(COPY.slogan) + '</p>'
    }
  )
  out = setTaggedP(out, 'blurb', esc(COPY.blurb))
  out = setTaggedP(out, 'legal', esc(COPY.legal))
  out = setTaggedP(out, 'contact', esc(COPY.contact))
  out = setTaggedP(out, 'email', '<a href="mailto:' + esc(COPY.email) + '">' + esc(COPY.email) + '</a>')
  out = setTaggedP(out, 'hours', esc(COPY.hours))
  out = out.replace(
    /(<div\\b[^>]*data-pw-footer-kit=["\\']copyright["\\'][^>]*>)\\s*<p>[\\s\\S]*?<\\/p>\\s*<p>[\\s\\S]*?<\\/p>/i,
    '$1\\n    <p>' + esc(COPY.copyright) + '</p>\\n    <p>' + esc(COPY.payment) + '</p>'
  )
  const extras = [
    ['how-to-buy', 'Hướng dẫn mua hàng'],
    ['brand-origin', 'Nguồn gốc & Thương hiệu'],
    ['reviews-policy', 'Chính sách đánh giá'],
    ['trust', 'gudo.vn có uy tín?'],
    ['company', 'Thông tin đơn vị'],
  ]
  if (/data-pw-footer-kit=["\\']col:legal["\\']/i.test(out)) {
    const missing = extras.filter(([key]) => !new RegExp('link:' + key, 'i').test(out))
    if (missing.length) {
      const lis = missing
        .map(
          ([key, label]) =>
            '<li><a href="/site/' +
            SLUG +
            '/' +
            key +
            '" data-pw-el="link" data-pw-footer-kit="link:' +
            key +
            '">' +
            esc(label) +
            '</a></li>'
        )
        .join('')
      out = out.replace(
        /(<nav\\b[^>]*data-pw-footer-kit=["\\']col:legal["\\'][\\s\\S]*?)<\\/ul>/i,
        '$1' + lis + '</ul>'
      )
    }
  }
  return out
}

function patchSlogans(html) {
  return html.replace(
    /<(span|p)\\b([^>]*\\b(?:data-pw-slogan|data-pw-el=["\\']slogan["\\'])[^>]*)>([\\s\\S]*?)<\\/\\1>/gi,
    (full, tag, attrs) => {
      let a = String(attrs)
      if (/data-pw-seed-slogan=/i.test(a)) {
        a = a.replace(/data-pw-seed-slogan=["\\'][^"\\']*["\\']/i, 'data-pw-seed-slogan="' + esc(COPY.slogan) + '"')
      }
      return '<' + tag + a + '>' + esc(COPY.slogan) + '</' + tag + '>'
    }
  )
}

function patchInfo(html, page) {
  let out = html.replace(
    /<(h1)\\b([^>]*\\bdata-pw-info-title\\b[^>]*)>[\\s\\S]*?<\\/\\1>/i,
    '<h1$2>' + esc(page.title) + '</h1>'
  )
  if (/data-pw-info-body/i.test(out)) {
    out = out.replace(
      /<(div|section|article)\\b([^>]*\\bdata-pw-info-body\\b[^>]*)>([\\s\\S]*?)<\\/\\1>/i,
      '<$1$2>' + page.body + '</$1>'
    )
  }
  return out
}

function patchHtml(html, path) {
  if (!html || html.length < 40) return html
  let next = html
  const foot = extractFooter(next)
  if (foot) next = next.slice(0, foot.start) + patchFooter(foot.html) + next.slice(foot.end)
  next = patchSlogans(next)
  if (/^company(?:\\.|$)/i.test(path)) next = patchInfo(next, COMPANY)
  if (/^contact(?:\\.|$)/i.test(path)) next = patchInfo(next, CONTACT)
  return next
}

function parseFiles(raw) {
  if (Array.isArray(raw)) return raw
  if (raw && Array.isArray(raw.files)) return raw.files
  return []
}

async function bumpSite(slug) {
  const url = String(process.env.REDIS_URL || '').trim()
  if (!url) {
    console.log('redis skip')
    return
  }
  const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 800, commandTimeout: 800 })
  try {
    const n = await redis.incr('pw:site:' + slug + ':ver')
    console.log('redis site ver', n)
  } finally {
    redis.disconnect()
  }
}

async function upsertPage(pool, slug, page) {
  const existing = await pool.query(
    'select id::text from messaging_partner_static_pages where partner_id = $1::uuid and slug = $2',
    [PID, slug]
  )
  if (existing.rows[0]) {
    await pool.query(
      "update messaging_partner_static_pages set title=$3, content=$4, seo_title=$5, seo_description=$6, seo_index=true, is_published=true, updated_at=timezone('utc'::text, now()) where partner_id=$1::uuid and slug=$2",
      [PID, slug, page.title, page.body, page.seo, page.seo]
    )
    return 'updated'
  }
  await pool.query(
    'insert into messaging_partner_static_pages (partner_id, slug, title, content, seo_title, seo_description, seo_index, is_published) values ($1::uuid,$2,$3,$4,$5,$6,true,true)',
    [PID, slug, page.title, page.body, page.seo, page.seo]
  )
  return 'inserted'
}

async function main() {
  loadEnv(process.cwd())
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  try {
    const row = await pool.query(
      'select id::text, project_files_json, theme_json, html_source from messaging_partner_websites where partner_id = $1::uuid',
      [PID]
    )
    if (!row.rows[0]) throw new Error('website missing')
    const project = row.rows[0].project_files_json
    const files = parseFiles(project)
    let changed = 0
    const nextFiles = files.map((f) => {
      if (!f || typeof f !== 'object') return f
      const path = String(f.path || '')
      const content = String(f.content || '')
      if (!/\\.html$/i.test(path)) return f
      const patched = patchHtml(content, path.replace(/^.*\\//, ''))
      if (patched !== content) changed += 1
      return Object.assign({}, f, { content: patched })
    })
    const theme =
      row.rows[0].theme_json && typeof row.rows[0].theme_json === 'object' ? Object.assign({}, row.rows[0].theme_json) : {}
    theme.slogan = COPY.slogan
    const htmlSource = patchHtml(String(row.rows[0].html_source || ''), 'index.html')
    console.log('files_changed', changed, '/', files.length)
    const sample = nextFiles.find((f) => f.path === 'index.html')
    const foot = sample ? extractFooter(sample.content) : null
    console.log('sample_footer_head')
    console.log(foot ? foot.html.slice(0, 2200) : 'none')
    if (!APPLY) {
      console.log('dry-run (pass --apply to write)')
      return
    }
    const nextProject = Array.isArray(project) ? nextFiles : Object.assign({}, project, { files: nextFiles })
    await pool.query(
      "update messaging_partner_websites set project_files_json=$2::jsonb, theme_json=$3::jsonb, html_source=$4, updated_at=timezone('utc'::text, now()) where partner_id=$1::uuid",
      [PID, JSON.stringify(nextProject), JSON.stringify(theme), htmlSource]
    )
    console.log('cms_company', await upsertPage(pool, 'company', COMPANY))
    console.log('cms_contact', await upsertPage(pool, 'contact', CONTACT))
    await bumpSite(SLUG)
    console.log('applied', SLUG)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
`

writeFileSync(new URL('./tmp-patch-gudo-footer.cjs', import.meta.url), src, 'utf8')
console.log('wrote patcher', src.length)
