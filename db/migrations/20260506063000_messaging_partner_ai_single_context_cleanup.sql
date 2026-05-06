do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messaging_partner_ai_settings'
      and column_name = 'shop_policy'
  ) then
    update public.messaging_partner_ai_settings
    set product_consultation_context = trim(
      both E'\n' from concat_ws(
        E'\n\n',
        nullif(trim(product_consultation_context), ''),
        case
          when nullif(trim(shop_policy), '') is not null
            then 'Chính sách & quy định shop:' || E'\n' || trim(shop_policy)
          else null
        end,
        case
          when nullif(trim(tone_instructions), '') is not null
            then 'Giọng điệu / hướng dẫn trả lời:' || E'\n' || trim(tone_instructions)
          else null
        end,
        case
          when nullif(trim(sales_coaching_instructions), '') is not null
            then 'Gợi ý tư vấn & chốt đơn:' || E'\n' || trim(sales_coaching_instructions)
          else null
        end
      )
    )
    where nullif(trim(shop_policy), '') is not null
       or nullif(trim(tone_instructions), '') is not null
       or nullif(trim(sales_coaching_instructions), '') is not null;
  end if;
end $$;

alter table public.messaging_partner_ai_settings
  drop column if exists shop_policy,
  drop column if exists tone_instructions,
  drop column if exists sales_coaching_instructions;

comment on column public.messaging_partner_ai_settings.product_consultation_context is
  'Single shop-authored AI context/instructions field used by all fashion partner AI turns.';
