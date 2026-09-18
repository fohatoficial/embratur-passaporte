import { detectFace, PhotoError, type FaceBox } from "./faceDetection";
import { MASK_SETTINGS, refineCutout } from "./maskRefine";
import { remotePersonCutout } from "./photoroomCutout";
import {
  defaultTreatment,
  normalizeLightAndColor,
  sharpen,
  type TreatmentParams,
} from "./photoTreatment";

export { PhotoError } from "./faceDetection";

export const PHOTO_W = 1200;
export const PHOTO_H = 1200; // 1:1 (corte físico 5x5 cm)

/**
 * Constantes de enquadramento (retrato do peito para cima).
 * Única fonte de verdade — a prévia da câmera usa as mesmas proporções.
 */
export const TARGET_FACE_HEIGHT_RATIO = 0.36; // caixa facial ocupa ~36% da altura final
export const MAX_FACE_HEIGHT_RATIO = 0.38; // limite superior aceitável
export const TARGET_EYE_Y_RATIO = 0.35; // linha dos olhos no canvas final
export const TOP_HEAD_MARGIN_RATIO = 0.1; // respiro acima do cabelo
/** Faixa aceitável da caixa facial em relação à ALTURA DA CAPTURA original. */
export const MIN_FACE_CAPTURE_RATIO = 0.22;
export const MAX_FACE_CAPTURE_RATIO = 0.38;
const HAIR_ABOVE_FACE = 0.4; // cabelo estimado acima do bounding box facial

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

let removeBackgroundFn: ((input: Blob) => Promise<Blob>) | null = null;

/** Carrega a biblioteca de remoção de fundo uma única vez. */
async function getRemoveBackground() {
  if (removeBackgroundFn) return removeBackgroundFn;
  const mod = await import("@imgly/background-removal");
  removeBackgroundFn = (input: Blob) =>
    mod.removeBackground(input, { output: { format: "image/png" } });
  return removeBackgroundFn;
}

async function removeBackgroundOf(canvas: HTMLCanvasElement) {
  const removeBackground = await getRemoveBackground();
  const blob = await removeBackground(await canvasToBlob(canvas));
  const url = URL.createObjectURL(blob);
  try {
    return toCanvas(await loadImage(url));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Confirma que o PNG tem canal alfa utilizável: há pixels opacos e transparentes. */
function hasUsableAlpha(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width < 64 || canvas.height < 64) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let opaque = 0;
  let clear = 0;
  const step = 4 * 37; // amostragem esparsa
  for (let i = 3; i < data.length; i += step) {
    const a = data[i]!;
    if (a > 200) opaque += 1;
    else if (a < 24) clear += 1;
  }
  const samples = Math.max(1, Math.floor(data.length / step));
  return opaque / samples > 0.05 && clear / samples > 0.02;
}

/** Recorte remoto (PhotoRoom) nas dimensões originais, ou null. */
async function remoteCutoutOf(
  capture: string,
  source: HTMLCanvasElement,
): Promise<HTMLCanvasElement | null> {
  try {
    const blob = await canvasToBlob(source, "image/jpeg", 0.95);
    const dataUrl = await remotePersonCutout(capture, blob);
    if (!dataUrl) return null;
    const canvas = toCanvas(await loadImage(dataUrl));
    if (canvas.width < source.width * 0.5 || !hasUsableAlpha(canvas)) return null;
    return canvas;
  } catch {
    return null;
  }
}

export type Framing = { scale: number; dx: number; dy: number };

/**
 * Escala e deslocamento da imagem transparente COMPLETA sobre o canvas 1:1.
 *
 * A escala vem exclusivamente da altura da caixa facial (rosto padronizado em
 * ~36% da altura final) e nunca é ampliada para preencher a base: se a captura
 * não tiver tronco suficiente, usa-se o maior enquadramento real disponível,
 * limitado a MAX_FACE_HEIGHT_RATIO. Nada é recortado antes da composição —
 * apenas o que ultrapassa as bordas do canvas é cortado no desenho.
 */
export function calculateDocumentFraming(
  _sourceW: number,
  sourceH: number,
  face: FaceBox,
): Framing {
  const faceScale = (PHOTO_H * TARGET_FACE_HEIGHT_RATIO) / face.h;
  const maxScale = (PHOTO_H * MAX_FACE_HEIGHT_RATIO) / face.h;

  // escala que faria o conteúdo alcançar a borda inferior com os olhos na
  // altura alvo — só é considerada dentro do limite facial permitido
  const bottomScale =
    (PHOTO_H * (1 - TARGET_EYE_Y_RATIO)) / Math.max(sourceH - face.eyeY, 1);

  const scale = Math.min(Math.max(faceScale, Math.min(bottomScale, maxScale)), maxScale);

  // centraliza horizontalmente pelo centro do rosto
  const dx = PHOTO_W / 2 - face.centerX * scale;
  // posição vertical definida pela linha dos olhos
  let dy = PHOTO_H * TARGET_EYE_Y_RATIO - face.eyeY * scale;

  // garante respiro acima do cabelo (empurra para baixo se necessário)
  const hairTop = (face.y - face.h * HAIR_ABOVE_FACE) * scale + dy;
  const minTop = PHOTO_H * TOP_HEAD_MARGIN_RATIO;
  if (hairTop < minTop) dy += minTop - hairTop;

  return { scale, dx, dy };
}

/** Tratamento leve aplicado somente à camada da pessoa (com transparência). */
function treatPersonLayer(
  person: HTMLCanvasElement,
  params: TreatmentParams,
): HTMLCanvasElement {
  const ctx = person.getContext("2d");
  if (!ctx) return person;
  const imageData = ctx.getImageData(0, 0, person.width, person.height);
  normalizeLightAndColor(imageData, params);
  ctx.putImageData(imageData, 0, 0);
  return sharpen(person, params);
}

/** Canvas branco puro (sem alpha) + pessoa desenhada por cima. */
function compositeOnWhiteBackground(
  person: HTMLCanvasElement,
  framing: Framing,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_W;
  canvas.height = PHOTO_H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    person,
    framing.dx,
    framing.dy,
    person.width * framing.scale,
    person.height * framing.scale,
  );
  return canvas;
}

const exportFinalJpeg = (canvas: HTMLCanvasElement) => canvas.toDataURL("image/jpeg", 0.94);

/**
 * Sequência obrigatória: captura → rosto → segmentação → refinamento do alpha
 * → tratamento leve apenas da pessoa → enquadramento → canvas branco puro →
 * desenho da pessoa → JPEG final.
 */
export async function processPassportPhoto(
  capture: string,
  params: TreatmentParams = defaultTreatment,
): Promise<string> {
  const source = toCanvas(await loadImage(capture));

  // 1. rosto na captura original
  const face = await detectFace(source);

  // 2. segmentação da pessoa: PhotoRoom e, se falhar, o recorte local atual
  const remote = await remoteCutoutOf(capture, source);
  const cutout = remote ?? (await removeBackgroundOf(source));

  // 3. refinamento do canal alpha somente no fallback local
  const framing = calculateDocumentFraming(source.width, source.height, face);
  const cutoutScale = cutout.width / source.width;
  const finalScale = framing.scale / cutoutScale;
  const refined = remote
    ? cutout
    : refineCutout(
        cutout,
        { x: face.centerX * cutoutScale, y: face.centerY * cutoutScale },
        face.h * cutoutScale,
        Math.max(0.5, MASK_SETTINGS.featherPx / Math.max(finalScale, 0.01)),
      );

  // 4. tratamento leve somente na camada da pessoa
  const person = treatPersonLayer(refined, params);

  // 5. composição sobre branco puro e exportação única
  const composed = compositeOnWhiteBackground(person, { ...framing, scale: finalScale });
  return exportFinalJpeg(composed);
}

export const isPhotoError = (e: unknown): e is PhotoError => e instanceof PhotoError;
