-- Môn giáo viên tự thêm. Tên đã được chuẩn hóa, không dùng mục «Khác».

create table if not exists public.teaching_subjects (
  id varchar(40) primary key,
  label text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.teaching_subjects is 'Môn học giáo viên thêm khi danh sách có sẵn chưa có. Tên đã chuẩn hóa.';
