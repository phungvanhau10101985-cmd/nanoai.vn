# Ước tính chi phí AI – Tạo giáo trình + Slide + Phiếu bài tập đầy đủ

Tài liệu này ước tính chi phí API khi tạo **một bộ giáo trình hoàn chỉnh** gồm: giáo trình, slide bài giảng, và phiếu bài tập (5 trắc nghiệm + 5 tự luận).

## Bảng giá tham khảo (Paid tier, 2025)

| Model | Input (1M tokens) | Output (1M tokens) | Ghi chú |
|-------|-------------------|--------------------|---------|
| **Gemini 2.5 Pro** | $1.25 | $10.00 | Tạo giáo trình, phiếu bài tập |
| **Gemini 2.5 Flash** | $0.30 | $2.50 | Tạo slide |
| **Gemini 2.0 Flash** | $0.10 | $0.40 | Tìm ảnh (Google Search grounding) |
| **DeepSeek Reasoner** | $0.55 (cache miss) | $2.19 | Verify câu hỏi |
| **Google Search grounding** | - | $35 / 1.000 prompts | Sau 1.500 RPD miễn phí (Gemini 2.0 Flash) |

*Nguồn: [Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing), [DeepSeek Pricing](https://api-docs.deepseek.com/quick_start/pricing-details-usd/)*

---

## Luồng tạo đầy đủ (1 bộ)

### 1. Tạo giáo trình (curriculum)

| Bước | Model | Input (tokens) | Output (tokens) | Chi phí (USD) |
|------|-------|----------------|-----------------|---------------|
| curriculum-from-paste | Gemini 2.5 Pro | ~4.000 | ~6.000 | ~0.005 + 0.06 ≈ **0.065** |
| curriculum-from-image | Gemini 2.5 Pro | ~5.000 (text+ảnh) | ~7.000 | ~0.006 + 0.07 ≈ **0.076** |

*Giả định: nội dung dán ~8.000 ký tự, 3–5 ảnh kèm.*

---

### 2. Tạo slide bài giảng (curriculum-analyze-slides)

| Bước | Model | Input (tokens) | Output (tokens) | Chi phí (USD) |
|------|-------|----------------|-----------------|---------------|
| Tạo JSON slides | Gemini 2.5 Flash | ~8.000 | ~4.000 | ~0.0024 + 0.01 ≈ **0.012** |
| Tìm ảnh (mỗi slide) | Gemini 2.0 Flash + Search | ~100 × 15 | ~50 × 15 | ~0.0002 + 0.0003 ≈ **0.0005** |
| **Tổng 15 slides** | | | | **~0.013** |

*Lưu ý: Nếu dùng Pexels API thì không gọi Gemini 2.0 Flash cho ảnh → tiết kiệm. Grounding Search: 1.500 prompts/tháng miễn phí, sau đó $35/1.000 prompts.*

---

### 3. Tạo phiếu bài tập (worksheet)

#### 3a. Tạo 1 lần (createWorksheet)

| Bước | Model | Số lần | Input/lần | Output/lần | Chi phí (USD) |
|------|-------|--------|-----------|------------|---------------|
| Generate JSON | Gemini 2.5 Pro | 1 | ~9.000 | ~3.500 | ~0.011 + 0.035 ≈ **0.046** |
| Verify trắc nghiệm | DeepSeek Reasoner | 5 | ~3.500 | ~200 | 5 × (0.002 + 0.0004) ≈ **0.012** |
| Verify tự luận | DeepSeek Reasoner | 5 | ~4.000 | ~250 | 5 × (0.0022 + 0.0005) ≈ **0.014** |
| **Tổng** | | | | | **~0.072** |

*Trường hợp có câu Bộ GD: số lần verify giảm (chỉ verify câu Bộ GD + câu AI). Retry khi verify fail: thêm ~1–2 lần Gemini Pro + DeepSeek.*

#### 3b. Tạo từng câu (createWorksheetFromQuestions)

| Bước | Model | Số lần | Input/lần | Output/lần | Chi phí (USD) |
|------|-------|--------|-----------|------------|---------------|
| Generate quiz | Gemini 2.5 Pro | 5 | ~6.500 | ~500 | 5 × (0.008 + 0.005) ≈ **0.065** |
| Verify quiz | DeepSeek Reasoner | 5 | ~3.500 | ~200 | **0.012** |
| Generate essay | Gemini 2.5 Pro | 5 | ~6.500 | ~600 | 5 × (0.008 + 0.006) ≈ **0.070** |
| Verify essay | DeepSeek Reasoner | 5 | ~4.000 | ~250 | **0.014** |
| **Tổng** | | | | | **~0.161** |

---

## Tổng hợp chi phí 1 bộ đầy đủ

| Luồng | Giáo trình | Slide | Phiếu bài tập | **Tổng (USD)** |
|-------|------------|-------|---------------|----------------|
| **Tạo 1 lần** (paste) | 0.065 | 0.013 | 0.072 | **~0.15** |
| **Tạo 1 lần** (có ảnh) | 0.076 | 0.013 | 0.072 | **~0.16** |
| **Tạo từng câu** (paste) | 0.065 | 0.013 | 0.161 | **~0.24** |

### Quy đổi VND (tỷ giá ~25.000 VND/USD)

| Luồng | Chi phí USD | Chi phí VND |
|-------|-------------|-------------|
| Tạo 1 lần (paste) | ~0.15 | **~3.750 đ** |
| Tạo 1 lần (có ảnh) | ~0.16 | **~4.000 đ** |
| Tạo từng câu | ~0.24 | **~6.000 đ** |

---

## Các yếu tố ảnh hưởng

1. **Độ dài giáo trình**: Giáo trình dài hơn → input/output nhiều hơn → chi phí tăng.
2. **Số slide**: Nhiều slide hơn → output JSON lớn hơn, nhiều lần tìm ảnh hơn.
3. **Pexels vs Google Search**: Dùng Pexels API cho ảnh → không tốn chi phí grounding Search.
4. **Câu Bộ GD**: Nếu có 1–5 câu trắc nghiệm từ ngân hàng Bộ GD → giảm số lần generate quiz AI.
5. **Verify fail + retry**: Mỗi lần retry thêm ~0.01–0.02 USD.
6. **Free tier**: Gemini có free tier; DeepSeek có thể có free credits → chi phí thực tế có thể thấp hơn.

---

## Kết luận

**Chi phí ước tính cho 1 bộ giáo trình + slide + phiếu bài tập đầy đủ:**

- **~0.15–0.24 USD** (~3.750–6.000 VND) tùy luồng tạo.
- Luồng **tạo 1 lần** rẻ hơn **tạo từng câu** vì generate ít lần hơn.
- Chi phí chủ yếu từ **Gemini 2.5 Pro** (tạo giáo trình + phiếu) và **DeepSeek Reasoner** (verify).
