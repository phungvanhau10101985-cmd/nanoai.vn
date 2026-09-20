-- File taxonomy 188 ghi cat3 seo_index=noindex (landing nằm ở /c/{cluster}).
-- NanoAI không 301 cluster: URL L3 /c/{l1}/{l2}/{l3} chính là landing.
-- Import mới đã coerce L3 seo_index=true; bản đã import trước đó vẫn khóa noindex.
-- Live/sitemap vẫn noindex L3 khi 0 SP hoặc thiếu SEO đã sinh.

update public.messaging_partner_categories
set seo_index = true
where depth >= 3
  and seo_index is distinct from true;
