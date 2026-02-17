-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,
  role text default 'user',

  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Create a table for credits
create table credits (
  user_id uuid references profiles(id) on delete cascade not null primary key,
  balance integer not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table credits enable row level security;

create policy "Users can view own credits." on credits
  for select using (auth.uid() = user_id);

-- Create a table for transactions
create type transaction_type as enum ('deposit', 'usage');
create type transaction_status as enum ('pending', 'completed', 'failed');

create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  amount integer not null,
  type transaction_type not null,
  status transaction_status not null default 'pending',
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table transactions enable row level security;

create policy "Users can view own transactions." on transactions
  for select using (auth.uid() = user_id);

-- Create a table for try_on_history
create type try_on_status as enum ('processing', 'completed', 'failed');

create table try_on_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  original_image_url text not null,
  garment_image_url text not null,
  result_image_url text,
  status try_on_status not null default 'processing',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table try_on_history enable row level security;

create policy "Users can view own try_on_history." on try_on_history
  for select using (auth.uid() = user_id);

create policy "Users can insert own try_on_history." on try_on_history
  for insert with check (auth.uid() = user_id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  
  insert into public.credits (user_id, balance)
  values (new.id, 2);
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
