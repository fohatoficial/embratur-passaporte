import { createServerFn } from "@tanstack/react-start";

/**
 * Remoção de fundo pela PhotoRoom. A chave vive apenas no servidor: é lida
 * dentro do handler, nunca retornada e nunca registrada. A imagem não é
 * armazenada e nada do conteúdo binário vai para os logs.
 */

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const ENDPOINT = "https://sdk.photoroom.com/v1/segment";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const isPng = (b: Uint8Array) =>
  b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

export const removePhotoBackground = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("invalid-payload");
    for (const key of data.keys()) {
      if (key !== "image") throw new Error("unexpected-field");
    }
    const file = data.get("image");
    if (!(file instanceof File)) throw new Error("missing-image");
    if (!ALLOWED_TYPES.includes(file.type)) throw new Error("invalid-type");
    if (file.size === 0 || file.size > MAX_BYTES) throw new Error("invalid-size");
    return { file };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["PHOTOROOM_API_KEY"];
    if (!apiKey) throw new Error("photoroom-unconfigured");

    const form = new FormData();
    form.append("image_file", data.file, "capture");
    form.append("format", "png");
    form.append("channels", "rgba");
    form.append("crop", "false");
    form.append("size", "hd");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`photoroom-http-${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("image/png")) throw new Error("photoroom-invalid-type");

      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength < 2048) throw new Error("photoroom-empty");
      if (!isPng(bytes)) throw new Error("photoroom-invalid-png");

      return { png: toBase64(bytes) };
    } catch (err) {
      const code =
        err instanceof Error
          ? err.name === "AbortError"
            ? "photoroom-timeout"
            : err.message
          : "photoroom-failed";
      // apenas o código técnico; nenhum dado da foto e nenhuma credencial
      console.error("[remove-photo-background]", code);
      throw new Error(code);
    } finally {
      clearTimeout(timer);
    }
  });
