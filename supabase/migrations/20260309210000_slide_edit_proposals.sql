-- Đề xuất sửa/bổ sung slide – giáo viên đánh dấu đoạn, gõ nội dung đề xuất
create table if not exists slide_edit_proposals (
  id uuid default gen_random_uuid() primary key,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  slide_index int not null,
  block_index int not null,
  segment_type text not null check (segment_type in ('edit', 'add')),
  original_text text,
  proposed_text text not null,
  proposed_header text,
  proposed_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  agree_count int not null default 0,
  disagree_count int not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  approved_at timestamp with time zone
);

create index idx_slide_proposals_curriculum on slide_edit_proposals(curriculum_id);
create index idx_slide_proposals_status on slide_edit_proposals(status);
create index idx_slide_proposals_created on slide_edit_proposals(created_at desc);

alter table slide_edit_proposals enable row level security;

create policy "Authenticated users can view proposals"
  on slide_edit_proposals for select using (auth.uid() is not null);

create policy "Authenticated users can insert proposals"
  on slide_edit_proposals for insert with check (auth.uid() is not null);

create policy "Users can update own proposals"
  on slide_edit_proposals for update using (proposed_by = auth.uid());

comment on table slide_edit_proposals is 'Đề xuất sửa/bổ sung slide – 5 người đồng ý thì tự động áp dụng';

-- Phiếu bầu đồng ý/không đồng ý
create table if not exists slide_edit_votes (
  id uuid default gen_random_uuid() primary key,
  proposal_id uuid not null references slide_edit_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('agree', 'disagree')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(proposal_id, user_id)
);

create index idx_slide_votes_proposal on slide_edit_votes(proposal_id);

alter table slide_edit_votes enable row level security;

create policy "Authenticated users can view votes"
  on slide_edit_votes for select using (auth.uid() is not null);

create policy "Users can manage own votes"
  on slide_edit_votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table slide_edit_votes is 'Phiếu bầu đồng ý/không đồng ý cho đề xuất sửa slide';

-- Trigger: khi có vote mới, cập nhật agree_count/disagree_count
create or replace function update_slide_proposal_counts()
returns trigger as $$
declare
  p_id uuid;
begin
  p_id := coalesce(new.proposal_id, old.proposal_id);
  update slide_edit_proposals
  set
    agree_count = (select count(*)::int from slide_edit_votes where proposal_id = p_id and vote = 'agree'),
    disagree_count = (select count(*)::int from slide_edit_votes where proposal_id = p_id and vote = 'disagree')
  where id = p_id;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger on_slide_vote_change
after insert or update or delete on slide_edit_votes
for each row execute function update_slide_proposal_counts();

-- Admin cần full quyền (duyệt/thu hồi đề xuất)
create policy "Admin can manage all proposals"
  on slide_edit_proposals for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
