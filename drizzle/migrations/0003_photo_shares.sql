CREATE TABLE public.photo_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NULL,
  session_id uuid NOT NULL UNIQUE,
  token_hash text UNIQUE NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  story_path text NOT NULL,
  post_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  deleted_at timestamptz NULL
);
GRANT ALL ON public.photo_shares TO service_role;
ALTER TABLE public.photo_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cleanup_photo_shares()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE removed integer := 0;
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'visitor-social-photos'
    AND name IN (
      SELECT story_path FROM public.photo_shares WHERE expires_at <= now() OR deleted_at IS NOT NULL
      UNION ALL
      SELECT post_path FROM public.photo_shares WHERE expires_at <= now() OR deleted_at IS NOT NULL
    );
  WITH gone AS (
    DELETE FROM public.photo_shares
    WHERE expires_at <= now() OR deleted_at IS NOT NULL
    RETURNING 1
  ) SELECT count(*) INTO removed FROM gone;
  RETURN removed;
END; $$;
REVOKE ALL ON FUNCTION public.cleanup_photo_shares() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_activation_data()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE removed integer := 0; people integer := 0; shares integer := 0;
BEGIN
  removed := public.cleanup_print_jobs();
  shares := public.cleanup_photo_shares();
  WITH gone AS (DELETE FROM public.activation_participants WHERE expires_at <= now() RETURNING 1)
  SELECT count(*) INTO people FROM gone;
  RETURN removed + people + shares;
END; $function$;