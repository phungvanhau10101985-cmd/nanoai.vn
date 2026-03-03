# Định dạng dữ liệu AI trả về (English Coach Chat)

## Cấu trúc JSON

```json
{
  "reply": "string",
  "corrections": [{ "original": "string", "fixed": "string", "explanationVi": "string" }],
  "pronunciationTips": ["string"],
  "correctionNote": "string",
  "correctedSentence": "string",
  "intentAnswer": "string",
  "mainSentence": "string",
  "mustKnowText": "string"
}
```

## Mô tả từng trường

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| **reply** | string | ✅ | Toàn bộ câu trả lời của thầy/cô bằng ngôn ngữ mục tiêu. Có thể chứa nhiều đoạn (sửa lỗi, câu hoàn chỉnh, câu hỏi gợi mở). |
| **corrections** | array | ✅ | Mảng tối đa 5 phần tử. Mỗi phần tử: `original` (câu sai), `fixed` (câu đúng), `explanationVi` (giải thích bằng ngôn ngữ mẹ đẻ). |
| **pronunciationTips** | array | ✅ | Mảng tối đa 5 mẹo phát âm, bằng ngôn ngữ mẹ đẻ. |
| **correctionNote** | string | ✅ | Ý 1: Sửa lỗi ngắn gọn cho câu học sinh. |
| **correctedSentence** | string | ✅ | Ý 2: Câu sửa hoàn chỉnh cuối cùng (ngôn ngữ mục tiêu). |
| **intentAnswer** | string | ✅ | Ý 3: Phản hồi + câu hỏi gợi mở tiếp theo, CHỈ bằng ngôn ngữ đang học. |
| **mainSentence** | string | ✅ | 1 câu chính để nút "Nghe câu chính" đọc. |
| **mustKnowText** | string | ✅ | 1 câu/cụm quan trọng nhất cần học viên nghe rõ. |

## Ví dụ đầy đủ

Xem file `ai-response-sample.json`.

## Ví dụ tối giản (không có lỗi)

Xem file `ai-response-sample-minimal.json`.

## Lưu ý

- Tất cả chuỗi có thể rỗng `""` nếu không áp dụng.
- `corrections` và `pronunciationTips` có thể là mảng rỗng `[]`.
- Server sẽ cắt `corrections` và `pronunciationTips` tối đa 5 phần tử.
- `explanationVi` có thể dùng ngôn ngữ mẹ đẻ khác (en, zh, ja...) tùy `nativeLanguageCode`.
