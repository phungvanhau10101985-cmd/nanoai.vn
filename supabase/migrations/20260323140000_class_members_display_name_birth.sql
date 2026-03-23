-- Học sinh khai báo họ tên + ngày sinh khi tham gia lớp (không dùng tên OAuth làm tên hiển thị trong lớp)

alter table class_members
  add column if not exists member_display_name text,
  add column if not exists birth_date date;

comment on column class_members.member_display_name is 'Họ tên HS khai báo khi tham gia lớp (hiển thị cho GV)';
comment on column class_members.birth_date is 'Ngày sinh khai báo khi tham gia lớp';

drop policy if exists "Users can join class (insert self)" on class_members;

create policy "Students join class with declared name and birth date"
  on class_members for insert
  with check (
    user_id = auth.uid()
    and coalesce(trim(member_display_name), '') <> ''
    and birth_date is not null
  );

-- HS có thể bổ sung / sửa hồ sơ lớp của chính mình (vẫn phải đủ tên + ngày sinh)
create policy "Members update own enrollment profile"
  on class_members for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and coalesce(trim(member_display_name), '') <> ''
    and birth_date is not null
  );
