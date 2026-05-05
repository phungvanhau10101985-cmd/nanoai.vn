-- VietQR tách cô dâu / chú rể cho hộp mừng cưới (img.vietqr.io).
alter table public.wedding_cards
  add column if not exists groom_gift_bank_id text not null default '',
  add column if not exists groom_gift_account_no text not null default '',
  add column if not exists groom_gift_account_name text not null default '',
  add column if not exists bride_gift_bank_id text not null default '',
  add column if not exists bride_gift_account_no text not null default '',
  add column if not exists bride_gift_account_name text not null default '';

comment on column public.wedding_cards.groom_gift_bank_id is 'Mã ngân hàng VietQR (bank code, ví dụ VCB).';
comment on column public.wedding_cards.groom_gift_account_no is 'Số tài khoản chú rể cho VietQR.';
comment on column public.wedding_cards.groom_gift_account_name is 'Tên chủ TK chú rể (accountName query).';
comment on column public.wedding_cards.bride_gift_bank_id is 'Mã ngân hàng VietQR cô dâu.';
comment on column public.wedding_cards.bride_gift_account_no is 'Số TK cô dâu.';
comment on column public.wedding_cards.bride_gift_account_name is 'Tên chủ TK cô dâu.';
