# Prompt mẫu – Bước 1: Thiết kế mặt tiền nhà (đơn giản)

## Ví dụ input từ form

- **Chiều dài mặt tiền nhà:** 15m  
- **Kích thước còn lại (không phải mặt tiền):** 20m  
- **Phong cách:** Hiện đại  
- **Số tầng:** 2  
- **Số cửa chính:** 1  
- **Ban công mặt tiền:** Có  
- **Ảnh gợi ý:** Có (tùy chọn)  

---

## 1. Raw userInput (gửi Gemini Flash để chuẩn hóa)

```
Chiều dài mặt tiền nhà: 15m. Kích thước còn lại của nhà (không phải mặt tiền): 20m. Phong cách: Hiện đại. Số tầng: 2. Số cửa chính: 1. Có ban công mặt tiền. Có ảnh gợi ý đính kèm.
```

---

## 2. Output từ Gemini Flash (promptEn – ví dụ)

```
House facade length: 15m. House depth (remaining dimension): 20m. Modern style. Two stories. Main door: 1. Front balcony. Reference image attached.
```

---

## 3. Full prompt gửi model ảnh (Gemini Pro Image)

```
Create a photorealistic 3D architectural visualization of a residential house facade with front garden. AI chooses garden elements (plants, trees, lawn, etc.) freely. Professional style, realistic materials. Output a single high-quality image.

House facade length: 15m. House depth (remaining dimension): 20m. Modern style. Two stories. Main door: 1. Front balcony. Reference image attached.

Return only the result image.
```

---

## Tóm tắt luồng

1. **Form** → `userInput` (chiều dài mặt tiền, kích thước còn lại, phong cách, số tầng, ảnh gợi ý)
2. **Gemini Flash** → `promptEn` (chuẩn hóa sang tiếng Anh)
3. **fullPrompt** = `HOUSE_3D_PROMPT` + `promptEn`
4. **Gemini Pro Image** nhận `fullPrompt` → tạo ảnh 3D (AI tự chọn sân vườn)
