alter table public.worksheet_curricula
add column if not exists textbook_isbn text;

create index if not exists idx_worksheet_curricula_textbook_isbn
  on public.worksheet_curricula (textbook_isbn)
  where textbook_isbn is not null;
