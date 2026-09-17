import {
  defaultTreatment,
  denoise,
  normalizeLightAndColor,
  sharpen,
  type TreatmentParams,
} from "./photoTreatment";

export const PHOTO_W = 1000;
export const PHOTO_H = 1400; // 5:7

/** Espaço reservado acima da cabeça e altura ocupada pela pessoa. */
const TOP_MARGIN = 0.07;
const SUBJECT_HEIGHT = 0.88;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar a captura."));
    img.src = src;
  });
}

function toCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.drawImage(img, 0, 0);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem."))),
      type,
      quality,
    );
  });
}

/** Retângulo com conteúdo visível (alpha) do recorte. */
function alphaBounds(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const step = 2;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxY < 0) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

let removeBackgroundFn: ((input: Blob) => Promise<Blob>) | null = null;

/** Carrega a biblioteca uma única vez e reaproveita entre as fotos. */
async function getRemoveBackground() {
  if (removeBackgroundFn) return removeBackgroundFn;
  const mod = await import("@imgly/background-removal");
  removeBackgroundFn = (input: Blob) => mod.removeBackground(input, { output: { format: "image/png" } });
  return removeBackgroundFn;
}

/**
 * Sequência completa: captura → luz e cor → ruído → remoção de fundo →
 * fundo branco → 5:7 → nitidez discreta → JPEG final.
 */
export async function processPassportPhoto(
  capture: string,
  params: TreatmentParams = defaultTreatment,
): Promise<string> {
  const img = await loadImage(capture);
  const source = toCanvas(img);

  // 1. luz e cor
  const ctx = source.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  const imageData = ctx.getImageData(0, 0, source.width, source.height);
  normalizeLightAndColor(imageData, params);
  ctx.putImageData(imageData, 0, 0);

  // 2. redução leve de ruído
  const cleaned = denoise(source, params);

  // 3. remoção do fundo
  const removeBackground = await getRemoveBackground();
  const cutoutBlob = await removeBackground(await canvasToBlob(cleaned));
  const cutoutUrl = URL.createObjectURL(cutoutBlob);
  let cutout: HTMLCanvasElement;
  try {
    cutout = toCanvas(await loadImage(cutoutUrl));
  } finally {
    URL.revokeObjectURL(cutoutUrl);
  }

  // 4. composição em fundo branco 5:7
  const final = document.createElement("canvas");
  final.width = PHOTO_W;
  final.height = PHOTO_H;
  const fctx = final.getContext("2d");
  if (!fctx) throw new Error("Canvas indisponível.");
  fctx.fillStyle = "#FFFFFF";
  fctx.fillRect(0, 0, PHOTO_W, PHOTO_H);

  const bounds = alphaBounds(cutout);
  if (bounds && bounds.w > 0 && bounds.h > 0) {
    const scale = Math.min(
      (PHOTO_H * SUBJECT_HEIGHT) / bounds.h,
      (PHOTO_W * 0.98) / bounds.w,
    );
    const drawW = bounds.w * scale;
    const drawH = bounds.h * scale;
    fctx.drawImage(
      cutout,
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
      (PHOTO_W - drawW) / 2,
      PHOTO_H * TOP_MARGIN,
      drawW,
      drawH,
    );
  } else {
    // sem recorte utilizável: preserva proporção da captura
    const scale = Math.max(PHOTO_W / cutout.width, PHOTO_H / cutout.height);
    const drawW = cutout.width * scale;
    const drawH = cutout.height * scale;
    fctx.drawImage(cutout, (PHOTO_W - drawW) / 2, 0, drawW, drawH);
  }

  // 5. nitidez final discreta e JPEG
  const finished = sharpen(final, params);
  return finished.toDataURL("image/jpeg", 0.95);
}
