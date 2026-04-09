-- Tín hiệu WebRTC cho "xem màn hình live" (thay broadcast realtime hosted).
-- Dọn bản ghi cũ qua API (không cần cron bắt buộc).

CREATE TABLE IF NOT EXISTS public.screen_live_signals (
  id BIGSERIAL PRIMARY KEY,
  room_code TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('offer', 'answer', 'ice', 'request-offer')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screen_live_signals_room_id
  ON public.screen_live_signals (room_code, id);

CREATE INDEX IF NOT EXISTS idx_screen_live_signals_created_at
  ON public.screen_live_signals (created_at);

COMMENT ON TABLE public.screen_live_signals IS 'Hàng đợi tín hiệu WebRTC (thay broadcast Realtime)';
