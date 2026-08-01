-- Hub landing shares: store editable semantic HTML for public publish

alter table public.hub_landing_page_shares
  add column if not exists html_source text;
