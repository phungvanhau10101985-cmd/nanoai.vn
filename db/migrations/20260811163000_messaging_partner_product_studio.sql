-- PS.1 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md — Product Studio): đăng sản phẩm thủ công/AI.
-- Additive-only: KHÔNG đổi ý nghĩa cột hiện có trên messaging_partner_inventory. Quy ước cũ
-- (colors giấu trong stock_note JSON, sizes giấu trong description JSON — xem
-- src/lib/messaging/inventory-color-variants.ts, src/lib/partner-website/shop/partner-shop-industry-facets.ts)
-- vẫn là fallback đọc — cột mới ưu tiên khi có, không có thì đọc lại cột cũ (tương thích ngược 100%).

alter table public.messaging_partner_inventory
  add column if not exists colors_json jsonb null,
  add column if not exists sizes_json jsonb null,
  add column if not exists gallery_urls jsonb not null default '[]'::jsonb,
  add column if not exists detail_image_urls jsonb not null default '[]'::jsonb,
  add column if not exists product_studio_meta jsonb null,
  add column if not exists origin text null,
  add column if not exists product_studio_job_id uuid null;

comment on column public.messaging_partner_inventory.colors_json is
  'PS.1 — [{"name","img"}] có cấu trúc, ưu tiên đọc trước stock_note JSON (quy ước cũ vẫn fallback).';
comment on column public.messaging_partner_inventory.sizes_json is
  'PS.1 — string[] có cấu trúc, ưu tiên đọc trước description JSON (quy ước cũ vẫn fallback).';
comment on column public.messaging_partner_inventory.gallery_urls is
  'PS.1 — ảnh phụ bổ sung (Product Studio AI hoặc upload nhiều ảnh thủ công) — nối THÊM vào gallery hiện có (main+màu+material/real-use), không thay thế.';
comment on column public.messaging_partner_inventory.detail_image_urls is
  'PS.1 — ảnh chi tiết/chất liệu do Product Studio sinh — hiển thị cạnh gallery, không thay thế material_detail_image_url hiện có.';
comment on column public.messaging_partner_inventory.product_studio_meta is
  'PS.1 — snapshot mode/model_presence/shot_style/vision_analysis... của lần đăng SP (chỉ để tham khảo/hỗ trợ, không dùng cho logic hiển thị công khai).';
comment on column public.messaging_partner_inventory.origin is
  'PS.1 — nguồn tạo dòng: manual | manual_ai | import | chat. NULL = dữ liệu cũ trước tính năng này.';

alter table public.messaging_partner_inventory
  drop constraint if exists messaging_partner_inventory_origin_check;
alter table public.messaging_partner_inventory
  add constraint messaging_partner_inventory_origin_check
  check (origin is null or origin in ('manual', 'manual_ai', 'import', 'chat'));

-- PS.8 — cho phép AI tự mở rộng cây danh mục khi đăng sản phẩm (khớp node có sẵn trước, chỉ tạo
-- mới khi không có node phù hợp ở đúng cấp) — badge "AI tạo, cần xem lại" trong admin panel tới
-- khi merchant tự sửa (xoá cờ), tái dùng đúng UI CRUD/move/xoá đã có ở W4.4 — không có gì mất
-- kiểm soát vì mọi node AI tạo đều sửa/gộp/xoá được như node thường.
alter table public.messaging_partner_categories
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_generated_at timestamptz null;

comment on column public.messaging_partner_categories.ai_generated is
  'PS.8 — true nếu node này do Product Studio AI tự tạo khi đăng sản phẩm (không phải merchant tạo tay). Xoá cờ khi merchant chỉnh sửa thủ công.';

-- Job đăng sản phẩm (thủ công chạy 1 bước "done" ngay; AI đi qua studio nhiều slot trước khi publish).
create table if not exists public.messaging_partner_product_studio_jobs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  created_by uuid null,
  mode text not null check (mode in ('manual', 'ai')),
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready_for_review', 'publishing', 'done', 'failed')),
  step text null,
  message text null,
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  payload jsonb not null default '{}'::jsonb,
  studio jsonb not null default '{}'::jsonb,
  vision_product_name text null,
  vision_analysis text null,
  vision_colors jsonb not null default '[]'::jsonb,
  result jsonb null,
  error_message text null,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.messaging_partner_product_studio_jobs is
  'PS.1 — phiên đăng sản phẩm thủ công/AI (Product Studio). Sống sót restart/refresh — cron resume job kẹt ở generating/publishing (PS.2).';

create index if not exists idx_messaging_partner_product_studio_jobs_partner_created
  on public.messaging_partner_product_studio_jobs (partner_id, created_at desc);

create index if not exists idx_messaging_partner_product_studio_jobs_status
  on public.messaging_partner_product_studio_jobs (status, updated_at)
  where status in ('generating', 'publishing');

create or replace function public.trg_messaging_partner_product_studio_jobs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_product_studio_jobs_set_updated_at
  on public.messaging_partner_product_studio_jobs;
create trigger tr_messaging_partner_product_studio_jobs_set_updated_at
  before update on public.messaging_partner_product_studio_jobs
  for each row
  execute function public.trg_messaging_partner_product_studio_jobs_set_updated_at();

alter table public.messaging_partner_product_studio_jobs enable row level security;

drop policy if exists "Partner product studio job owners manage own jobs." on public.messaging_partner_product_studio_jobs;
create policy "Partner product studio job owners manage own jobs." on public.messaging_partner_product_studio_jobs
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_product_studio_jobs.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_product_studio_jobs.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

-- product_studio_job_id trỏ tới job — thêm FK sau khi bảng job đã tồn tại (additive, ON DELETE SET NULL
-- để xoá job không kéo theo xoá sản phẩm đã đăng thành công).
alter table public.messaging_partner_inventory
  drop constraint if exists messaging_partner_inventory_product_studio_job_fk;
alter table public.messaging_partner_inventory
  add constraint messaging_partner_inventory_product_studio_job_fk
  foreign key (product_studio_job_id)
  references public.messaging_partner_product_studio_jobs (id)
  on delete set null;
