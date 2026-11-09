-- Khóa trường: cấp đã bung + tên riêng.
-- THPT và «Trung học phổ thông» cùng tên riêng dùng một dòng.
-- Gom dữ liệu cũ: npx tsx scripts/merge-school-identity.ts

alter table public.schools
  add column if not exists identity_key text;

create index if not exists idx_schools_identity_key on public.schools (identity_key);

comment on column public.schools.identity_key is
  'Cấp đã bung và tên riêng. Viết tắt và viết đủ của cùng một trường thì cùng khóa.';
