-- Hub chat: thread hội thoại + kế hoạch đa bước (Phase 3).

create table if not exists public.hub_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  locale text not null default 'vi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hub_chat_threads_user_updated
  on public.hub_chat_threads(user_id, updated_at desc);

create table if not exists public.hub_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.hub_chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  workflows_json jsonb,
  plan_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_hub_chat_messages_thread_created
  on public.hub_chat_messages(thread_id, created_at asc);

create table if not exists public.hub_multi_task_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.hub_chat_threads(id) on delete set null,
  title text not null,
  source_prompt text not null default '',
  locale text not null default 'vi',
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  current_step_index integer not null default 0 check (current_step_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hub_multi_task_plans_user_status
  on public.hub_multi_task_plans(user_id, status, updated_at desc);

create table if not exists public.hub_multi_task_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.hub_multi_task_plans(id) on delete cascade,
  step_index integer not null check (step_index >= 0),
  href text not null,
  label_key text not null default '',
  label text not null default '',
  prefill_prompt text not null default '',
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'skipped')),
  done_at timestamptz,
  unique (plan_id, step_index)
);

create index if not exists idx_hub_multi_task_steps_plan
  on public.hub_multi_task_steps(plan_id, step_index asc);

alter table public.hub_chat_threads enable row level security;
alter table public.hub_chat_messages enable row level security;
alter table public.hub_multi_task_plans enable row level security;
alter table public.hub_multi_task_steps enable row level security;

drop policy if exists hub_chat_threads_select_own on public.hub_chat_threads;
create policy hub_chat_threads_select_own on public.hub_chat_threads for select using (auth.uid() = user_id);
drop policy if exists hub_chat_threads_insert_own on public.hub_chat_threads;
create policy hub_chat_threads_insert_own on public.hub_chat_threads for insert with check (auth.uid() = user_id);
drop policy if exists hub_chat_threads_update_own on public.hub_chat_threads;
create policy hub_chat_threads_update_own on public.hub_chat_threads for update using (auth.uid() = user_id);

drop policy if exists hub_chat_messages_select_own on public.hub_chat_messages;
create policy hub_chat_messages_select_own on public.hub_chat_messages for select
  using (exists (select 1 from public.hub_chat_threads t where t.id = thread_id and t.user_id = auth.uid()));
drop policy if exists hub_chat_messages_insert_own on public.hub_chat_messages;
create policy hub_chat_messages_insert_own on public.hub_chat_messages for insert
  with check (exists (select 1 from public.hub_chat_threads t where t.id = thread_id and t.user_id = auth.uid()));

drop policy if exists hub_multi_task_plans_select_own on public.hub_multi_task_plans;
create policy hub_multi_task_plans_select_own on public.hub_multi_task_plans for select using (auth.uid() = user_id);
drop policy if exists hub_multi_task_plans_insert_own on public.hub_multi_task_plans;
create policy hub_multi_task_plans_insert_own on public.hub_multi_task_plans for insert with check (auth.uid() = user_id);
drop policy if exists hub_multi_task_plans_update_own on public.hub_multi_task_plans;
create policy hub_multi_task_plans_update_own on public.hub_multi_task_plans for update using (auth.uid() = user_id);

drop policy if exists hub_multi_task_steps_select_own on public.hub_multi_task_steps;
create policy hub_multi_task_steps_select_own on public.hub_multi_task_steps for select
  using (exists (select 1 from public.hub_multi_task_plans p where p.id = plan_id and p.user_id = auth.uid()));
drop policy if exists hub_multi_task_steps_insert_own on public.hub_multi_task_steps;
create policy hub_multi_task_steps_insert_own on public.hub_multi_task_steps for insert
  with check (exists (select 1 from public.hub_multi_task_plans p where p.id = plan_id and p.user_id = auth.uid()));
drop policy if exists hub_multi_task_steps_update_own on public.hub_multi_task_steps;
create policy hub_multi_task_steps_update_own on public.hub_multi_task_steps for update
  using (exists (select 1 from public.hub_multi_task_plans p where p.id = plan_id and p.user_id = auth.uid()));
