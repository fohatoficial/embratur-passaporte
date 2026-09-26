ALTER TABLE public.activation_participants ALTER COLUMN whatsapp_e164 DROP NOT NULL;
ALTER TABLE public.activation_participants ALTER COLUMN country_code DROP NOT NULL;
COMMENT ON COLUMN public.activation_participants.whatsapp_e164 IS 'Histórico: telefone não é mais coletado (NULL em novos cadastros).';
COMMENT ON COLUMN public.activation_participants.country_code IS 'Histórico: DDI do telefone não é mais coletado (NULL em novos cadastros).';

CREATE OR REPLACE FUNCTION public.admin_participant_stats(p_search text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_age_min integer DEFAULT NULL::integer, p_age_max integer DEFAULT NULL::integer, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_marketing boolean DEFAULT NULL::boolean, p_privacy boolean DEFAULT NULL::boolean, p_version text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH f AS (
    SELECT * FROM public.activation_participants a
    WHERE (p_search IS NULL OR a.name ILIKE '%'||p_search||'%' OR a.email ILIKE '%'||p_search||'%')
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
$function$;