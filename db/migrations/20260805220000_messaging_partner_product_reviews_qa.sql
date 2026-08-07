-- W1.5 + M1.2 + M1.3 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md): đánh giá + hỏi đáp sản phẩm.
-- Xem docs/188_BEHAVIOR_SPEC.md mục C — làm ĐÚNG các điểm 188 làm sai:
--   * Rating trung bình/histogram TÍNH THẬT từ bảng review (không dùng field ảo).
--   * Ảnh review HIỂN THỊ công khai (188 lưu nhưng giấu).
--   * Enforce UNIQUE (partner, inventory, người mua) THẬT ở DB, không chỉ ẩn nút ở UI.
-- Additive-only: không đổi schema messaging_partner_inventory/orders hiện có.

-- Đánh giá sản phẩm. Chỉ người có đơn hàng paid_verified + shipping delivered mới review được
-- (verified purchase tự nhiên — kiểm tra ở tầng ứng dụng khi insert, không thể enforce bằng check
-- constraint thường vì cần join orders/order_lines).
create table if not exists public.messaging_partner_product_reviews (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  inventory_id uuid not null references public.messaging_partner_inventory (id) on delete cascade,
  order_id uuid references public.messaging_partner_orders (id) on delete set null,
  order_line_id uuid references public.messaging_partner_order_lines (id) on delete set null,
  guest_account_id uuid references public.messaging_guest_accounts (id) on delete set null,
  linked_user_id uuid references auth.users (id) on delete set null,
  reviewer_name text not null default '',
  rating smallint not null,
  title text not null default '',
  content text not null,
  image_urls jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  useful_count int not null default 0,
  merchant_reply text not null default '',
  merchant_reply_by text not null default '',
  merchant_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_product_reviews_rating_range check (rating >= 1 and rating <= 5),
  constraint messaging_partner_product_reviews_content_len check (char_length(content) >= 1 and char_length(content) <= 4000),
  constraint messaging_partner_product_reviews_title_len check (char_length(title) <= 200),
  constraint messaging_partner_product_reviews_useful_nonneg check (useful_count >= 0),
  constraint messaging_partner_product_reviews_reviewer_identity check (
    guest_account_id is not null or linked_user_id is not null
  )
);

comment on table public.messaging_partner_product_reviews is
  'Đánh giá sản phẩm theo shop. 100% review là verified purchase (điều kiện kiểm ở tầng ứng dụng khi insert) — không cần badge riêng.';
comment on column public.messaging_partner_product_reviews.image_urls is
  'Mảng URL ảnh do khách đính kèm khi review — hiển thị công khai trên PDP/danh mục (khác 188: 188 lưu nhưng giấu ảnh này).';

-- 1 người mua chỉ review 1 lần / sản phẩm (enforce thật ở DB, không chỉ ẩn UI như 188).
create unique index if not exists uq_messaging_partner_product_reviews_guest
  on public.messaging_partner_product_reviews (partner_id, inventory_id, guest_account_id)
  where guest_account_id is not null;

create unique index if not exists uq_messaging_partner_product_reviews_user
  on public.messaging_partner_product_reviews (partner_id, inventory_id, linked_user_id)
  where linked_user_id is not null;

create index if not exists idx_messaging_partner_product_reviews_public
  on public.messaging_partner_product_reviews (inventory_id, is_active, created_at desc);

create index if not exists idx_messaging_partner_product_reviews_admin
  on public.messaging_partner_product_reviews (partner_id, created_at desc);

create or replace function public.trg_messaging_partner_product_reviews_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_product_reviews_set_updated_at
  on public.messaging_partner_product_reviews;
create trigger tr_messaging_partner_product_reviews_set_updated_at
  before update on public.messaging_partner_product_reviews
  for each row
  execute function public.trg_messaging_partner_product_reviews_set_updated_at();

alter table public.messaging_partner_product_reviews enable row level security;

drop policy if exists "Partner review owners manage own reviews." on public.messaging_partner_product_reviews;
create policy "Partner review owners manage own reviews." on public.messaging_partner_product_reviews
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_product_reviews.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_product_reviews.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Active partner reviews are public." on public.messaging_partner_product_reviews;
create policy "Active partner reviews are public." on public.messaging_partner_product_reviews
  for select using (is_active = true);

-- Vote hữu ích — toggle unique (review_id, voter_key), tăng/giảm useful_count ở tầng ứng dụng.
create table if not exists public.messaging_partner_product_review_votes (
  review_id uuid not null references public.messaging_partner_product_reviews (id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  primary key (review_id, voter_key)
);

comment on column public.messaging_partner_product_review_votes.voter_key is
  'guest_account_id hoặc linked_user_id (dạng text) của người vote — 1 người chỉ vote 1 lần / review.';

alter table public.messaging_partner_product_review_votes enable row level security;

drop policy if exists "Review votes are public read." on public.messaging_partner_product_review_votes;
create policy "Review votes are public read." on public.messaging_partner_product_review_votes
  for select using (true);

-- Hỏi đáp sản phẩm. Hỏi: chỉ cần đăng nhập, không cần mua hàng (hạ rào cản, tăng nội dung SEO).
create table if not exists public.messaging_partner_product_questions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  inventory_id uuid not null references public.messaging_partner_inventory (id) on delete cascade,
  guest_account_id uuid references public.messaging_guest_accounts (id) on delete set null,
  linked_user_id uuid references auth.users (id) on delete set null,
  asker_name text not null default '',
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_product_questions_content_len check (char_length(content) >= 1 and char_length(content) <= 1000),
  constraint messaging_partner_product_questions_asker_identity check (
    guest_account_id is not null or linked_user_id is not null
  )
);

create index if not exists idx_messaging_partner_product_questions_public
  on public.messaging_partner_product_questions (inventory_id, is_active, created_at desc);

create index if not exists idx_messaging_partner_product_questions_admin
  on public.messaging_partner_product_questions (partner_id, created_at desc);

create or replace function public.trg_messaging_partner_product_questions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_product_questions_set_updated_at
  on public.messaging_partner_product_questions;
create trigger tr_messaging_partner_product_questions_set_updated_at
  before update on public.messaging_partner_product_questions
  for each row
  execute function public.trg_messaging_partner_product_questions_set_updated_at();

alter table public.messaging_partner_product_questions enable row level security;

drop policy if exists "Partner question owners manage own questions." on public.messaging_partner_product_questions;
create policy "Partner question owners manage own questions." on public.messaging_partner_product_questions
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_product_questions.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_product_questions.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Active partner questions are public." on public.messaging_partner_product_questions;
create policy "Active partner questions are public." on public.messaging_partner_product_questions
  for select using (is_active = true);

-- Trả lời: buyer (giới hạn số slot ở tầng ứng dụng, mặc định 2 — xem QA_BUYER_ANSWER_LIMIT trong TS)
-- + admin (không giới hạn, hiển thị riêng, không cần điều kiện mua hàng).
create table if not exists public.messaging_partner_product_question_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.messaging_partner_product_questions (id) on delete cascade,
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  answer_type text not null,
  guest_account_id uuid references public.messaging_guest_accounts (id) on delete set null,
  linked_user_id uuid references auth.users (id) on delete set null,
  responder_name text not null default '',
  content text not null,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_product_question_answers_type check (answer_type in ('buyer', 'admin')),
  constraint messaging_partner_product_question_answers_content_len check (char_length(content) >= 1 and char_length(content) <= 2000)
);

comment on column public.messaging_partner_product_question_answers.is_verified is
  'true nếu answer_type=buyer VÀ người trả lời có đơn hàng (không huỷ) chứa đúng sản phẩm đó tại thời điểm trả lời.';

create index if not exists idx_messaging_partner_product_question_answers_question
  on public.messaging_partner_product_question_answers (question_id, is_active, created_at);

create index if not exists idx_messaging_partner_product_question_answers_admin
  on public.messaging_partner_product_question_answers (partner_id, created_at desc);

create or replace function public.trg_messaging_partner_product_question_answers_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_product_question_answers_set_updated_at
  on public.messaging_partner_product_question_answers;
create trigger tr_messaging_partner_product_question_answers_set_updated_at
  before update on public.messaging_partner_product_question_answers
  for each row
  execute function public.trg_messaging_partner_product_question_answers_set_updated_at();

alter table public.messaging_partner_product_question_answers enable row level security;

drop policy if exists "Partner answer owners manage own answers." on public.messaging_partner_product_question_answers;
create policy "Partner answer owners manage own answers." on public.messaging_partner_product_question_answers
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_product_question_answers.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_product_question_answers.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Active partner answers are public." on public.messaging_partner_product_question_answers;
create policy "Active partner answers are public." on public.messaging_partner_product_question_answers
  for select using (is_active = true);

-- M1.2/M1.3: cấu hình theo shop — mặc định tự động hiện công khai ngay (giống 188), merchant có thể
-- bật "cần duyệt trước" nếu muốn kiểm duyệt review trước khi hiện public (188 không có tuỳ chọn này).
alter table public.messaging_partners
  add column if not exists review_requires_approval boolean not null default false;

comment on column public.messaging_partners.review_requires_approval is
  'true = review mới insert với is_active=false, chờ merchant duyệt. false (mặc định) = hiện công khai ngay khi gửi, giống hành vi 188.';
