-- Chat widgets from the 188 embed tab: Facebook customer chat, Zalo OA, personal Zalo, Zalo custom HTML.

alter table public.messaging_partners
  add column if not exists facebook_chat_page_id text,
  add column if not exists zalo_oa_id text,
  add column if not exists zalo_personal_url text,
  add column if not exists zalo_custom_html text;

comment on column public.messaging_partners.facebook_chat_page_id is 'Facebook Page ID for the customer chat plugin';
comment on column public.messaging_partners.zalo_oa_id is 'Zalo Official Account ID for the chat widget';
comment on column public.messaging_partners.zalo_personal_url is 'https://zalo.me/… for the shop chat button; not injected as a widget';
comment on column public.messaging_partners.zalo_custom_html is 'Sanitized extra Zalo HTML (ZNS and similar) before body close';
