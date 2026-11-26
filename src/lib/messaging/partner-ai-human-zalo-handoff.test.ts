import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyHumanZaloHandoff,
  humanZaloButtonFromPayload,
  humanZaloHandoffCopy,
  HUMAN_ZALO_HANDOFF_SOURCE,
} from './partner-ai-human-zalo-handoff'

const PUNT = 'Dạ, anh/chị vui lòng bấm **Mua** trên thẻ sản phẩm mình muốn đặt.'
const ASK_CODE = 'Chị cho em xin mã đơn hoặc số điện thoại đặt hàng để em kiểm tra.'

test('a real person, a stuck checkout, an unfinished deposit, and no answer hand off immediately', () => {
  assert.equal(
    classifyHumanZaloHandoff({ inbound: 'có người chat trực tiếp không? Không thích nói chuyện với AI' }),
    'human_requested'
  )
  assert.equal(
    classifyHumanZaloHandoff({ inbound: 'bác đã ấn vào mua ngay nhưng làm mãi không được' }),
    'checkout_stuck'
  )
  assert.equal(
    classifyHumanZaloHandoff({ inbound: 'Minh coc roi nhu ben app no chua hoan thanh' }),
    'deposit_incomplete'
  )
  assert.equal(
    classifyHumanZaloHandoff({ inbound: 'Gọi thì không liên lạc được. Đúng là lừa đảo' }),
    'order_unreachable'
  )
})

test('fabric, warmth, pockets, and washing need a person', () => {
  assert.equal(
    classifyHumanZaloHandoff({ inbound: 'Thành phần vải thực tế. Độ dày và xuất xứ.' }),
    'spec_needs_human'
  )
  assert.equal(
    classifyHumanZaloHandoff({ inbound: 'áo giữ ấm được ở nhiệt độ bao nhiêu' }),
    'spec_needs_human'
  )
  assert.equal(classifyHumanZaloHandoff({ inbound: 'Túi có mấy ngăn' }), 'spec_needs_human')
  assert.equal(classifyHumanZaloHandoff({ inbound: 'Đá này giặt máy được không' }), 'spec_needs_human')
})

test('size advice, a first-order discount, and same-day delivery stay in chat', () => {
  assert.equal(classifyHumanZaloHandoff({ inbound: 'Cao 1m70 nặng 74kg mình thường mặc size L' }), null)
  assert.equal(classifyHumanZaloHandoff({ inbound: 'ủa sao giảm 10% mua hàng lần đầu mất rồi' }), null)
  assert.equal(classifyHumanZaloHandoff({ inbound: 'trên thẻ ghi giao trong ngày' }), null)
  assert.equal(classifyHumanZaloHandoff({ inbound: 'lấy thêm cho người nhà' }), null)
})

test('a repeated purchase after the shop said to press Buy hands off', () => {
  assert.equal(
    classifyHumanZaloHandoff({
      inbound: 'mình lấy 1 cái màu đen size L',
      lastOutboundBody: 'Mẫu này form rộng, giá 670.000đ, có màu đen.',
    }),
    null
  )
  assert.equal(
    classifyHumanZaloHandoff({
      inbound: 'mình lấy 1 cái màu đen size L',
      lastOutboundBody: PUNT,
    }),
    'purchase_restated'
  )
})

test('asking for the order code again after a phone or name hands off', () => {
  assert.equal(
    classifyHumanZaloHandoff({
      inbound: '0989123456',
      priorInbound: ['mình đã cọc mà chưa thấy hàng'],
      lastOutboundBody: ASK_CODE,
    }),
    null
  )
  assert.equal(
    classifyHumanZaloHandoff({
      inbound: 'Tên Doãn Quang Hậu',
      priorInbound: ['0989123456', 'mình đã cọc mà chưa thấy hàng'],
      lastOutboundBody: ASK_CODE,
    }),
    'order_lookup_repeated'
  )
})

test('saying the photo is not a match hands off only after the shop replied', () => {
  assert.equal(classifyHumanZaloHandoff({ inbound: 'Không có cái nào giống nhỉ' }), null)
  assert.equal(
    classifyHumanZaloHandoff({
      inbound: 'Không có cái nào giống nhỉ',
      lastOutboundBody: 'Em gửi vài mẫu ba lô bên dưới ạ.',
    }),
    'photo_not_similar'
  )
})

test('the button opens the shop personal Zalo and the sentence names business hours', () => {
  const copy = humanZaloHandoffCopy('vi', 'https://zalo.me/0968659836')
  assert.match(copy.body, /giờ hành chính/)
  assert.match(copy.body, /https:\/\/zalo\.me\/0968659836/)
  assert.equal(copy.buttonLabel, 'Nhắn Zalo')
  assert.equal(humanZaloHandoffCopy('en', 'https://zalo.me/0968659836').buttonLabel, 'Message on Zalo')
  assert.deepEqual(
    humanZaloButtonFromPayload({
      source: HUMAN_ZALO_HANDOFF_SOURCE,
      zalo_personal_open: { href: 'https://zalo.me/0968659836', button_label: 'Nhắn Zalo' },
    }),
    { href: 'https://zalo.me/0968659836', buttonLabel: 'Nhắn Zalo' }
  )
  assert.equal(
    humanZaloButtonFromPayload({
      source: HUMAN_ZALO_HANDOFF_SOURCE,
      zalo_personal_open: { href: 'https://example.com', button_label: 'Nhắn Zalo' },
    }),
    null
  )
})
