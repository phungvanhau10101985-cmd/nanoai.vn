-- Trễ trả lời AI: tối đa 30s (chat bán hàng); mặc định mới 20s.
-- Tên CHECK có thể do PG tự sinh — drop theo pg_constraint.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.messaging_partner_ai_settings'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%reply_delay_seconds%'
  loop
    execute format(
      'alter table public.messaging_partner_ai_settings drop constraint %I',
      r.conname
    );
  end loop;
end $$;

update public.messaging_partner_ai_settings
set reply_delay_seconds = 30
where reply_delay_seconds > 30;

update public.messaging_partner_ai_settings
set reply_delay_seconds = 5
where reply_delay_seconds < 5;

alter table public.messaging_partner_ai_settings
  add constraint messaging_partner_ai_settings_reply_delay_seconds_check
  check (reply_delay_seconds >= 5 and reply_delay_seconds <= 30);

alter table public.messaging_partner_ai_settings
  alter column reply_delay_seconds set default 20;

comment on column public.messaging_partner_ai_settings.reply_delay_seconds is
  'Giây chờ trước khi AI gửi (sau tin khách). 5–30; mặc định 20. Sau đó còn độ trễ gõ (ms).';
