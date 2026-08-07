import 'dotenv/config'
import { isPgConfigured } from '../src/lib/db/pool.ts'
import { fetchPartnerProfileForWebsitePg, fetchPartnerWebsiteByPartnerIdPg } from '../src/lib/db/messaging-partner-websites-pg.ts'
import { ensurePartnerWebsiteStudioDraftPg } from '../src/lib/partner-website/ensure-partner-website-studio-draft.ts'
import { getPartnerWebsiteCopy } from '../src/lib/i18n/partner-website-copy.ts'
import { validatePartnerWebsiteSlug } from '../src/lib/partner-website/partner-website-slug.ts'
import { pgQuery } from '../src/lib/db/pg-query.ts'

console.log('pg configured', isPgConfigured())
const partners = await pgQuery('select id::text, slug from messaging_partners limit 5')
console.log('partners', partners)
for (const row of partners) {
  const pid = row.id
  const p = await fetchPartnerProfileForWebsitePg(pid)
  const slugErr = validatePartnerWebsiteSlug(p?.slug ?? '')
  const w = await fetchPartnerWebsiteByPartnerIdPg(pid)
  const t = getPartnerWebsiteCopy('vi')
  let draft = null
  let err = null
  try {
    draft = await ensurePartnerWebsiteStudioDraftPg({
      partnerId: pid,
      locale: 'vi',
      questionTexts: t,
    })
  } catch (e) {
    err = String(e)
  }
  console.log('---', row.slug, {
    slugErr,
    hasWebsite: Boolean(w),
    websitePhase: w?.creationJournal?.phase,
    draft: draft ? { phase: draft.journal.phase, entries: draft.journal.entries.length } : null,
    err,
  })
}
