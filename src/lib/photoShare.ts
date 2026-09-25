import { buildSocialPhotoAssets } from "./buildSocialPhotoAssets";
import { createPhotoShare } from "./photoShare.functions";

export type ShareResult = { token: string; url: string; expiresAt: string; previewUrl: string };

/**
 * Operação independente da impressão: gera as artes a partir da imagem
 * mestre e cria o compartilhamento. Nunca lança — falhas devolvem null.
 */
export async function startPhotoShare(
  master: string,
  sessionId: string,
  participantId: string | null,
): Promise<ShareResult | null> {
  try {
    const { story, post } = await buildSocialPhotoAssets(master);
    const form = new FormData();
    form.append("sessionId", sessionId);
    if (participantId) form.append("participantId", participantId);
    form.append("story", new File([story], "story.png", { type: "image/png" }));
    form.append("post", new File([post], "post.png", { type: "image/png" }));
    const res = await createPhotoShare({ data: form });
    if (!res.ok) return null;
    return { token: res.token, url: res.url, expiresAt: res.expiresAt, previewUrl: URL.createObjectURL(story) };
  } catch {
    return null;
  }
}
