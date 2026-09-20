/**
 * Heuristic scan of shop chat inbound→outbound pairs (last 4 days).
 * Flags likely mismatched / unreasonable AI replies for human review.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const csvPath = process.argv[2]
const outPath = process.argv[3] || csvPath.replace(/pairs\.csv$/, 'flagged.json')
const raw = readFileSync(csvPath, 'utf8')

function parseCsv(text) {
  const rows = []
  let i = 0
  const n = text.length
  const row = []
  let field = ''
  let inQuotes = false
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push([...row])
      row.length = 0
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  const header = rows[0]
  return rows.slice(1).filter((r) => r.length >= header.length - 1 && r[0]).map((r) => {
    const o = {}
    for (let k = 0; k < header.length; k++) o[header[k]] = r[k] ?? ''
    return o
  })
}

const rows = parseCsv(raw)

const CORRECTION = /không phải|ko phải|hong phải|sai rồi|sai r[oồ]i|không đúng|ko đúng|không phải cái|không phải mẫu|nhầm|không phải sp|không phải sản phẩm|đâu phải|lộn rồi|không phải túi|không phải giày|không phải dép|không phải váy|khác cái này|không phải cái này|ý em không phải|ý mình không|không hỏi cái này|trả lời sai/i
const DISSATISFIED = /không khớp|không giống|ko giống|không đúng mẫu|không phải ý|không liên quan|lạc đề|trả lời gì vậy|không hiểu|ko hiểu|trả lời lung tung|không phải vậy/i
const GENERIC_CLARIFY = /anh\/chị đang tìm|bạn đang tìm|để em hiểu đúng|cho em xin thêm|em chưa rõ|mình chưa rõ|đang cần tư vấn mẫu nào|túi nam hay túi nữ|đi làm hay đi chơi/i
const SIZE_Q = /size\s*(bao nhiêu|nào|mấy)|thường đi size|chân dài|chiều cao|nặng bao nhiêu|cân nặng/i
const ASK_PRODUCT = /có\s*(mẫu|hàng|size|màu)|còn\s*(hàng|size|màu)|giá|bao nhiêu|ship|cọc|đặt|mua|có không|có ko|có hong|có hông/i
const SHOE = /giày|sandal|dép|gót|cao gót|sneaker|boot|boots|bốt/i
const BAG = /túi|clutch|ví |balo|backpack/i
const DRESS = /váy|đầm|áo |quần |set đồ|jum|jumpsuit/i
const POLICY = /đổi trả|đổi size|bảo hành|chính sách|cọc|ship|phí vận chuyển|bao lâu|mấy ngày|nhận hàng|xem hàng|thanh toán|cod|chuyển khoản/i
const ORDER = /đơn hàng|mã đơn|dh\d|đã đặt|đã cọc|theo dõi|giao chưa|về chưa|ems|vận đơn/i
const STORE = /cửa hàng|showroom|xem trực tiếp|tới shop|địa chỉ shop|offline|xem được túi|xem dc túi|xem được giày/i

function productFamily(text) {
  const t = String(text || '')
  const fams = []
  if (SHOE.test(t)) fams.push('giày')
  if (BAG.test(t)) fams.push('túi')
  if (DRESS.test(t)) fams.push('áo/váy')
  return fams
}

function flagsOf(r) {
  const flags = []
  const inn = r.inbound_body || ''
  const out = r.outbound_body || ''
  const next = r.next_inbound_body || ''
  const human = String(r.human_reply) === 't'
  const humanAfter = String(r.human_after_ai) === 't'
  const cards = Number(r.card_count || 0)
  const cardNames = r.card_names || ''
  const intent = r.route_intent || ''
  const lag = r.reply_lag_sec === '' ? null : Number(r.reply_lag_sec)

  if (!r.outbound_id) flags.push('no_reply_20m')
  if (humanAfter) flags.push('human_takeover_45m')
  if (CORRECTION.test(next) || DISSATISFIED.test(next)) flags.push('customer_correction_next')
  if (CORRECTION.test(inn) && r.outbound_id) flags.push('customer_said_wrong_then_ai')

  const inFam = productFamily(inn)
  const outFam = productFamily(out + ' ' + cardNames)
  if (inFam.length === 1 && outFam.length && !outFam.includes(inFam[0]) && ASK_PRODUCT.test(inn)) {
    flags.push(`category_mismatch:${inFam[0]}→${outFam.join(',')}`)
  }

  if (STORE.test(inn) && /túi nam hay túi nữ|đi làm hay đi chơi/.test(out)) {
    flags.push('store_question_pivoted_to_gender')
  }

  if (POLICY.test(inn) && cards > 0 && !/mẫu|sản phẩm|giày|túi|váy/.test(inn)) {
    flags.push('policy_question_got_cards')
  }
  if (ORDER.test(inn) && cards > 1) flags.push('order_question_got_carousel')

  if (
    intent === 'clarify' &&
    GENERIC_CLARIFY.test(out) &&
    (ASK_PRODUCT.test(inn) || POLICY.test(inn) || STORE.test(inn) || inn.length > 25)
  ) {
    flags.push('over_clarify_specific_question')
  }

  if (intent === 'new_product_search' && cards === 0 && ASK_PRODUCT.test(inn) && inn.length > 8) {
    flags.push('search_with_zero_cards')
  }

  if (SIZE_Q.test(out) && /size\s*\d+|size\s*[smlx]|đi\s*size|size\s*bao nhiêu/i.test(inn) && !/chưa rõ size|size nào/.test(inn)) {
    flags.push('asked_size_already_given')
  }

  if (lag != null && lag > 180 && !human) flags.push('slow_ai_over_3m')

  // Same outbound reused for two rapid inbounds (debounce/merge issue) is OK; flag if reply ignores first distinct question
  if (/không dám hứa|không kịp chắc|hơi sát/.test(out) && /cọc|đã đặt|đã lên đơn/.test(out) && !/cọc|đặt|đơn/.test(inn) && /nhận kịp|nhanh không|bao lâu/.test(inn)) {
    flags.push('assumed_order_exists')
  }

  return flags
}

const flagged = []
const byFlag = {}
for (const r of rows) {
  const flags = flagsOf(r)
  if (!flags.length) continue
  const item = {
    flags,
    inbound_at: r.inbound_at,
    shop: r.shop,
    customer: r.customer_name,
    conversation_id: r.conversation_id,
    inbound_id: r.inbound_id,
    inbound: r.inbound_body,
    outbound: r.outbound_body,
    intent: r.route_intent,
    branch: r.pipeline_branch,
    cards: r.card_count,
    card_names: r.card_names,
    next_inbound: r.next_inbound_body,
    human_after: r.human_after_ai_body,
    lag: r.reply_lag_sec,
    has_image: r.has_image,
    page_sku: r.page_sku,
  }
  flagged.push(item)
  for (const f of flags) {
    byFlag[f] = (byFlag[f] || 0) + 1
  }
}

const summary = {
  pairs: rows.length,
  flagged: flagged.length,
  byFlag,
}

writeFileSync(outPath, JSON.stringify({ summary, flagged }, null, 2), 'utf8')
console.log(JSON.stringify(summary, null, 2))
console.log('wrote', outPath)
