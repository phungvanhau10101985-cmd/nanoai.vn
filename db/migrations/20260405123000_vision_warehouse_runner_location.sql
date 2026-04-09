-- Region thực tế của corpus khi sync (cron analyze/reindex phải dùng cùng location).
ALTER TABLE public.vision_warehouse_runner
  ADD COLUMN IF NOT EXISTS warehouse_location text NOT NULL DEFAULT 'us-central1';

COMMENT ON COLUMN public.vision_warehouse_runner.warehouse_location IS 'GCP region của Vision Warehouse corpus (us-central1 | europe-west4), khớp vision_location lúc import.';
