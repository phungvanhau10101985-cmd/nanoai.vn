-- Self-hosted: đăng nhập email (nanoai_ensure_user_by_email) cần ít nhất một dòng auth.instances.
-- Sau truncate hoặc DB mới thiếu seed → lỗi auth.instances_empty.

create table if not exists auth.instances (
  id uuid primary key default gen_random_uuid()
);

insert into auth.instances (id)
select gen_random_uuid()
where not exists (select 1 from auth.instances limit 1);
