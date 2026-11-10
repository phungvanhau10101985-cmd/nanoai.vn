-- Đánh giá khách cho trang giới thiệu thiệp cưới.

CREATE TABLE IF NOT EXISTS public.wedding_card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  author_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 12 AND 600),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wedding_card_reviews_created
  ON public.wedding_card_reviews (created_at DESC);
