-- Backfill old rows where stock-status text was mistakenly saved into price_hint.
-- Example: "Còn đủ size" should be in stock_note, not price_hint.

update public.messaging_partner_inventory
set
  stock_note = case
    when coalesce(trim(stock_note), '') = '' then trim(price_hint)
    when trim(stock_note) ~* '^\s*[\[{].*[\]}]\s*$'
      or trim(stock_note) ~* '("?(xs|s|m|l|xl|xxl|2xl|3xl|3[0-9]|4[0-9])"?)'
      then trim(price_hint) || ' | ' || trim(stock_note)
    else stock_note
  end,
  price_hint = ''
where coalesce(trim(price_hint), '') <> ''
  and trim(price_hint) ~* '(còn|con|hết|het|size|cỡ|co san|co hang|in stock|out of stock|available|sold out|pre-?order)'
  and trim(price_hint) !~* '(₫|\$|€|¥|£|vnd|vnđ|usd|eur|jpy|cny|krw|thb)'
  and trim(price_hint) !~ '[0-9][0-9\s\.,]{2,}';
