-- Disable signup bonus credits for new accounts.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  insert into public.credits (user_id, balance)
  values (new.id, 0);

  return new;
end;
$$ language plpgsql security definer;
