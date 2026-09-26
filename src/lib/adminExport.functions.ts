import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  EMPTY_FILTERS,
  PARTICIPANT_COLUMNS,
  applyFilters,
  dialCodeOf,
  fmtDate,
  fmtTime,
  normalizedFilters,
  type ParticipantFilters,
  type ParticipantRow,
} from "./adminParticipants";

const filtersSchema = z.object({
  search: z.string().max(200),
  country: z.string().max(4),
  ageMin: z.string().max(4),
  ageMax: z.string().max(4),
  dateFrom: z.string().max(12),
  dateTo: z.string().max(12),
  marketing: z.enum(["all", "yes", "no"]),
  privacy: z.enum(["all", "yes", "no"]),
  version: z.string().max(40),
});

const HEADERS = [
  "Data do cadastro", "Hora do cadastro", "Nome", "País de origem", "Código ISO do país", "Idade",
  "E-mail", "WhatsApp", "Código telefônico", "Autorização de privacidade", "Data do aceite de privacidade",
  "Versão do aviso de privacidade", "Autorização para comunicações", "Data da autorização para comunicações",
  "Identificador da sessão", "Data de expiração",
];

function cell(v: string | number | null | undefined) {
  const s = v == null ? "" : String(v);
  return /[";\r\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta CSV dos participantes filtrados. A RLS e is_active_admin garantem o acesso. */
export const exportParticipantsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filtersSchema.parse(d ?? EMPTY_FILTERS) as ParticipantFilters)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("is_active_admin", { _user_id: userId });
    if (roleErr || !isAdmin) return { ok: false as const, error: "forbidden" };

    const n = normalizedFilters(data);
    const rows: ParticipantRow[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 200000; from += PAGE) {
      const q = applyFilters(
        supabase.from("activation_participants").select(PARTICIPANT_COLUMNS),
        n,
      )
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      const { data: page, error } = await q;
      if (error) {
        console.error("admin-export failed", error.code);
        return { ok: false as const, error: "query-failed" };
      }
      rows.push(...((page ?? []) as unknown as ParticipantRow[]));
      if (!page || page.length < PAGE) break;
    }

    const lines = [HEADERS.map(cell).join(";")];
    for (const r of rows) {
      lines.push(
        [
          fmtDate(r.created_at), fmtTime(r.created_at), r.name, r.country_of_origin_name,
          r.country_of_origin_code, r.age, r.email, r.whatsapp_e164, dialCodeOf(r.country_code),
          r.privacy_accepted_at ? "Sim" : "Não", r.privacy_accepted_at ? `${fmtDate(r.privacy_accepted_at)} ${fmtTime(r.privacy_accepted_at)}` : "",
          r.privacy_notice_version, r.marketing_opt_in ? "Sim" : "Não",
          r.marketing_opt_in_at ? `${fmtDate(r.marketing_opt_in_at)} ${fmtTime(r.marketing_opt_in_at)}` : "",
          r.session_id, fmtDate(r.expires_at),
        ].map(cell).join(";"),
      );
    }

    const { error: logErr } = await supabase.from("admin_export_log").insert({
      admin_user_id: userId,
      row_count: rows.length,
      filters: n,
    });
    if (logErr) console.error("admin-export log failed", logErr.code);

    return { ok: true as const, csv: "\uFEFF" + lines.join("\r\n"), count: rows.length };
  });
