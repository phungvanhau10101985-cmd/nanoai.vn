-- Đồng bộ Vision catalog nền (VPS + cron): trạng thái job + báo cáo chi tiết.

alter table public.messaging_partner_ai_settings
  add column if not exists vision_bg_sync_status text not null default 'idle';

alter table public.messaging_partner_ai_settings
  add column if not exists vision_bg_sync_resume_after_id text null;

alter table public.messaging_partner_ai_settings
  add column if not exists vision_bg_sync_rounds integer not null default 0;

alter table public.messaging_partner_ai_settings
  add column if not exists vision_bg_sync_imported integer not null default 0;

alter table public.messaging_partner_ai_settings
  add column if not exists vision_bg_sync_removed integer not null default 0;

alter table public.messaging_partner_ai_settings
  add column if not exists vision_bg_sync_started_at timestamptz null;

alter table public.messaging_partner_ai_settings
  add column if not exists vision_bg_sync_finished_at timestamptz null;

alter table public.messaging_partner_ai_settings
  add column if not exists vision_bg_sync_error text not null default '';

alter table public.messaging_partner_ai_settings
  add column if not exists vision_bg_sync_report text not null default '';

comment on column public.messaging_partner_ai_settings.vision_bg_sync_status is
  'idle | queued | running | done | error — job đồng bộ catalog Vision nền (cron).';
comment on column public.messaging_partner_ai_settings.vision_bg_sync_resume_after_id is
  'Cursor resume (inventory id) giữa các lượt cron.';
comment on column public.messaging_partner_ai_settings.vision_bg_sync_report is
  'JSON báo cáo chi tiết cho UI (tổng rounds, imported, removed, hasMore, lý do dừng).';

create index if not exists messaging_partner_ai_settings_vision_bg_sync_pending
  on public.messaging_partner_ai_settings (vision_bg_sync_status)
  where vision_bg_sync_status in ('queued', 'running');
