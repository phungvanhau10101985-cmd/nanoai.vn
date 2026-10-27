-- Hoa văn nổi trên nền thiệp. Quản trị sửa một lần, mọi khách dùng chung.
create table if not exists public.wedding_background_ornament_layouts (
  layout_key text primary key,
  ornaments jsonb not null,
  updated_by uuid,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.wedding_background_ornament_layouts is
  'Lớp hoa nổi trên cùng của từng nền thiệp. Chỉ quản trị ghi. Khách chỉ xem.';

alter table public.wedding_background_ornament_layouts enable row level security;

drop policy if exists "Wedding ornament layouts are readable." on public.wedding_background_ornament_layouts;
create policy "Wedding ornament layouts are readable."
  on public.wedding_background_ornament_layouts
  for select
  using (true);
