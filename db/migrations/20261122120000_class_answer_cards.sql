-- Thẻ giấy A B C D của học sinh trong lớp.
-- Giáo viên lia điện thoại quét thẻ khi cả lớp làm trắc nghiệm. Xoay thẻ đổi đáp án.

create table if not exists public.class_answer_cards (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_no integer not null,
  card_token text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (class_id, user_id),
  constraint class_answer_cards_no_positive check (card_no between 1 and 500),
  constraint class_answer_cards_token_check check (card_token ~ '^[A-Za-z0-9_-]{8,32}$'),
  unique (class_id, card_no),
  unique (card_token)
);

create index if not exists idx_class_answer_cards_class on public.class_answer_cards(class_id);

alter table public.class_answer_cards enable row level security;

drop policy if exists "Class teachers read answer cards" on public.class_answer_cards;
create policy "Class teachers read answer cards"
  on public.class_answer_cards
  for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id
        and (
          c.teacher_id = auth.uid()
          or exists (
            select 1 from public.class_subjects s
            where s.class_id = c.id and s.teacher_id = auth.uid()
          )
        )
    )
  );

comment on table public.class_answer_cards is
  'Một thẻ giấy cho mỗi học sinh. Mã QR mang card_token. Chữ A ở trên khi mã đứng thẳng; xoay thẻ là đáp án B C D.';

create table if not exists public.answer_card_rounds (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subject_id text,
  title text not null,
  source_kind text not null,
  source_id uuid not null,
  phone_token text not null,
  status text not null default 'live',
  question_index integer not null default 0,
  show_results boolean not null default false,
  question_count integer not null,
  phone_seen_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  closed_at timestamp with time zone,
  constraint answer_card_rounds_kind_check check (source_kind in ('exam', 'worksheet')),
  constraint answer_card_rounds_status_check check (status in ('live', 'closed')),
  constraint answer_card_rounds_index_check check (question_index >= 0),
  constraint answer_card_rounds_count_check check (question_count between 1 and 200),
  constraint answer_card_rounds_token_check check (phone_token ~ '^[A-Za-z0-9_-]{16,64}$'),
  unique (phone_token)
);

create index if not exists idx_answer_card_rounds_class
  on public.answer_card_rounds(class_id, teacher_id, created_at desc);

alter table public.answer_card_rounds enable row level security;

drop policy if exists "Teachers read own answer card rounds" on public.answer_card_rounds;
create policy "Teachers read own answer card rounds"
  on public.answer_card_rounds
  for select
  using (teacher_id = auth.uid());

comment on table public.answer_card_rounds is
  'Một buổi quét thẻ trên lớp, gắn một đề hoặc phiếu. Điện thoại vào bằng phone_token.';

create table if not exists public.answer_card_questions (
  round_id uuid not null references public.answer_card_rounds(id) on delete cascade,
  question_index integer not null,
  prompt text not null,
  choices jsonb not null,
  correct_choice text not null,
  primary key (round_id, question_index),
  constraint answer_card_questions_index_check check (question_index >= 0),
  constraint answer_card_questions_correct_check check (correct_choice in ('A', 'B', 'C', 'D'))
);

alter table public.answer_card_questions enable row level security;

drop policy if exists "Teachers read own answer card questions" on public.answer_card_questions;
create policy "Teachers read own answer card questions"
  on public.answer_card_questions
  for select
  using (
    exists (
      select 1 from public.answer_card_rounds r
      where r.id = round_id and r.teacher_id = auth.uid()
    )
  );

comment on table public.answer_card_questions is
  'Câu trắc nghiệm A–D đã chụp lúc bắt đầu buổi quét. Đáp án đúng là chữ trên thẻ.';

create table if not exists public.answer_card_picks (
  round_id uuid not null references public.answer_card_rounds(id) on delete cascade,
  question_index integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  choice text not null,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (round_id, question_index, user_id),
  constraint answer_card_picks_choice_check check (choice in ('A', 'B', 'C', 'D'))
);

create index if not exists idx_answer_card_picks_round
  on public.answer_card_picks(round_id, question_index);

alter table public.answer_card_picks enable row level security;

drop policy if exists "Teachers read own answer card picks" on public.answer_card_picks;
create policy "Teachers read own answer card picks"
  on public.answer_card_picks
  for select
  using (
    exists (
      select 1 from public.answer_card_rounds r
      where r.id = round_id and r.teacher_id = auth.uid()
    )
  );

comment on table public.answer_card_picks is
  'Đáp án vừa quét của từng học sinh cho một câu. Quét lại thì ghi đè.';
