// Smoke test (W2.3 theme colors + W2.4 section reorder): API PATCH trực tiếp (không qua chat AI).
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev), user dev@local.test có trong auth.users.
// Chạy: npx tsx scripts/test-w2_3-w2_4-theme-sections.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users where lower(email) = 'dev@local.test' limit 1`)
  assert(ownerRes.rows.length, "cần user dev@local.test trong auth.users (dev bypass)")
  const ownerId = ownerRes.rows[0].id as string

  const tag = Date.now().toString(36)
  const siteSlug = `w2-3-4-shop-${tag}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug) values ($1::uuid, 'W2.3/W2.4 Test Shop', $2) returning id`,
    [ownerId, siteSlug]
  )
  const partnerId = partnerRes.rows[0].id as string

  const theme = {
    primaryColor: '#f97316',
    accentColor: '#ea580c',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    mutedColor: '#6b7280',
    fontFamily: '"Outfit", sans-serif',
  }
  const pages = [
    {
      slug: '/',
      title: 'Home',
      sections: [
        { id: 'sec-hero', type: 'hero-v1', props: { title: 'Hero' } },
        { id: 'sec-categories', type: 'categories-v1', props: { title: 'Danh mục' } },
        { id: 'sec-faq', type: 'faq-v1', props: { title: 'FAQ' } },
      ],
    },
  ]
  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, brief_text, render_mode, template_id, theme_json, pages_json, locale)
     values ($1::uuid, $2, 'W2.3/W2.4 Test Shop', 'Test', 'template', 'commerce-blue', $3::jsonb, $4::jsonb, 'vi')`,
    [partnerId, siteSlug, JSON.stringify(theme), JSON.stringify(pages)]
  )

  console.log('Seed OK. partnerId =', partnerId, ' siteSlug =', siteSlug)

  try {
    // 1) W2.4 — reorder: đảo vị trí hero <-> categories.
    const reorderRes = await fetch(`${BASE}/api/messaging/partner-website/${partnerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reorder_sections',
        pageSlug: '/',
        sectionIds: ['sec-categories', 'sec-hero', 'sec-faq'],
      }),
    })
    const reorderText = await reorderRes.text()
    assert(reorderRes.status === 200, `reorder_sections thất bại: ${reorderRes.status} ${reorderText}`)
    const reorderJson = JSON.parse(reorderText) as { website: { pages: Array<{ slug: string; sections: Array<{ id: string }> }> } }
    const homePage = reorderJson.website.pages.find((p) => p.slug === '/')
    assert(homePage, 'phải có trang home trong response')
    assert(
      homePage!.sections.map((s) => s.id).join(',') === 'sec-categories,sec-hero,sec-faq',
      `thứ tự section phải đúng như yêu cầu, thực tế: ${homePage!.sections.map((s) => s.id).join(',')}`
    )
    console.log('OK PATCH action=reorder_sections: sắp xếp đúng thứ tự, không qua chat AI')

    // 2) W2.4 — reorder với id sai (mismatch) phải bị từ chối, không làm hỏng dữ liệu.
    const badReorderRes = await fetch(`${BASE}/api/messaging/partner-website/${partnerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder_sections', pageSlug: '/', sectionIds: ['sec-hero', 'khong-ton-tai'] }),
    })
    assert(badReorderRes.status === 400, `reorder với id sai phải trả 400, thực tế ${badReorderRes.status}`)
    console.log('OK reorder với sectionIds sai (mismatch/không tồn tại) bị từ chối đúng 400')

    // 3) W2.3 — update_theme_colors: đổi 2 màu, giữ nguyên các field khác (fontFamily không đổi).
    const themeRes = await fetch(`${BASE}/api/messaging/partner-website/${partnerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_theme_colors', themeColors: { primaryColor: '#111111', accentColor: '#222222' } }),
    })
    const themeText = await themeRes.text()
    assert(themeRes.status === 200, `update_theme_colors thất bại: ${themeRes.status} ${themeText}`)
    const themeJson = JSON.parse(themeText) as { website: { theme: Record<string, unknown> } }
    assert(themeJson.website.theme.primaryColor === '#111111', `primaryColor phải đổi đúng, thực tế ${themeJson.website.theme.primaryColor}`)
    assert(themeJson.website.theme.accentColor === '#222222', `accentColor phải đổi đúng, thực tế ${themeJson.website.theme.accentColor}`)
    assert(themeJson.website.theme.backgroundColor === '#ffffff', `backgroundColor KHÔNG được đổi (không truyền lên), thực tế ${themeJson.website.theme.backgroundColor}`)
    assert(themeJson.website.theme.fontFamily === theme.fontFamily, 'fontFamily phải giữ nguyên, không đụng field khác')
    console.log('OK PATCH action=update_theme_colors: đổi đúng màu được chọn, giữ nguyên field khác, không qua chat AI')

    // 4) Giá trị màu không hợp lệ (không phải #rrggbb) phải bị từ chối.
    const invalidColorRes = await fetch(`${BASE}/api/messaging/partner-website/${partnerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_theme_colors', themeColors: { primaryColor: 'not-a-color' } }),
    })
    assert(invalidColorRes.status === 400, `màu không hợp lệ phải trả 400, thực tế ${invalidColorRes.status}`)
    console.log('OK giá trị màu không hợp lệ (không phải #rrggbb) bị từ chối đúng 400')

    // 5) KHOÁ khi useVisualHtml=true — cả 2 action phải bị chặn 409, không âm thầm ghi đè dữ liệu vô nghĩa.
    await pool.query(
      `update public.messaging_partner_websites set theme_json = theme_json || '{"useVisualHtml": true}'::jsonb where partner_id = $1::uuid`,
      [partnerId]
    )
    const lockedReorderRes = await fetch(`${BASE}/api/messaging/partner-website/${partnerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder_sections', pageSlug: '/', sectionIds: ['sec-hero', 'sec-categories', 'sec-faq'] }),
    })
    assert(lockedReorderRes.status === 409, `reorder khi useVisualHtml=true phải bị khoá 409, thực tế ${lockedReorderRes.status}`)
    const lockedThemeRes = await fetch(`${BASE}/api/messaging/partner-website/${partnerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_theme_colors', themeColors: { primaryColor: '#333333' } }),
    })
    assert(lockedThemeRes.status === 409, `update_theme_colors khi useVisualHtml=true phải bị khoá 409, thực tế ${lockedThemeRes.status}`)
    console.log('OK cả 2 action bị khoá đúng 409 khi site đang dùng chế độ Sửa nhanh (useVisualHtml=true) — không ghi đè vô nghĩa lên HTML thô')

    console.log('\n✅ ALL W2.3 (theme colors) + W2.4 (section reorder) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
