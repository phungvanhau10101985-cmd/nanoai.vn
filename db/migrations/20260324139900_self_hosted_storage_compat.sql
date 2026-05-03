-- Postgres self-hosted (không Supabase) thiếu schema storage.* mà các migration sau dùng:
--   storage.buckets, storage.objects (+ policy theo bucket_id).
-- Idempotent: nếu đã có (Supabase cloud) thì không tạo lại, không đụng dữ liệu.
-- Đặt TRƯỚC 20260324140000_cleanup_exam_essay_storage.sql theo thứ tự tên file.

create schema if not exists storage;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    create table storage.buckets (
      id text primary key,
      name text not null,
      owner uuid,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[],
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    comment on table storage.buckets is
      'Self-hosted compat: stub khớp Supabase Storage. App self-hosted thường dùng Bunny/S3 — bảng này chỉ để migration chạy thông.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets (id) on delete cascade,
      name text not null,
      owner uuid,
      metadata jsonb not null default '{}'::jsonb,
      path_tokens text[],
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      last_accessed_at timestamptz
    );
    create index if not exists idx_storage_objects_bucket on storage.objects (bucket_id);
    create index if not exists idx_storage_objects_name on storage.objects (name);
    alter table storage.objects enable row level security;
    comment on table storage.objects is
      'Self-hosted compat: stub khớp Supabase Storage; thực tế self-hosted không lưu blob ở đây.';
  end if;
end $$;
