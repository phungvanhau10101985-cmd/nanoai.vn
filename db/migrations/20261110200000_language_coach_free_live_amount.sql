-- Buổi live miễn phí ghi amount = 0. Ràng buộc cũ chỉ cho amount > 0.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'language_coach_credit_events'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%amount%'
  loop
    execute format('alter table public.language_coach_credit_events drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.language_coach_credit_events
  drop constraint if exists language_coach_credit_events_amount_check;

alter table public.language_coach_credit_events
  add constraint language_coach_credit_events_amount_check check (amount >= 0);
