CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id text NOT NULL,
  image_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  error_message text
);

CREATE INDEX print_jobs_station_status_created_idx ON public.print_jobs (station_id, status, created_at);
CREATE INDEX print_jobs_status_idx ON public.print_jobs (status);
CREATE INDEX print_jobs_created_at_idx ON public.print_jobs (created_at);

GRANT SELECT, INSERT, UPDATE ON public.print_jobs TO anon;
GRANT SELECT, INSERT, UPDATE ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- O totem cria trabalhos apenas para a estação conhecida e sempre como "pending"
CREATE POLICY "totem cria trabalhos pendentes"
ON public.print_jobs FOR INSERT TO anon, authenticated
WITH CHECK (station_id = 'totem-1-printer' AND status = 'pending' AND attempts = 0);

-- Totem e estação acompanham somente trabalhos dessa estação
CREATE POLICY "acompanhar trabalhos da estacao"
ON public.print_jobs FOR SELECT TO anon, authenticated
USING (station_id = 'totem-1-printer');

-- A estação atualiza somente trabalhos dessa estação
CREATE POLICY "estacao atualiza trabalhos da estacao"
ON public.print_jobs FOR UPDATE TO anon, authenticated
USING (station_id = 'totem-1-printer')
WITH CHECK (station_id = 'totem-1-printer');

ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;

-- Limpeza de privacidade: remove arquivos e registros antigos
CREATE OR REPLACE FUNCTION public.cleanup_print_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer := 0;
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'print-jobs'
    AND name IN (
      SELECT image_path FROM public.print_jobs
      WHERE (status = 'sent' AND sent_at < now() - interval '1 hour')
         OR (status IN ('failed','cancelled') AND created_at < now() - interval '6 hours')
    );

  WITH gone AS (
    DELETE FROM public.print_jobs
    WHERE (status = 'sent' AND sent_at < now() - interval '1 hour')
       OR (status IN ('failed','cancelled') AND created_at < now() - interval '6 hours')
       OR created_at < now() - interval '24 hours'
    RETURNING 1
  )
  SELECT count(*) INTO removed FROM gone;

  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_print_jobs() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_print_jobs() TO service_role;