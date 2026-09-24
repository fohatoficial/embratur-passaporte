import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  COUNTRY_CODES,
  PRIVACY_NOTICE_VERSION,
  normalizeName,
  normalizeWhatsapp,
} from "./participant";

const schema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().max(200),
  whatsapp: z.string().max(40),
  country: z.enum(COUNTRY_CODES),
  privacyAccepted: z.literal(true),
  marketingOptIn: z.boolean(),
});

/**
 * register-activation-participant: valida e normaliza no servidor, define
 * horários e versão do aviso, e é idempotente por session_id.
 * Nunca registra nome ou telefone em logs.
 */
export const registerActivationParticipant = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const name = normalizeName(data.name);
    const e164 = normalizeWhatsapp(data.whatsapp, data.country);
    if (!name || !e164) return { ok: false as const, error: "invalid" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin.from("activation_participants").upsert(
      {
        session_id: data.sessionId,
        name,
        whatsapp_e164: e164,
        country_code: data.country,
        privacy_accepted_at: now,
        privacy_notice_version: PRIVACY_NOTICE_VERSION,
        marketing_opt_in: data.marketingOptIn,
        marketing_opt_in_at: data.marketingOptIn ? now : null,
      },
      { onConflict: "session_id", ignoreDuplicates: true },
    );
    if (error) {
      console.error("register-participant failed", error.code);
      return { ok: false as const, error: "save-failed" };
    }

    const { data: row, error: readError } = await supabaseAdmin
      .from("activation_participants")
      .select("id")
      .eq("session_id", data.sessionId)
      .single();
    if (readError || !row) {
      console.error("register-participant read failed", readError?.code);
      return { ok: false as const, error: "save-failed" };
    }
    return { ok: true as const, participantId: row.id };
  });
