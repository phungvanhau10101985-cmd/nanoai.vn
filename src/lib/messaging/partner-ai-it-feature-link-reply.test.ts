import assert from 'node:assert/strict'
import test from 'node:test'
import {
  absoluteItFeatureLink,
  buildItFeatureLinkReply,
  itFeatureLinksFromRows,
  itFeatureOpenButtonFromPayload,
  itFeatureOpenButtonsFromPayload,
  pickItFeatureLinkSourceRows,
} from '@/lib/messaging/partner-ai-it-feature-link-reply'

const COPY = {
  oneLead: 'Dạ, tính năng {name} nằm tại:',
  manyLead: 'Dạ, em gửi đường dẫn các tính năng phù hợp:',
  clickHint: 'Anh/chị bấm vào link để sử dụng tính năng ạ.',
}

test('feature open button stays on the shop reply, not the customer message', () => {
  const open = {
    kind: 'feature_page',
    href: 'https://nanoai.vn/phuc-dung-anh',
    label: 'Phục dựng ảnh',
    button_label: 'Mở tính năng',
  }
  assert.equal(
    itFeatureOpenButtonFromPayload({
      feature_open: open,
      partner_ai_industry_branch: 'it',
    }),
    null
  )
  assert.deepEqual(
    itFeatureOpenButtonFromPayload({
      source: 'it_feature_link',
      feature_open: open,
    }),
    {
      href: 'https://nanoai.vn/phuc-dung-anh',
      label: 'Phục dựng ảnh',
      buttonLabel: 'Mở tính năng',
    }
  )
})

test('study help menu renders one button per feature', () => {
  const buttons = itFeatureOpenButtonsFromPayload({
    source: 'it_feature_link',
    feature_opens: [
      { kind: 'feature_page', href: 'https://nanoai.vn/ho-tro-lam-bai', label: 'Hỗ trợ làm bài', button_label: 'Hỗ trợ làm bài' },
      { kind: 'feature_page', href: 'https://nanoai.vn/gia-su-ai', label: 'Gia sư AI', button_label: 'Gia sư AI' },
    ],
  })
  assert.deepEqual(
    buttons.map((button) => button.buttonLabel),
    ['Hỗ trợ làm bài', 'Gia sư AI']
  )
})

test('absolute feature link keeps a platform URL and expands a path', () => {
  assert.equal(
    absoluteItFeatureLink('https://nanoai.vn/thu-do-online/1-nguoi', 'http://localhost:3000'),
    'https://nanoai.vn/thu-do-online/1-nguoi'
  )
  assert.equal(
    absoluteItFeatureLink('/thiet-ke-logo', 'https://nanoai.vn'),
    'https://nanoai.vn/thiet-ke-logo'
  )
})

test('feature link rejects shop PDP and China source URLs', () => {
  assert.equal(absoluteItFeatureLink('https://gudo.vn/products/bo-vest', 'https://nanoai.vn'), null)
  assert.equal(absoluteItFeatureLink('https://detail.1688.com/offer/1.html', 'https://nanoai.vn'), null)
  assert.equal(absoluteItFeatureLink('/site/nanoai-ws-un9v/products/abc', 'https://nanoai.vn'), null)
  assert.equal(absoluteItFeatureLink('https://shop.local/thu-do-online/1-nguoi', 'https://nanoai.vn'), null)
})

test('one feature reply is the link plus a click reminder', () => {
  const links = itFeatureLinksFromRows(
    [{ name: 'Thử đồ 1 người', product_url: 'https://nanoai.vn/thu-do-online/1-nguoi' }],
    'https://nanoai.vn'
  )
  const body = buildItFeatureLinkReply(links, COPY)
  assert.match(body, /Thử đồ 1 người/)
  assert.match(body, /https:\/\/nanoai\.vn\/thu-do-online\/1-nguoi/)
  assert.match(body, /bấm vào link để sử dụng tính năng/)
  assert.doesNotMatch(body, /Mua ngay|size|cọc/)
})

test('search can list a few matching feature links and skips rows without a feature URL', () => {
  const links = itFeatureLinksFromRows(
    [
      { name: 'Thiết kế logo', product_url: '/thiet-ke-logo' },
      { name: 'Váy', product_url: 'https://shop.example/products/vay' },
      { name: 'Thiết kế logo', product_url: 'https://nanoai.vn/thiet-ke-logo' },
      { name: 'Tạo banner', product_url: 'https://nanoai.vn/tao-banner' },
    ],
    'https://nanoai.vn'
  )
  assert.deepEqual(
    links.map((link) => link.url),
    ['https://nanoai.vn/thiet-ke-logo', 'https://nanoai.vn/tao-banner']
  )
  const body = buildItFeatureLinkReply(links, COPY)
  assert.match(body, /https:\/\/nanoai\.vn\/thiet-ke-logo/)
  assert.match(body, /https:\/\/nanoai\.vn\/tao-banner/)
  assert.doesNotMatch(body, /shop\.example/)
})

test('policy and other shop intents do not pick a feature row', () => {
  const row = { name: 'Thử đồ 1 người', product_url: 'https://nanoai.vn/thu-do-online/1-nguoi' }
  assert.deepEqual(
    pickItFeatureLinkSourceRows({
      intent: 'policy_or_order_support',
      anchored: row,
      explicitSku: row,
      lastConsulted: row,
      useLastConsulted: true,
      searchRows: [row],
      similarRows: [row],
    }),
    []
  )
  assert.deepEqual(
    pickItFeatureLinkSourceRows({
      intent: 'follow_up_current_product',
      anchored: null,
      explicitSku: null,
      lastConsulted: row,
      useLastConsulted: true,
      searchRows: null,
      similarRows: null,
    }),
    [row]
  )
  assert.equal(
    pickItFeatureLinkSourceRows({
      intent: 'new_product_search',
      anchored: row,
      explicitSku: null,
      lastConsulted: null,
      useLastConsulted: false,
      searchRows: [{ name: 'Tạo banner', product_url: 'https://nanoai.vn/tao-banner' }],
      similarRows: null,
    })[0]?.name,
    'Tạo banner'
  )
})
