-- Import lock owner + heartbeat:
-- tránh lock mồ côi và hỗ trợ auto-unlock chính xác khi worker chết giữa chừng.
ALTER TABLE public.vision_warehouse_runner
  ADD COLUMN IF NOT EXISTS assets_import_owner text,
  ADD COLUMN IF NOT EXISTS assets_import_heartbeat_at timestamptz;

COMMENT ON COLUMN public.vision_warehouse_runner.assets_import_owner IS
  'Owner ID đang giữ lock import assets (debug/tracing).';
COMMENT ON COLUMN public.vision_warehouse_runner.assets_import_heartbeat_at IS
  'Heartbeat gần nhất của owner đang giữ lock import.';

DROP FUNCTION IF EXISTS public.vision_warehouse_try_acquire_import_lock(integer);
DROP FUNCTION IF EXISTS public.vision_warehouse_release_import_lock();

CREATE OR REPLACE FUNCTION public.vision_warehouse_try_acquire_import_lock(
  p_stale_seconds integer DEFAULT 2700,
  p_owner text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text := nullif(trim(coalesce(p_owner, '')), '');
BEGIN
  UPDATE public.vision_warehouse_runner
  SET
    assets_import_busy = true,
    assets_import_busy_at = now(),
    assets_import_owner = coalesce(v_owner, 'unknown-owner'),
    assets_import_heartbeat_at = now(),
    updated_at = now()
  WHERE id = 1
    AND (
      assets_import_busy = false
      OR assets_import_busy_at IS NULL
      OR assets_import_busy_at < now() - (p_stale_seconds * interval '1 second')
      OR assets_import_heartbeat_at IS NULL
      OR assets_import_heartbeat_at < now() - (p_stale_seconds * interval '1 second')
    );
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.vision_warehouse_heartbeat_import_lock(p_owner text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text := nullif(trim(coalesce(p_owner, '')), '');
BEGIN
  IF v_owner IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.vision_warehouse_runner
  SET
    assets_import_heartbeat_at = now(),
    updated_at = now()
  WHERE id = 1
    AND assets_import_busy = true
    AND assets_import_owner = v_owner;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.vision_warehouse_release_import_lock(p_owner text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text := nullif(trim(coalesce(p_owner, '')), '');
BEGIN
  UPDATE public.vision_warehouse_runner
  SET
    assets_import_busy = false,
    assets_import_busy_at = NULL,
    assets_import_owner = NULL,
    assets_import_heartbeat_at = NULL,
    updated_at = now()
  WHERE id = 1
    AND (v_owner IS NULL OR assets_import_owner = v_owner);
END;
$$;

REVOKE ALL ON FUNCTION public.vision_warehouse_try_acquire_import_lock(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vision_warehouse_heartbeat_import_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vision_warehouse_release_import_lock(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.vision_warehouse_try_acquire_import_lock(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vision_warehouse_heartbeat_import_lock(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vision_warehouse_release_import_lock(text) TO service_role;
