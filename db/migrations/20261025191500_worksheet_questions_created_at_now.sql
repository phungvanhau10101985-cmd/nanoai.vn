-- timezone('utc', now()) trả timestamp KHÔNG có múi giờ.
-- Session không phải UTC thì Postgres hiểu giờ UTC đó theo múi giờ session,
-- nên created_at lệch đúng bằng offset (local đang America/Los_Angeles thì hiện sớm 7 giờ).
-- now() là timestamptz, không bị cắt múi giờ.

alter table public.worksheet_questions
  alter column created_at set default now();
