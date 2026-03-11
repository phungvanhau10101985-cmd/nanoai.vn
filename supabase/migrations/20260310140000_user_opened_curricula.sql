-- Giáo trình giáo viên đã mở – hiển thị ở trên cùng khi chọn giáo trình cho bài thi
create table if not exists user_opened_curricula (
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  opened_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, curriculum_id)
);

create index idx_user_opened_curricula_user_id on user_opened_curricula(user_id);
create index idx_user_opened_curricula_opened_at on user_opened_curricula(opened_at desc);

alter table user_opened_curricula enable row level security;

create policy "Users can manage own opened list"
  on user_opened_curricula for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table user_opened_curricula is 'Giáo trình giáo viên đã mở – hiển thị ưu tiên khi chọn giáo trình cho bài thi';
