import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const f of ['.env.local', '.env']) {
  const p = join(root, f)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim()
  }
}

const pid = '02770565-2cbe-4ff1-a63e-77c10d7de584'

const { fetchPartnerWebsiteByPartnerIdPg } = await import(
  '../src/lib/db/messaging-partner-websites-pg.ts'
)
const { ensurePartnerWebsiteStudioDraftPg } = await import(
  '../src/lib/partner-website/ensure-partner-website-studio-draft.ts'
)
const { getPartnerWebsiteCopy } = await import('../src/lib/i18n/partner-website-copy.ts')

console.log('fetch website...')
try {
  const w = await fetchPartnerWebsiteByPartnerIdPg(pid)
  console.log('fetch result:', w ? { id: w.id, slug: w.siteSlug, phase: w.creationJournal.phase, entries: w.creationJournal.entries.length } : null)
} catch (e) {
  console.error('fetch threw', e)
}

console.log('ensure draft...')
const t = getPartnerWebsiteCopy('vi')
const draft = await ensurePartnerWebsiteStudioDraftPg({
  partnerId: pid,
  locale: 'vi',
  questionTexts: t,
  defaultBrandName: '188.com.vn',
})
console.log('ensure result:', draft)
