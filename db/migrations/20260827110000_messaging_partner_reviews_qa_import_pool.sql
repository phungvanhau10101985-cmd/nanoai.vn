-- Pool đánh giá / hỏi đáp ảo theo nhóm (188.com.vn import Excel).
-- Additive: thêm is_imported + import_group; nới inventory_id + identity cho dòng import.
-- Review thật vẫn UNIQUE 1 người / 1 SP. Ảnh review vẫn hiện công khai.

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
alter table public.messaging_partner_product_reviews
  add column if not exists is_imported boolean not null default false;

alter table public.messaging_partner_product_reviews
  add column if not exists import_group int not null default 0;

alter table public.messaging_partner_product_reviews
  alter column inventory_id drop not null;

alter table public.messaging_partner_product_reviews
  drop constraint if exists messaging_partner_product_reviews_reviewer_identity;

alter table public.messaging_partner_product_reviews
  add constraint messaging_partner_product_reviews_reviewer_identity check (
    is_imported = true
    or guest_account_id is not null
    or linked_user_id is not null
  );

alter table public.messaging_partner_product_reviews
  drop constraint if exists messaging_partner_product_reviews_import_inventory;

alter table public.messaging_partner_product_reviews
  add constraint messaging_partner_product_reviews_import_inventory check (
    (is_imported = true and inventory_id is null)
    or (is_imported = false and inventory_id is not null)
  );

alter table public.messaging_partner_product_reviews
  drop constraint if exists messaging_partner_product_reviews_import_group_nonneg;

alter table public.messaging_partner_product_reviews
  add constraint messaging_partner_product_reviews_import_group_nonneg check (import_group >= 0);

comment on column public.messaging_partner_product_reviews.is_imported is
  'true = dòng Excel ảo (inventory_id null). Hiện trên mọi SP cùng import_group = rating_group_id (coalesce 888).';
comment on column public.messaging_partner_product_reviews.import_group is
  'Nhóm đánh giá 188 (cột Nhóm đánh giá). Join với messaging_partner_inventory.rating_group_id.';

create index if not exists idx_messaging_partner_product_reviews_import_pool
  on public.messaging_partner_product_reviews (partner_id, import_group)
  where is_imported = true and is_active = true;

-- ---------------------------------------------------------------------------
-- Questions
-- ---------------------------------------------------------------------------
alter table public.messaging_partner_product_questions
  add column if not exists is_imported boolean not null default false;

alter table public.messaging_partner_product_questions
  add column if not exists import_group int not null default 0;

alter table public.messaging_partner_product_questions
  add column if not exists useful_count int not null default 0;

alter table public.messaging_partner_product_questions
  alter column inventory_id drop not null;

alter table public.messaging_partner_product_questions
  drop constraint if exists messaging_partner_product_questions_asker_identity;

alter table public.messaging_partner_product_questions
  add constraint messaging_partner_product_questions_asker_identity check (
    is_imported = true
    or guest_account_id is not null
    or linked_user_id is not null
  );

alter table public.messaging_partner_product_questions
  drop constraint if exists messaging_partner_product_questions_import_inventory;

alter table public.messaging_partner_product_questions
  add constraint messaging_partner_product_questions_import_inventory check (
    (is_imported = true and inventory_id is null)
    or (is_imported = false and inventory_id is not null)
  );

alter table public.messaging_partner_product_questions
  drop constraint if exists messaging_partner_product_questions_import_group_nonneg;

alter table public.messaging_partner_product_questions
  add constraint messaging_partner_product_questions_import_group_nonneg check (import_group >= 0);

alter table public.messaging_partner_product_questions
  drop constraint if exists messaging_partner_product_questions_useful_nonneg;

alter table public.messaging_partner_product_questions
  add constraint messaging_partner_product_questions_useful_nonneg check (useful_count >= 0);

comment on column public.messaging_partner_product_questions.is_imported is
  'true = dòng Excel ảo (inventory_id null). Hiện trên mọi SP cùng import_group = question_group_id (coalesce 888).';
comment on column public.messaging_partner_product_questions.import_group is
  'Nhóm hỏi đáp 188 (cột Nhóm). Join với messaging_partner_inventory.question_group_id.';

create index if not exists idx_messaging_partner_product_questions_import_pool
  on public.messaging_partner_product_questions (partner_id, import_group)
  where is_imported = true and is_active = true;

-- Vote hữu ích câu hỏi — giống review votes (188 có Hữu ích trên Q&A).
create table if not exists public.messaging_partner_product_question_votes (
  question_id uuid not null references public.messaging_partner_product_questions (id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  primary key (question_id, voter_key)
);

comment on column public.messaging_partner_product_question_votes.voter_key is
  'guest_account_id hoặc linked_user_id (dạng text) — 1 người chỉ vote 1 lần / câu hỏi.';

alter table public.messaging_partner_product_question_votes enable row level security;

drop policy if exists "Question votes are public read." on public.messaging_partner_product_question_votes;
create policy "Question votes are public read." on public.messaging_partner_product_question_votes
  for select using (true);
