import type { Database, Json } from '@/types/database.types'
import { fetchCustomerCareTranscriptLinesFromPg } from '@/lib/db/customer-care-pg'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchInventoryRowsByExplicitSku,
  fetchInventoryRowsForPartnerAi,
  PARTNER_AI_INVENTORY_CONTEXT_LIMIT,
} from '@/lib/messaging/partner-inventory-ai-search'
import { enrichInventoryRowsWithMaterialIfNeeded } from '@/lib/messaging/partner-inventory-material-enrichment'
import {
  enrichInventoryMaterialDetailCollageIfNeeded,
  type PartnerMaterialDetailFollowup,
} from '@/lib/messaging/partner-inventory-material-detail-image'
import { fetchLastConsultedInventoryRowFromConversationPg } from '@/lib/messaging/partner-ai-last-consulted-inventory'
import {
  customerMessageAsksAboutRealUsePhoto,
  enrichInventoryRealUseImageIfNeeded,
  type PartnerRealUseImageFollowup,
} from '@/lib/messaging/partner-inventory-real-use-image'

export type { PartnerMaterialDetailFollowup, PartnerRealUseImageFollowup }

type SettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']

function formatInventoryLines(
  rows: Database['public']['Tables']['messaging_partner_inventory']['Row'][]
): string {
  if (!rows.length) return '(Chưa có mặt hàng nào trong danh sách kho.)'
  return rows
    .map((r, i) => {
      const sku = r.sku?.trim() ? ` [Mã/SKU: ${r.sku.trim()}]` : ''
      const stock = r.stock_note?.trim() ? ` | Tồn kho: ${r.stock_note.trim()}` : ''
      const price = r.price_hint?.trim() ? ` | Giá: ${r.price_hint.trim()}` : ''
      const desc = r.description?.trim() ? ` — Thông số/mô tả: ${r.description.trim()}` : ''
      const img = r.image_url?.trim()
        ? ` | Ảnh chính sản phẩm (URL — nguồn duy nhất để tạo ảnh chi tiết chất liệu và ảnh đời thường/góc tự nhiên): ${r.image_url.trim()}`
        : ''
      const pu = r.product_url?.trim()
      const page =
        pu && /^https?:\/\//i.test(pu) ? ` | Trang sản phẩm (URL): ${pu}` : ''
      const pv = r.product_video_url?.trim()
      const video =
        pv && /^https?:\/\//i.test(pv) ? ` | Video sản phẩm (URL): ${pv}` : ''
      const extra = r.consult_note?.trim() ? ` | Ghi chú tư vấn: ${r.consult_note.trim()}` : ''
      const mat = r.material_note?.trim() ? ` | Chất liệu (đã lưu/kho): ${r.material_note.trim()}` : ''
      const matImg = r.material_detail_image_url?.trim()
        ? ` | Ảnh chi tiết chất liệu/màu (đã lưu, sinh từ ảnh chính): ${r.material_detail_image_url.trim()}`
        : ''
      const ru1 = r.real_use_image_url?.trim()
      const ru2 = r.real_use_image_url_2?.trim()
      const realUseImg =
        ru1 || ru2
          ? ` | Ảnh đời thường — nhìn sản phẩm chân thực (đã lưu${ru1 && ru2 ? ', tối đa 2 ảnh' : ''}, sinh từ ảnh chính):${ru1 ? ` [1] ${ru1}` : ''}${ru2 ? ` [2] ${ru2}` : ''}`
          : ''
      return `${i + 1}. ${r.name.trim()}${sku}${desc}${mat}${img}${matImg}${realUseImg}${stock}${price}${page}${video}${extra}`
    })
    .join('\n')
}

function visionCatalogNoHitsFromTrigger(raw: Json | null | undefined): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  return (raw as { vision_catalog_no_hits?: unknown }).vision_catalog_no_hits === true
}

function selectedInventoryIdFromTrigger(raw: Json | null | undefined): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as { vision_selected_inventory_id?: unknown }).vision_selected_inventory_id
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export async function buildPartnerAiContext(
  partnerId: string,
  conversationId: string,
  settings: SettingsRow,
  latestCustomerMessage: string,
  triggerRawPayload?: Json | null
): Promise<{
  system: string
  user: string
  materialDetailFollowup: PartnerMaterialDetailFollowup | null
  realUseFollowup: PartnerRealUseImageFollowup | null
}> {
  let explicitSkuRows = await fetchInventoryRowsByExplicitSku(partnerId, latestCustomerMessage)
  const selectedInventoryId = selectedInventoryIdFromTrigger(triggerRawPayload)
  const inv = await fetchInventoryRowsForPartnerAi(partnerId, latestCustomerMessage)
  let selectedRowBlock = ''
  let invForContext = inv
  let selectedRowForEnrich: Database['public']['Tables']['messaging_partner_inventory']['Row'] | null = null
  if (selectedInventoryId && isPgConfigured()) {
    try {
      const sel = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, selectedInventoryId)
      if (sel) {
        selectedRowForEnrich = sel
        invForContext = [sel, ...inv.filter((r) => r.id !== sel.id)]
      }
    } catch (e) {
      console.warn('[partner-ai-llm] selected inventory PG failed', e)
    }
  }

  let lastConsultedRow: Database['public']['Tables']['messaging_partner_inventory']['Row'] | null = null
  if (isPgConfigured()) {
    try {
      lastConsultedRow = await fetchLastConsultedInventoryRowFromConversationPg(partnerId, conversationId)
    } catch (e) {
      console.warn('[partner-ai-llm] lastConsulted inventory', e)
    }
  }
  if (lastConsultedRow) {
    const lid = lastConsultedRow.id
    if (!invForContext.some((r) => r.id === lid)) {
      invForContext = [lastConsultedRow, ...invForContext.filter((r) => r.id !== lid)].slice(
        0,
        PARTNER_AI_INVENTORY_CONTEXT_LIMIT
      )
    }
  }

  const materialEnriched = await enrichInventoryRowsWithMaterialIfNeeded(partnerId, latestCustomerMessage, {
    explicitSkuRows,
    invForContext,
    selectedRow: selectedRowForEnrich,
  })
  explicitSkuRows = materialEnriched.explicitSkuRows
  invForContext = materialEnriched.invForContext
  selectedRowForEnrich = materialEnriched.selectedRow

  let materialDetailFollowup: PartnerMaterialDetailFollowup | null = null
  let realUseFollowup: PartnerRealUseImageFollowup | null = null
  let realUsePhotoLimitExceeded = false

  if (customerMessageAsksAboutRealUsePhoto(latestCustomerMessage)) {
    const realEnriched = await enrichInventoryRealUseImageIfNeeded(partnerId, conversationId, latestCustomerMessage, {
      explicitSkuRows,
      invForContext,
      selectedRow: selectedRowForEnrich,
      lastConsultedRow,
    })
    explicitSkuRows = realEnriched.explicitSkuRows
    invForContext = realEnriched.invForContext
    selectedRowForEnrich = realEnriched.selectedRow
    realUseFollowup = realEnriched.realUseFollowup
    realUsePhotoLimitExceeded = realEnriched.realUsePhotoLimitExceeded
  } else {
    const collageEnriched = await enrichInventoryMaterialDetailCollageIfNeeded(partnerId, latestCustomerMessage, {
      explicitSkuRows,
      invForContext,
      selectedRow: selectedRowForEnrich,
      lastConsultedRow,
    })
    explicitSkuRows = collageEnriched.explicitSkuRows
    invForContext = collageEnriched.invForContext
    selectedRowForEnrich = collageEnriched.selectedRow
    materialDetailFollowup = collageEnriched.materialDetailFollowup
  }

  if (selectedRowForEnrich) {
    selectedRowBlock = `\n\nMặt hàng khách đã CHỌN từ danh sách ảnh gợi ý (ưu tiên cao nhất, chỉ tư vấn theo hàng này nếu không có yêu cầu đổi mẫu):\n${formatInventoryLines([selectedRowForEnrich])}

Bắt buộc (khi khách chưa đổi sang mẫu khác): trả lời bằng cách **nêu ưu điểm / giá trị cho khách** — tự tin hơn, chỉn chu, tôn dáng, gọn gàng, phù hợp dịp mặc, dễ phối đồ… — diễn giải từ đúng các trường trong dòng kho (tên, mô tả, ghi chú tư vấn, chất liệu/kiểu nếu có); không chỉ đọc máy mã/giá. Không bịa công dụng y tế hay hứa hiệu quả tuyệt đối.`
  }

  let chronological: {
    direction: string
    body: string
    created_at: string
    raw_payload: Json | null
  }[] | null = null
  if (isPgConfigured()) {
    try {
      chronological = await fetchCustomerCareTranscriptLinesFromPg(conversationId, 14)
    } catch (e) {
      console.warn('[partner-ai-llm] transcript PG failed', e)
    }
  }
  if (chronological === null) {
    chronological = []
  }
  const transcript = chronological
    .map((m) => {
      const label = m.direction === 'inbound' ? 'Khách' : 'Shop'
      const pl = m.raw_payload as { guest_media?: { kind?: string; url?: string } } | null
      const img = pl?.guest_media?.kind === 'image' && pl.guest_media.url ? pl.guest_media.url : null
      const cap = m.body.replace(/^📷\s*/u, '').trim()
      if (img) {
        const line = [cap || '(ảnh)', img].filter(Boolean).join(' — ')
        return `${label}: ${line}`
      }
      return `${label}: ${m.body}`
    })
    .join('\n')

  const policy = settings.shop_policy?.trim() || '(Shop chưa nhập chính sách.)'
  const tone = settings.tone_instructions?.trim() || 'Lịch sự, ngắn gọn, rõ ràng.'
  const salesExtra = settings.sales_coaching_instructions?.trim() ?? ''
  const salesShopBlock =
    salesExtra.length > 0
      ? `

Chỉ dẫn bổ sung do shop tự nhập (ưu tiên phù hợp ngành hàng / đối tượng khách):
${salesExtra}`
      : ''

  /** Khối mặc định — luôn có; shop mở rộng qua `sales_coaching_instructions` + chính sách. */
  const salesDefaultBlock = `
Hướng tư vấn tăng khả năng mua (mềm, không ép, không spam):
- Khi tư vấn dựa trên **thông tin sản phẩm có trong kho** (tên, mô tả, ghi chú tư vấn, mã, giá, tồn…): đừng chỉ liệt kê thông số — hãy diễn giải thành **ưu điểm và lợi ích cho khách**: mặc lên tự tin hơn, chỉn chu, tôn dáng, gọn gàng, phù hợp dịp (tiệc, đi làm, hằng ngày…), dễ phối đồ hoặc thoải mái khi sử dụng — luôn bám sát dữ liệu thật trong kho; không phóng đại, không khẳng định y học, giảm cân, trị bệnh hay hiệu quả tuyệt đối.
- Khi đã nêu đủ thông tin sản phẩm từ kho, có thể gợi ý nhẹ bước tiếp (size/màu, hoặc chiều cao–cân nặng nếu cần) — **không** ra lệnh, **không** hối chốt. Ưu tiên để khách **tự suy nghĩ**; mời thao tác trên giao diện (đặt hàng, xem thẻ) chỉ khi tự nhiên phù hợp ngữ cảnh.
- **Không** lặp lại cùng kiểu câu hỏi chốt màu/size kiểu "chị chọn hồng hay đen ạ?", "đã chọn được màu chưa?" ở **nhiều tin liên tiếp** — dễ gây cảm giác ép mua. Nếu đã gợi ý một lần, các tin sau **tập trung trả lời đúng câu hỏi** của khách; chỉ nhắc màu/size khi khách hỏi hoặc khi thật cần để tư vấn tiếp.
- Giảm do dự: có thể nhắc một dòng về đổi trả / giao hàng / thanh toán CHỈ khi đã có trong chính sách shop ở trên; không bịa thêm.
- Nhấn mạnh giá trị (phù hợp dáng, dịp mặc, chất liệu) thay vì ép mua; tránh nhiều câu hỏi trong một tin — tối đa một lời mở / gợi ý nhẹ, không xếp hàng nhiều câu hỏi.
- Không hứa giảm giá hay khuyến mãi ngoài chính sách đã cho.${salesShopBlock}`

  const system = `Bạn là trợ lý chat của một cửa hàng trên nền tảng NanoAI. Trả lời bằng tiếng Việt trừ khi khách dùng ngôn ngữ khác thì theo ngôn ngữ khách.
Giọng điệu: ${tone}
Tuân thủ nghiêm các quy tắc / chính sách sau (không bịa điều không có trong dữ liệu):
${policy}
${salesDefaultBlock}
Toàn bộ mặt hàng trong danh sách kho dưới đây đều dùng để tư vấn khách. Chỉ tư vấn sản phẩm/tồn kho dựa trên danh sách đó. Khi giới thiệu hoặc so sánh mặt hàng cụ thể, ưu tiên nói **lợi ích cho khách** (thẩm mỹ, độ phù hợp, sự thoải mái…) xuất phát từ thông tin trong kho, không chỉ đọc giá/mã. Nếu không có đúng sản phẩm trong danh sách, nói rõ chưa thấy thông tin khớp và chuyển hướng tư vấn: hỏi khách có muốn xem sản phẩm tương tự đang có trong kho không.
Khi khách hỏi về chất liệu/vải/vật liệu: ưu tiên trả lời theo trường "Chất liệu (đã lưu/kho)" hoặc mô tả/ghi chú trong dòng kho nếu có; không bịa chất liệu ngoài dữ liệu đã cho.
Trong mỗi dòng kho, **ảnh chính sản phẩm (URL)** là ảnh gốc shop khai báo; hệ thống dùng đúng ảnh đó làm nguồn để tạo (1) ảnh chi tiết chất liệu/màu và (2) ảnh **đời thường / góc tự nhiên** (nhìn sản phẩm chân thực) — không dùng ảnh khác làm nguồn, và **không** gọi các ảnh sinh ra là "ảnh tham khảo" khi nói với khách.
Nếu trong kho có "Ảnh chi tiết chất liệu/màu (đã lưu)" kèm URL, đó là ảnh phóng chi tiết chất liệu/màu **sinh từ ảnh chính** — nhắc khách xem ảnh đính kèm (không cần dán lại URL trong message).
Khi khách hỏi ảnh chụp thực tế / mặc thật / dùng thật: nếu kho có mục **Ảnh đời thường — nhìn sản phẩm chân thực (đã lưu)** kèm URL — đó là ảnh được tạo từ **ảnh chính** theo phong cách **đời thường, góc tự nhiên** để khách **xem sản phẩm chân thực** (không phải ảnh studio); trong **tin gửi khách** giữ giọng thống nhất với chú thích hệ thống (ảnh đời thường / góc tự nhiên / nhìn sản phẩm chân thực), **không** gọi là "ảnh tham khảo", **không** tự nói "ảnh AI" hay "ảnh phần mềm tạo". Không khẳng định ảnh chụp tại showroom/shop trừ khi dữ liệu kho ghi rõ. Khi khách vừa xem thẻ sản phẩm và hỏi ảnh thực tế — mặc định hiểu đúng mẫu đó; không bảo "không có ảnh" nếu hệ thống đang hoặc sắp gửi kèm ảnh. Trong một cuộc chat, tối đa hai ảnh loại này cho cùng một mặt hàng; không hứa gửi thêm khi đã đủ.
Khi khách hỏi tìm hàng theo thuộc tính (ví dụ: loại hàng, màu, kiểu dáng, chất liệu, chiều cao gót, khoảng giá), hãy chủ động đề xuất 2-4 sản phẩm gần nhất từ danh sách kho (nếu có) trong mảng products thay vì chỉ trả lời chung chung.
Nếu không có "khớp tuyệt đối", vẫn ưu tiên đưa các mẫu "khớp gần" đang có trong kho vào products để khách chọn tiếp.
Khi đã có products khác rỗng, message phải thật ngắn (1-2 câu), không liệt kê chi tiết từng mẫu, không bullet dài; có thể mở nhẹ (khách xem thẻ/ảnh khi muốn), **không** ép chọn mẫu hay chốt màu ngay.
Khi giới thiệu mặt hàng có "Ảnh (URL)" và/hoặc "Trang sản phẩm (URL)" trong kho, đưa ảnh và link trang vào mảng products trong JSON đầu ra (khách sẽ thấy thẻ sản phẩm có ảnh và giá). Không dán URL ảnh hay URL trang sản phẩm dạng chữ trong trường message nếu đã khai báo đủ trong products.
Nếu trong tin nhắn khách hoặc ngữ cảnh hệ thống có dòng [Customer product SKU: …], đó là mã sản phẩm khách vừa chọn — ưu tiên tư vấn đúng mặt hàng khớp mã trong kho (xem khối "mặt hàng khớp mã/SKU" nếu có). Không đề xuất nhiều thẻ/carousel mẫu khác thay thế trừ khi khách muốn xem thêm hoặc so sánh.
Định dạng đầu ra: một đối tượng JSON đúng schema ở cuối prompt user — không bọc markdown, không giải thích ngoài JSON.
Không hứa giảm giá hay thay đổi chính sách ngoài nội dung đã cho. Trả lời súc tích trong trường message, có thể dùng gạch đầu dòng.
Giọng tư vấn **mở, nhẹ**: làm rõ lo lắng / nhu cầu của khách trước; tránh giọng hối mua hoặc bắt chọn màu–size trong mọi tin. Đọc lịch sử — nếu vừa hỏi khách chọn màu (hoặc tương tự) gần đây thì **đừng** lặp lại; chuyển sang trả lời nội dung khách đang hỏi hoặc bổ sung thông tin hữu ích.`

  const explicitSkuBlock = explicitSkuRows.length
    ? `\n\nCác mặt hàng khớp chính xác mã/SKU khách vừa nhắn (ưu tiên kiểm tra nhóm này trước):
${formatInventoryLines(explicitSkuRows)}`
    : ''

  const user = `Danh sách kho (do shop khai báo; có thể không đầy đủ so với toàn bộ hàng thực tế). Các dòng đầu là mặt hàng được ưu tiên theo mã/tên/từ khóa gần với tin nhắn khách (nếu có), sau đó là các mặt hàng còn lại theo thứ tự shop sắp xếp — tất cả đều có thể dùng để tư vấn:
${formatInventoryLines(invForContext)}
${explicitSkuBlock}
${selectedRowBlock}

Lịch sử hội thoại gần đây:
${transcript}

Tin nhắn mới nhất của khách:
${latestCustomerMessage}
${
  realUsePhotoLimitExceeded
    ? `

[Tình huống bắt buộc] Khách đã được gửi đủ 2 ảnh đời thường / góc tự nhiên (theo khung shop) cho đúng mặt hàng đang thảo luận trong cuộc chat này. Trong JSON: trả lời ngắn, lịch sự — bên em chỉ có thể gửi tối đa 2 ảnh loại này cho mặt hàng đó; không hứa thêm ảnh. Không cần xin lỗi dài; trong message **không** nói "ảnh AI" nếu đang dùng giọng thống nhất chú thích (ảnh đời thường, nhìn sản phẩm chân thực).
Vẫn điền mảng **products** với đúng mặt hàng đang bàn (name, image_url, product_url, price_hint, sku nếu có trong danh sách kho) để giao diện hiển thị thẻ sản phẩm với nút «Xem chi tiết» và «Mua hàng»; phần message chỉ cần giải thích đã gửi đủ ảnh (theo giới hạn), không nhét URL ảnh nếu đã có trong products.`
    : ''
}
${
  realUseFollowup?.publicUrl && !realUsePhotoLimitExceeded
    ? `

[Chú ý hệ thống] Tin này sẽ kèm ảnh **đời thường, góc tự nhiên** (theo chú thích giao diện — nhìn sản phẩm chân thực), **sinh từ ảnh chính sản phẩm** của mặt hàng đang tư vấn trong kho — không phải ảnh tham khảo độc lập. Trong JSON: mời khách xem ảnh đính kèm; giữ giọng thống nhất với chú thích đó; không nói shop "không có ảnh thực tế" hay "chưa có ảnh chụp" cho đúng mẫu đang bàn; không tự tiết lộ "ảnh AI" trong message.`
    : ''
}
${
  visionCatalogNoHitsFromTrigger(triggerRawPayload)
    ? `

Tình huống bổ sung (bắt buộc xử lý đúng): Tin kích hoạt này kèm ảnh từ khách và shop đã bật tìm sản phẩm theo ảnh, nhưng hệ thống không tìm được mặt hàng tương ứng trong kho (không có ứng viên). Hãy soạn một tin trả lời ngắn, lịch sự:
- Chào hỏi (có thể xưng hô phù hợp giọng shop).
- Cảm ơn khách đã gửi ảnh.
- Nói rõ hiện chưa có mẫu khớp trong dữ liệu kho (không nói “lỗi kỹ thuật” trừ khi có lý do rõ).
- Chủ động hỏi khách có muốn xem các mẫu tương tự đang có bên shop không, và mời khách nêu nhu cầu (màu/size/mức giá).
- Không bịa tên hay giá sản phẩm; không hứa chắc còn hàng nếu không có trong danh sách kho.`
    : ''
}

Trả lời BẮT BUỘC là một JSON hợp lệ duy nhất (không bọc markdown, không text ngoài JSON), đúng schema:
{"message":"nội dung gửi khách (plain text, có thể xuống dòng; không nhét URL ảnh/trang sản phẩm nếu đã có trong products). Khi đang tư vấn chi tiết theo dữ liệu kho, ưu tiên nêu ưu điểm/lợi ích cho khách như trên — có thể vài câu có gạch đầu dòng, không chỉ đọc thông số.","products":[]}
products là mảng, tối đa 4 phần tử. Khi giới thiệu mặt hàng từ danh sách kho có ảnh hoặc trang sản phẩm, mỗi phần tử:
{"name":"tên ngắn (có thể gồm mã/SKU)","image_url":"https://...","product_url":"https://...","price_hint":"199.000đ (tuỳ chọn, copy từ cột Giá trong kho nếu có)","sku":"mã trong kho (tuỳ chọn; nếu có thì khách bấm Tư vấn sẽ gửi đúng mã)"}
Chỉ dùng URL http(s) đúng như trong dữ liệu kho; không bịa link. image_url và product_url bắt buộc là chuỗi URL hợp lệ.
Ưu tiên để products có dữ liệu khi trong kho có mặt hàng gần với nhu cầu khách (ví dụ cùng nhóm sản phẩm/màu/kiểu), kể cả khi không khớp tuyệt đối.
Khi products có phần tử: message không được liệt kê từng tên sản phẩm; chỉ xác nhận ngắn gọn, có thể gợi ý khách xem thẻ khi cần — **không** dùng template ép "chọn màu" / "đã chọn màu chưa" lặp lại nếu trong hội thoại vừa có câu tương tự.
Chỉ để products = [] khi thực sự không tìm được mặt hàng phù hợp hoặc gần phù hợp trong danh sách kho.`

  return { system, user, materialDetailFollowup, realUseFollowup }
}

export type DeepseekPartnerChatUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export type DeepseekPartnerChatResult = {
  text?: string
  error?: string
  model?: string
  usage?: DeepseekPartnerChatUsage
}

export async function deepseekPartnerChat(system: string, user: string): Promise<DeepseekPartnerChatResult> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return { error: 'DEEPSEEK_API_KEY not configured.' }
  const model = 'deepseek-chat'
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 1100,
        temperature: 0.35,
      }),
    })
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: DeepseekPartnerChatUsage
      error?: { message?: string }
    }
    if (!res.ok) {
      return { error: json?.error?.message || res.statusText || 'DeepSeek error' }
    }
    const text = json.choices?.[0]?.message?.content?.trim()
    if (!text) return { error: 'Empty model output' }
    return { text, model, usage: json.usage }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'DeepSeek fetch failed' }
  }
}
