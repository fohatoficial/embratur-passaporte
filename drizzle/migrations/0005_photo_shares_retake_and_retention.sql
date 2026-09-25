ALTER TABLE public.photo_shares DROP CONSTRAINT IF EXISTS photo_shares_session_id_key;
DROP INDEX IF EXISTS public.photo_shares_session_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS photo_shares_active_session_key ON public.photo_shares (session_id) WHERE deleted_at IS NULL;
COMMENT ON COLUMN public.photo_shares.expires_at IS 'Definido pelo servidor: 12 meses para atendimentos com aviso 2026-09-25; registros anteriores mantem o prazo original.';
ALTER TABLE public.activation_participants ALTER COLUMN expires_at SET DEFAULT (now() + interval '12 months');