-- Singleton queue: sau import Warehouse cần analyze corpus + rebuild index (cron).
CREATE TABLE IF NOT EXISTS public.vision_warehouse_runner (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pending_work boolean NOT NULL DEFAULT false,
  analyze_operation text NOT NULL DEFAULT '',
  index_operation text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.vision_warehouse_runner (id, pending_work)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.vision_warehouse_runner ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.vision_warehouse_runner IS 'Vertex AI Vision Warehouse: hàng đợi analyze/reindex (chỉ server/service role).';
