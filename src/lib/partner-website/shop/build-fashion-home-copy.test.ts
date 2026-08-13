import assert from 'node:assert/strict'
import test from 'node:test'

import { applyFashionHomeCopyToPages } from '@/lib/partner-website/shop/build-fashion-home-copy'
import type { PartnerWebsitePage } from '@/lib/partner-website/template/partner-website-template-types'

test('Sửa nhanh copy writes into the same pages the React home reads', () => {
  const pages: PartnerWebsitePage[] = [
    {
      slug: '/',
      title: 'Shop',
      sections: [
        { id: 'hero', type: 'hero-v1', props: { title: 'Old', subtitle: 'Sub', ctaText: 'Buy' } },
        { id: 'cats', type: 'categories-v1', props: { title: 'Cats', items: [{ name: 'A', imageUrl: '' }] } },
        { id: 'new', type: 'products-v1', props: { variant: 'new-arrivals', title: 'New' } },
        { id: 'best', type: 'products-v1', props: { variant: 'best-sellers', title: 'Best' } },
      ],
    },
  ]
  const next = applyFashionHomeCopyToPages(pages, {
    heroTitle: 'BỘ MỚI',
    newArrivalsTitle: 'Hàng mới',
  })
  const hero = next[0].sections.find((s) => s.type === 'hero-v1')
  const neu = next[0].sections.find((s) => s.props.variant === 'new-arrivals')
  assert.equal(hero?.props.title, 'BỘ MỚI')
  assert.equal(neu?.props.title, 'Hàng mới')
  assert.equal(pages[0].sections[0].props.title, 'Old')
})
