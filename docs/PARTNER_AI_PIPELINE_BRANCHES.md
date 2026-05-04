# Partner AI — các nhánh luồng xử lý (tách biệt)

Tài liệu này mô tả **các nhánh độc lập** trong pipeline tư vấn kho (fashion messaging). Mục tiêu: lập trình sau này (và công cụ AI) **sửa đúng nhánh**, tránh một thay đổi làm hỏng nhánh khác.

## Nguyên tắc bắt buộc

1. **Mỗi nhánh có điều kiện vào và hành vi đầu ra riêng** — không gộp logic «cho tiện» vào một `if` chung nếu không thật sự cùng nghiệp vụ.
2. **Ưu tiên thay đổi tối thiểu** — chỉ sửa nhánh đang được yêu cầu; không refactor rộng `buildPartnerAiContext` khi chỉ cần chỉnh một regex hoặc một clamp.
3. **Giữ tính loại trừ có chủ đích** — code đã cố tình để các cờ loại trừ lẫn nhau (vd. **Nhánh A** và **Nhánh B** không bật đồng thời). Khi thêm nhánh mới, phải nêu rõ: trường hợp nào **tắt** nhánh cũ.
4. **Hồi quy theo ma trận nhánh** — sau khi sửa, kiểm tra ít nhất: (1) tin kèm link/SKU hỏi thuộc tính một SP, (2) «có mẫu khác không» khi đã có neo, (3) «mẫu khác» khi **chưa** có neo → clarify, (4) widget `context_reply`, (5) tìm kho tổng quát không neo.

## Sơ đồ thứ tự (rất quan trọng)

Luồng bắt đầu tại `buildPartnerAiContext` (`src/lib/messaging/partner-ai-llm.ts`):

1. **Thoát sớm — làm rõ / tạm dừng**  
   - `useClarifyShoppingBranch` → prompt clarify, `products` luôn rỗng sau job.  
   - `partnerAiInboundLooksLikePauseConversation` → nhánh pause.  
   Các return này **không** chạy LLM tư vấn kho đầy đủ; không gắn `partner_ai_pipeline_branch` kiểu A/B.

2. **Nhánh có nhãn A/B trong prompt & telemetry** (chạy LLM đầy đủ)  
   Xem bảng dưới.

3. **Sau LLM** — `src/lib/messaging/partner-ai-run-jobs.ts` áp **clamp** theo từng cờ (thứ tự trong file quan trọng). Không đổi thứ tự clamp nếu chưa phân tích xung đột.

## Bảng nhánh chính

| Nhãn nội bộ | Ý nghĩa nghiệp vụ | Điều kiện cốt lõi (tóm tắt) | Cờ / field chính | `partner_ai_pipeline_branch` (tin outbound `raw_payload`) |
|-------------|-------------------|------------------------------|-------------------|---------------------------------------------------------------|
| **Nhánh A** | Gợi ý **mẫu / loại / kiểu khác**, tương tự, gần giống — **carousel + vector** trên kho | `customerMessageWantsSimilarCatalogVersusLastConsulted` | `similarCatalogVersusLastConsulted` | `similar_alternatives_catalog` |
| **Nhánh B** | Tư vấn **đúng một** SP neo từ **link / payload** (`page_context`, SKU, …), không tìm rộng | Có `page_context` đủ điều kiện + resolve được dòng kho + **không** phải ý «mẫu khác» | `inboundAnchoredProductConsultBranch`, `inboundAnchoredConsultRow` | `inbound_anchored_product_consult` |
| **Làm rõ (clarify)** | Chưa có neo / chưa rõ SP — **không** carousel kho | Rời nhánh chính sớm trong `buildPartnerAiContext` | `clarifyShoppingIntent === true` | *(không set A/B)* |
| **Follow-up 1 SP (no vector)** | Hỏi tiếp thuộc tính SP vừa tư vấn, **một dòng kho**, không ANN cả kho | `followUpSingleProductNoVector` + có `lastConsultedRow` (hoặc widget neo) | `useLastConsultedContext`, `followUpSingleProductNoVector` | *(không set A/B; có clamp trong job)* |
| **Widget `context_reply`** | Khóa 1 dòng theo intent widget | `forceSingleRowContextFromWidgetIntent` | `forceSingleRowContextReply` | *(ưu tiên clamp một dòng)* |
| **Neo SKU / trang (không similar, không B)** | Khớp mã trong tin/trang, thường **≤1 thẻ** | `explicitSkuRows` + không bật A | `explicitSkuRows` | *(mặc định)* |
| **Page context — mã không có kho, gợi ý theo ảnh** | Trang/embed có `page_context` + ảnh nhưng **không** resolve được dòng kho → vector ảnh ngoài so với kho | `inboundPageSkuMissImageSimilarFallback` | `fetchInventoryRowsSimilarToExternalImageUrl` | `page_context_image_similar_fallback` |
| **Tìm kho mặc định** | Keyword + vector theo tin | Không thuộc các nhánh trên | `invForContext` rộng | *(mặc định)* |

## Loại trừ giữa Nhánh A và Nhánh B

Trong code, **Nhánh B** được định nghĩa có điều kiện `!similarCatalogVersusLastConsulted`.  
Nghĩa là: nếu khách vừa gửi **ngữ cảnh SP** vừa hỏi kiểu **«mẫu khác»**, hệ thống đi **Nhánh A**, không phải B. Đây là hành vi **cố ý** (carousel tương tự ≠ tư vấn thuộc tính một mã).

**Không** được bỏ điều kiện này trừ khi có quyết định sản phẩm rõ và cập nhật cả prompt lẫn QA.

## Ví dụ Nhánh B — «Mã SP trên trang + ảnh + hỏi chất liệu»

- Khách xem trang chi tiết SP trên shop (HTML có «Mã SP: **A6009**» — class kiểu `copy-code-product`); widget/embed gửi `page_context.sku` / `inventory_id` kèm tin; khách có thể **đính ảnh** cùng sản phẩm và hỏi *«Da gì vậy»*.
- **Bắt buộc:** phản hồi căn cứ **dòng kho** khớp A6009 (tên, mô tả, chất liệu, …) — **không** bịa loại hàng (vd. váy voan) khi kho là túi da.
- **Kỹ thuật:** trong nhánh không phải `product_card_consult`, `buildPartnerAiContext` **ưu tiên** `fetchInventoryRowsFromPageContextSku` **trước** `fetchInventoryRowsByExplicitSku`, vì chuỗi `latestCustomerMessage` có thể gồm nhiều tin khách (job gộp tail): tránh lấy nhầm SKU từ tin cũ rồi bỏ qua mã đang xem.
- **Prompt user (Nhánh B):** chỉ **một** lần `formatInventoryLines` cho đúng dòng kho; **không** lặp khối SKU / snapshot follow-up / transcript dài — xem `partner-ai-llm.ts`.

## File tham chiếu (sửa nhánh thì mở đúng chỗ)

| Mục đích | File gợi ý |
|----------|------------|
| Điều kiện vào A (từ khóa «mẫu khác», …) | `src/lib/messaging/partner-inventory-ai-search.ts` — `customerMessageWantsSimilarCatalogVersusLastConsulted`, `SIMILAR_CATALOG_INTENT_RE` |
| Ghép prompt, cờ B, khối `[Nhánh A]` / `[Nhánh B]` | `src/lib/messaging/partner-ai-llm.ts` — `buildPartnerAiContext` |
| Parse LLM, clamp `products`, gắn `partner_ai_pipeline_branch` | `src/lib/messaging/partner-ai-run-jobs.ts` |
| Clarify widget / heuristic mơ hồ | `src/lib/messaging/partner-ai-widget-intent-classifier.ts`, `partner-ai-unclear-intent.ts` |

## Telemetry

- `partner_ai_pipeline_branch`:  
  - `inbound_anchored_product_consult` — ưu tiên khi bật (Nhánh B).  
  - `page_context_image_similar_fallback` — mã/link trang không có trong kho; danh sách kho = gợi ý theo ảnh (vector).  
  - `similar_alternatives_catalog` — khi Nhánh A và chạy LLM đầy đủ (không clarify).  

Dùng để debug và để sau này không đổi nghĩa key một cách âm thầm.

## Checklist trước khi merge (gợi ý)

- [ ] Thay đổi có nằm **trong một nhánh** và không làm lệch điều kiện nhánh khác?
- [ ] Có cập nhật regex / heuristic: test vài câu biên A, B, clarify?
- [ ] Có chạy `tsc` / lint cho file đã sửa?
- [ ] Nếu thêm nhánh mới: đã bổ sung **một dòng** vào bảng trong tài liệu này chưa?

---

*Cập nhật lần cuối cùng hệ thống nhánh A/B và pipeline marker như trong repo; không đồng bộ tài liệu này với code sẽ gây hiểu nhầm cho người sau.*
