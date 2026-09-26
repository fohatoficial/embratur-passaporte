CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin ve o proprio registro" ON public.admin_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_active_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id AND active)
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_admin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_active_admin(uuid) TO authenticated;

GRANT SELECT ON public.activation_participants TO authenticated;
CREATE POLICY "administradores leem participantes" ON public.activation_participants
  FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));

CREATE TABLE public.admin_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT now(),
  row_count integer NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT ON public.admin_export_log TO authenticated;
GRANT ALL ON public.admin_export_log TO service_role;
ALTER TABLE public.admin_export_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin registra exportacao" ON public.admin_export_log
  FOR INSERT TO authenticated
  WITH CHECK (admin_user_id = auth.uid() AND public.is_active_admin(auth.uid()));
CREATE POLICY "admin le exportacoes" ON public.admin_export_log
  FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS ap_created_at_idx ON public.activation_participants (created_at DESC);
CREATE INDEX IF NOT EXISTS ap_origin_idx ON public.activation_participants (country_of_origin_code);
CREATE INDEX IF NOT EXISTS ap_age_idx ON public.activation_participants (age);
CREATE INDEX IF NOT EXISTS ap_name_idx ON public.activation_participants (name);
CREATE INDEX IF NOT EXISTS ap_marketing_idx ON public.activation_participants (marketing_opt_in);
CREATE INDEX IF NOT EXISTS ap_version_idx ON public.activation_participants (privacy_notice_version);
CREATE INDEX IF NOT EXISTS ap_name_trgm ON public.activation_participants USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ap_email_trgm ON public.activation_participants USING gin (email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ap_whatsapp_trgm ON public.activation_participants USING gin (whatsapp_e164 extensions.gin_trgm_ops);

-- Resumo filtrado; SECURITY INVOKER: a RLS garante que só administradores veem linhas.
CREATE OR REPLACE FUNCTION public.admin_participant_stats(
  p_search text DEFAULT NULL, p_country text DEFAULT NULL,
  p_age_min int DEFAULT NULL, p_age_max int DEFAULT NULL,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_marketing boolean DEFAULT NULL, p_privacy boolean DEFAULT NULL,
  p_version text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH f AS (
    SELECT * FROM public.activation_participants a
    WHERE (p_search IS NULL OR a.name ILIKE '%'||p_search||'%' OR a.email ILIKE '%'||p_search||'%' OR a.whatsapp_e164 ILIKE '%'||p_search||'%')
      AND (p_country IS NULL OR a.country_of_origin_code = p_country)
      AND (p_age_min IS NULL OR a.age >= p_age_min)
      AND (p_age_max IS NULL OR a.age <= p_age_max)
      AND (p_from IS NULL OR a.created_at >= p_from)
      AND (p_to IS NULL OR a.created_at < p_to)
      AND (p_marketing IS NULL OR a.marketing_opt_in = p_marketing)
      AND (p_privacy IS NULL OR (a.privacy_accepted_at IS NOT NULL) = p_privacy)
      AND (p_version IS NULL OR a.privacy_notice_version = p_version)
  )
  SELECT jsonb_build_object(
    'grand_total', (SELECT count(*) FROM public.activation_participants),
    'total', (SELECT count(*) FROM f),
    'today', (SELECT count(*) FROM f WHERE (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date),
    'last_hour', (SELECT count(*) FROM f WHERE created_at >= now() - interval '1 hour'),
    'marketing', (SELECT count(*) FROM f WHERE marketing_opt_in),
    'countries', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', code, 'name', name, 'count', n) ORDER BY n DESC)
       FROM (SELECT country_of_origin_code code, max(country_of_origin_name) name, count(*) n FROM f
             WHERE country_of_origin_code IS NOT NULL GROUP BY country_of_origin_code) c), '[]'::jsonb),
    'versions', COALESCE((SELECT jsonb_agg(DISTINCT privacy_notice_version) FROM public.activation_participants), '[]'::jsonb)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.admin_participant_stats(text,text,int,int,timestamptz,timestamptz,boolean,boolean,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_participant_stats(text,text,int,int,timestamptz,timestamptz,boolean,boolean,text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.activation_participants;