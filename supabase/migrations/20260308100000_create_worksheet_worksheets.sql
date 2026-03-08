-- Bảng lưu phiếu bài tập (để QR code dẫn đến trang xem lời giải)
create table if not exists worksheet_worksheets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  topic text not null,
  subject_id text not null default 'toan',
  grade_level_id text not null default 'lop-6',
  content_markdown text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_worksheet_worksheets_user_id on worksheet_worksheets(user_id);
create index idx_worksheet_worksheets_created_at on worksheet_worksheets(created_at);

alter table worksheet_worksheets enable row level security;

-- User có thể tạo phiếu của mình
create policy "Users can insert own worksheets"
  on worksheet_worksheets for insert
  with check (user_id = auth.uid());

-- User có thể xem phiếu của mình
create policy "Users can view own worksheets"
  on worksheet_worksheets for select
  using (user_id = auth.uid());

-- Cho phép đọc công khai theo id (để trang /phieu-bai-tap/[id] hiển thị cho học sinh quét QR)
create policy "Public can view worksheet by id"
  on worksheet_worksheets for select
  using (true);

comment on table worksheet_worksheets is 'Phiếu bài tập AI - lưu để QR code dẫn đến trang xem lời giải';
