-- Vỏ thiệp theo nền. Quản trị ghi mẫu chung. Khách đã có vỏ riêng thì không bị ghi đè.
create table if not exists public.wedding_background_shell_layouts (
  layout_key text primary key,
  shell jsonb not null,
  updated_by uuid,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.wedding_background_shell_layouts is
  'Vị trí khung và tên trên vỏ thiệp, theo nền và theo máy. Quản trị ghi mẫu cho khách chưa tự sửa.';

alter table public.wedding_background_shell_layouts enable row level security;

drop policy if exists "Wedding shell layouts are readable." on public.wedding_background_shell_layouts;
create policy "Wedding shell layouts are readable."
  on public.wedding_background_shell_layouts
  for select
  using (true);
