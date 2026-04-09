-- Server gọi `select public.claim_referral_bonus_server(...)` qua DATABASE_URL (không qua RPC HTTP hosted).

GRANT EXECUTE ON FUNCTION public.claim_referral_bonus_server(uuid, uuid) TO postgres;
