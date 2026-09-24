CREATE TABLE public.activation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid UNIQUE NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  whatsapp_e164 text NOT NULL CHECK (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  privacy_accepted_at timestamptz NOT NULL,
  privacy_notice_version text NOT NULL,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  marketing_opt_in_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 months'),
  CHECK ((marketing_opt_in AND marketing_opt_in_at IS NOT NULL) OR (NOT marketing_opt_in AND marketing_opt_in_at IS NULL))
);
GRANT ALL ON public.activation_participants TO service_role;
REVOKE ALL ON public.activation_participants FROM anon, authenticated;
ALTER TABLE public.activation_participants ENABLE ROW LEVEL SECURITY;
CREATE INDEX activation_participants_expires_idx ON public.activation_participants (expires_at);

CREATE OR REPLACE FUNCTION public.cleanup_activation_data()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE removed integer := 0; people integer := 0;
BEGIN
  removed := public.cleanup_print_jobs();
  WITH gone AS (DELETE FROM public.activation_participants WHERE expires_at <= now() RETURNING 1)
  SELECT count(*) INTO people FROM gone;
  RETURN removed + people;
END; $$;
REVOKE ALL ON FUNCTION public.cleanup_activation_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_activation_data() TO service_role;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('cleanup-activation-data', '17 * * * *', 'SELECT public.cleanup_activation_data();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível: %', SQLERRM;
END $$;