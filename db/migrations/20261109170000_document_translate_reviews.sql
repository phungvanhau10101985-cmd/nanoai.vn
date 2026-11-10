-- Đánh giá khách cho trang giới thiệu dịch ảnh tài liệu.

CREATE TABLE IF NOT EXISTS public.document_translate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  author_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 12 AND 600),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_translate_reviews_created
  ON public.document_translate_reviews (created_at DESC);
