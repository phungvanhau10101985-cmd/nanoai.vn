-- Cờ hàng giả do Gemini 3.8 Flash ghi trước khi bản địa hóa ảnh.

alter table public.messaging_partner_inventory
  add column if not exists counterfeit_risk jsonb;

comment on column public.messaging_partner_inventory.counterfeit_risk is
  'Logo thương hiệu Gemini 3.8 Flash đọc được trước bản địa hóa. risk=true thì không bản địa hóa và không đưa vào feed.';

create index if not exists messaging_partner_inventory_counterfeit_risk_idx
  on public.messaging_partner_inventory (partner_id)
  where counterfeit_risk->>'risk' = 'true';
