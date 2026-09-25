import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SHARE_BUCKET, SHARE_TTL_HOURS, TOKEN_PATTERN, shareUrlFor } from "./shareConfig";

/**
 * create-photo-share / get-photo-share / delete-photo-share.
 * Somente o hash SHA-256 do token vai para o banco; logs contêm apenas
 * códigos técnicos (nunca imagens, tokens, nome ou telefone).
 */

const MAX_BYTES = 8 * 1024 * 1024;
const SIGNED_URL_SECONDS = 600;
const SIZES = { story: [1080, 1920] } as const;

function toBase64Url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Assinatura PNG + largura/altura lidas do cabeçalho IHDR. */
function pngSize(b: Uint8Array): [number, number] | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || sig.some((v, i) => b[i] !== v)) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

const uuid = z.string().uuid();

export const createPhotoShare = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("invalid-payload");
    const sessionId = uuid.parse(data.get("sessionId"));
    const rawParticipant = data.get("participantId");
    const participantId = rawParticipant ? uuid.parse(rawParticipant) : null;
    const story = data.get("story");
    if (!(story instanceof File)) throw new Error("missing-file");
    for (const f of [story]) {
      if (f.type !== "image/png" || f.size === 0 || f.size > MAX_BYTES) throw new Error("invalid-file");
    }
    return { sessionId, participantId, story };
  })
  .handler(async ({ data }) => {
    const fail = (code: string) => {
      console.error("create-photo-share", code);
      return { ok: false as const, error: code };
    };

    const files = {
      story: new Uint8Array(await data.story.arrayBuffer()),
    };
    for (const key of ["story"] as const) {
      const size = pngSize(files[key]);
      if (!size || size[0] !== SIZES[key][0] || size[1] !== SIZES[key][1]) return fail("invalid-dimensions");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // o atendimento precisa existir (cadastro realizado)
    const { data: participant } = await supabaseAdmin
      .from("activation_participants")
      .select("id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!participant) return fail("invalid-session");
    if (data.participantId && data.participantId !== participant.id) return fail("invalid-session");

    const { data: existing } = await supabaseAdmin
      .from("photo_shares")
      .select("id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (existing) return fail("already-exists");

    const shareId = crypto.randomUUID();
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = toBase64Url(tokenBytes);
    const tokenHash = await sha256Hex(token);
    const storyPath = `${shareId}/story.png`;

    const bucket = supabaseAdmin.storage.from(SHARE_BUCKET);
    const up1 = await bucket.upload(storyPath, files.story, { contentType: "image/png" });
    if (up1.error) {
      await bucket.remove([storyPath]);
      return fail("upload-failed");
    }

    const expiresAt = new Date(Date.now() + SHARE_TTL_HOURS * 3600_000).toISOString();
    const { error } = await supabaseAdmin.from("photo_shares").insert({
      id: shareId,
      participant_id: participant.id,
      session_id: data.sessionId,
      token_hash: tokenHash,
      story_path: storyPath,
      expires_at: expiresAt,
    });
    if (error) {
      // nenhum token incompleto: arquivos removidos
      await bucket.remove([storyPath]);
      return fail("save-failed");
    }

    return { ok: true as const, token, url: shareUrlFor(token), expiresAt };
  });

const tokenInput = z.object({ token: z.string().regex(TOKEN_PATTERN) });

async function findActive(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("photo_shares")
    .select("id, story_path, post_path, expires_at, deleted_at")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!data || data.deleted_at || new Date(data.expires_at).getTime() <= Date.now()) {
    return { supabaseAdmin, share: null };
  }
  return { supabaseAdmin, share: data };
}

export const getPhotoShare = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, share } = await findActive(data.token);
    if (!share) return { ok: false as const };
    const { data: signed, error } = await supabaseAdmin.storage
      .from(SHARE_BUCKET)
      .createSignedUrls([share.story_path], SIGNED_URL_SECONDS);
    if (error || !signed || signed.some((s) => !s.signedUrl)) {
      console.error("get-photo-share", "sign-failed");
      return { ok: false as const };
    }
    return {
      ok: true as const,
      storyUrl: signed[0]!.signedUrl,
      expiresAt: share.expires_at,
    };
  });

/** Só verifica o estado — não assina nenhuma URL. */
export const getPhotoShareStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("photo_shares")
      .select("expires_at, deleted_at")
      .eq("token_hash", await sha256Hex(data.token))
      .maybeSingle();
    if (!row) return { status: "expired" as const };
    if (row.deleted_at) return { status: "deleted" as const };
    if (new Date(row.expires_at).getTime() <= Date.now()) return { status: "expired" as const };
    return { status: "active" as const };
  });

/** URL assinada de curta duração, criada só no toque em COMPARTIR. */
export const signPhotoShareStory = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, share } = await findActive(data.token);
    if (!share) return { ok: false as const };
    const { data: signed, error } = await supabaseAdmin.storage
      .from(SHARE_BUCKET)
      .createSignedUrl(share.story_path, 60);
    if (error || !signed?.signedUrl) {
      console.error("sign-photo-share", "sign-failed");
      return { ok: false as const };
    }
    return { ok: true as const, url: signed.signedUrl };
  });

export const deletePhotoShare = createServerFn({ method: "POST" })
  .inputValidator((d) => tokenInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, share } = await findActive(data.token);
    if (!share) return { ok: true as const };
    await supabaseAdmin.storage.from(SHARE_BUCKET).remove([share.story_path, ...(share.post_path ? [share.post_path] : [])]);
    const { error } = await supabaseAdmin
      .from("photo_shares")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", share.id);
    if (error) {
      console.error("delete-photo-share", "update-failed");
      return { ok: false as const };
    }
    return { ok: true as const };
  });
