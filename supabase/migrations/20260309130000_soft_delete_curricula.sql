-- Soft delete: giáo viên "xóa" chỉ ẩn khỏi danh sách của mình, dữ liệu vẫn lưu DB cho giáo viên khác
create table if not exists user_hidden_curricula (
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, curriculum_id)
);

create index idx_user_hidden_curricula_user_id on user_hidden_curricula(user_id);

alter table user_hidden_curricula enable row level security;

create policy "Users can manage own hidden list"
  on user_hidden_curricula for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Bỏ policy xóa thật để tránh xóa dữ liệu khỏi DB
drop policy if exists "Users can delete own curricula" on worksheet_curricula;

comment on table user_hidden_curricula is 'Giáo trình user đã ẩn – soft delete, dữ liệu vẫn trong worksheet_curricula';
