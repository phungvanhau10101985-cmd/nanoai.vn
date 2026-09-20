-- Hỏi đáp 188: 3 slot cố định trên mỗi câu hỏi — admin / user 1 / user 2.
-- Giữ bảng answers (identity khách) + gắn reply_slot, không nhân cột trên questions.

alter table public.messaging_partner_product_question_answers
  add column if not exists reply_slot text;

alter table public.messaging_partner_product_question_answers
  drop constraint if exists messaging_partner_product_question_answers_reply_slot_chk;

alter table public.messaging_partner_product_question_answers
  add constraint messaging_partner_product_question_answers_reply_slot_chk
  check (reply_slot is null or reply_slot in ('admin', 'user_one', 'user_two'));

comment on column public.messaging_partner_product_question_answers.reply_slot is
  '188 slots: admin | user_one | user_two. NULL = leftover ngoài 3 slot công khai.';

with ranked as (
  select
    id,
    case
      when answer_type = 'admin' then
        case row_number() over (
          partition by question_id, answer_type
          order by created_at asc, id asc
        )
          when 1 then 'admin'
          else null
        end
      when answer_type = 'buyer' then
        case row_number() over (
          partition by question_id, answer_type
          order by created_at asc, id asc
        )
          when 1 then 'user_one'
          when 2 then 'user_two'
          else null
        end
      else null
    end as slot
  from public.messaging_partner_product_question_answers
)
update public.messaging_partner_product_question_answers a
set reply_slot = r.slot
from ranked r
where a.id = r.id
  and a.reply_slot is null
  and r.slot is not null;

create unique index if not exists uq_messaging_partner_qa_reply_slot
  on public.messaging_partner_product_question_answers (question_id, reply_slot)
  where reply_slot is not null;
