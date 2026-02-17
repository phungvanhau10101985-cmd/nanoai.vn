-- Ngành hàng tài liệu (cho thống kê và lọc)
alter table try_on_history add column if not exists industry text;
create index if not exists idx_try_on_history_industry on try_on_history(industry) where feature = 'translate';

-- Retry round: 1 = lần đầu, 2 = dịch lại do sót từ
alter table translate_jobs add column if not exists retry_round int default 1;
