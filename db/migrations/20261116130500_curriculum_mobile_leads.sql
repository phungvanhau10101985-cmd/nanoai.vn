-- Khách mở /giao-trinh trên điện thoại hoặc trình duyệt trong app Facebook, để lại liên hệ xin link máy tính.

create table if not exists public.curriculum_mobile_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  contact_key text not null,
  contact_kind text not null check (contact_kind in ('email', 'phone')),
  subject text not null,
  locale text not null default 'vi',
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists curriculum_mobile_leads_contact_key_created_idx
  on public.curriculum_mobile_leads (contact_key, created_at desc);

comment on table public.curriculum_mobile_leads is
  'Lead trang giáo trình trên điện thoại: họ tên, Zalo hoặc email, môn đang dạy.';
