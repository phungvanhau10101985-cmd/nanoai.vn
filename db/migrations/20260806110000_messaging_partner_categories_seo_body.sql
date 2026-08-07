-- W4.12 (bổ sung) — tự động sinh nội dung SEO danh mục bằng AI, đối chiếu tính năng tương đương
-- của 188-com-vn (bảng category_seo_meta + Gemini). Additive-only, không đổi cột hiện có.
--
-- Khác 188 ở chỗ: seo_body gắn thẳng vào bảng danh mục hiện có (không tách bảng riêng) vì hệ
-- thống NanoAI đã có 1 nguồn category duy nhất theo tenant — xem docs/188_BEHAVIOR_SPEC.md mục A.1.

alter table public.messaging_partner_categories
  add column if not exists seo_body text not null default '',
  add column if not exists seo_body_generated_at timestamptz,
  add column if not exists seo_body_generated_locale text;

comment on column public.messaging_partner_categories.seo_body is
  'Đoạn văn SEO 150-300 từ hiển thị cuối trang danh mục công khai. Do AI sinh (nút admin) hoặc merchant tự viết tay — không tự sinh ngầm khi request trang (đọc thuần từ cột này, giống cơ chế category_seo_meta.seo_body của 188).';
comment on column public.messaging_partner_categories.seo_body_generated_at is
  'Thời điểm lần cuối AI sinh seo_body — null nếu merchant tự nhập tay hoặc chưa từng sinh.';
comment on column public.messaging_partner_categories.seo_body_generated_locale is
  'Locale (vi/en/zh/ja/ko) mà seo_body hiện tại được sinh — dùng để cảnh báo khi shop đổi locale mặc định.';
