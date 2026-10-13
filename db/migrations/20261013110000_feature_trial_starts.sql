-- Mốc dùng thử gói giáo trình (giáo viên) và gói học sinh.
-- Đồng hồ chạy từ lần đầu dùng đúng tính năng, không từ lúc tạo tài khoản.

create table if not exists public.feature_trial_starts (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  started_at timestamptz not null,
  primary key (user_id, feature),
  constraint feature_trial_starts_feature_chk check (feature in ('curriculum', 'student'))
);

comment on table public.feature_trial_starts is
  'curriculum: lần đầu tạo/lưu giáo trình, phiếu, bài thi hoặc gọi AI giáo trình. student: lần đầu gửi bài chữa hoặc hỏi gia sư.';
