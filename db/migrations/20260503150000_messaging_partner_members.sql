-- Thành viên workspace nhắn tin: chủ shop mời theo email, phân quyền granular (JSONB).
-- Kiểm tra quyền thực hiện ở tầng ứng dụng (server actions / API routes).

create table if not exists public.messaging_partner_members (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  member_user_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid references auth.users (id) on delete set null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_members_partner_member_unique unique (partner_id, member_user_id)
);

create index if not exists idx_messaging_partner_members_partner
  on public.messaging_partner_members (partner_id);

create index if not exists idx_messaging_partner_members_user
  on public.messaging_partner_members (member_user_id);

comment on table public.messaging_partner_members is 'Nhân viên workspace nhắn tin; permissions — JSON các khóa boolean (inbox, orders, …).';

create or replace function public.trg_messaging_partner_members_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_members_updated_at on public.messaging_partner_members;
create trigger tr_messaging_partner_members_updated_at
  before update on public.messaging_partner_members
  for each row
  execute function public.trg_messaging_partner_members_updated_at();

-- Không thêm chủ workspace làm thành viên (subquery không dùng trong CHECK được).
create or replace function public.messaging_partner_members_reject_owner()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.messaging_partners mp
    where mp.id = new.partner_id
      and mp.owner_user_id is not null
      and mp.owner_user_id = new.member_user_id
  ) then
    raise exception 'member_cannot_be_owner'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_members_no_owner on public.messaging_partner_members;
create trigger tr_messaging_partner_members_no_owner
  before insert or update on public.messaging_partner_members
  for each row
  execute function public.messaging_partner_members_reject_owner();

