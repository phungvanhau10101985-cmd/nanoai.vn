-- Align default AI messaging latency with current product baseline:
-- reply delay 10s, typing min 700ms, typing max 1200ms.

alter table public.messaging_partner_ai_settings
  alter column reply_delay_seconds set default 10;

alter table public.messaging_partner_ai_settings
  alter column typing_pause_min_ms set default 700;

alter table public.messaging_partner_ai_settings
  alter column typing_pause_max_ms set default 1200;

update public.messaging_partner_ai_settings
set
  reply_delay_seconds = 10
where reply_delay_seconds = 20;

update public.messaging_partner_ai_settings
set
  typing_pause_min_ms = 700
where typing_pause_min_ms = 1200;

update public.messaging_partner_ai_settings
set
  typing_pause_max_ms = 1200
where typing_pause_max_ms = 3800;
