import { removePhotoBackground } from "./removeBackground.functions";

/**
 * Uma única chamada por captura confirmada. A Promise em andamento é
 * reutilizada (duplo toque, re-render, troca de estado) e o resultado fica em
 * memória. Falhas devolvem null: o chamador usa o fallback local e não tenta
 * novamente a mesma captura.
 */

let key: string | null = null;
let inflight: Promise<string | null> | null = null;

async function request(blob: Blob): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("image", new File([blob], "capture.jpg", { type: blob.type }));
    const { png } = await removePhotoBackground({ data: form });
    return png ? `data:image/png;base64,${png}` : null;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.debug("[photoroom] fallback", err instanceof Error ? err.message : "failed");
    }
    return null;
  }
}

/** Recorte transparente remoto ou null quando indisponível. */
export function remotePersonCutout(captureKey: string, blob: Blob): Promise<string | null> {
  if (key === captureKey && inflight) return inflight;
  key = captureKey;
  inflight = request(blob);
  return inflight;
}

/** Descarta o resultado guardado (usado ao repetir a foto). */
export function resetRemoteCutout() {
  key = null;
  inflight = null;
}
