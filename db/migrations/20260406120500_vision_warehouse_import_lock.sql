-- Google Vision Warehouse: tối đa 1 ImportAssets đồng thời / corpus — khóa toàn cục qua DB (nhiều cron/tab).
ALTER TABLE public.vision_warehouse_runner
  ADD COLUMN IF NOT EXISTS assets_import_busy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assets_import_busy_at timestamptz;

COMMENT ON COLUMN public.vision_warehouse_runner.assets_import_busy IS 'true khi một worker đang chạy assets:import+poll cho corpus dùng chung.';
COMMENT ON COLUMN public.vision_warehouse_runner.assets_import_busy_at IS 'Thời điểm giữ khóa; quá hạn stale thì worker khác có thể chiếm (phòng treo).';

CREATE OR REPLACE FUNCTION public.vision_warehouse_try_acquire_import_lock(p_stale_seconds integer DEFAULT 2700)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vision_warehouse_runner
  SET
    assets_import_busy = true,
    assets_import_busy_at = now(),
    updated_at = now()
  WHERE id = 1
    AND (
      assets_import_busy = false
      OR assets_import_busy_at IS NULL
      OR assets_import_busy_at < now() - (p_stale_seconds * interval '1 second')
    );
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.vision_warehouse_release_import_lock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vision_warehouse_runner
  SET
    assets_import_busy = false,
    assets_import_busy_at = NULL,
    updated_at = now()
  WHERE id = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.vision_warehouse_try_acquire_import_lock(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vision_warehouse_release_import_lock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vision_warehouse_try_acquire_import_lock(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.vision_warehouse_release_import_lock() TO service_role;
