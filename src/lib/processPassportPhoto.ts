import { detectFace, PhotoError, type FaceBox } from "./faceDetection";
import { MASK_SETTINGS, refineCutout } from "./maskRefine";
import {
  defaultTreatment,
  normalizeLightAndColor,
  sharpen,
  type TreatmentParams,
} from "./photoTreatment";

export { PhotoError } from "./faceDetection";

export const PHOTO_W = 1000;
export const PHOTO_H = 1400; // 5:7

/** Constantes de enquadramento — ajustáveis após os testes reais. */
export const TARGET_FACE_HEIGHT_RATIO = 0.34; // altura do rosto no canvas
export const TARGET_EYE_Y_RATIO = 0.37; // altura dos olhos no canvas
export const TOP_HEAD_MARGIN_RATIO = 0.06; // margem mínima acima do cabelo
export const PERSON_SCALE_CORRECTION = 0.95; // pessoa ~5% menor
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

export type Framing = { scale: number; dx: number; dy: number };

/**
 * Escala e deslocamento da captura completa sobre o canvas 5:7, calculados
 * pelo rosto: olhos na altura alvo, margem acima do cabelo e tronco atingindo
 * a borda inferior (sem faixa branca nem corte horizontal).
 */
export function calculateDocumentFraming(
  sourceW: number,
  sourceH: number,
  face: FaceBox,
): Framing {
  const faceScale = (PHOTO_H * TARGET_FACE_HEIGHT_RATIO) / face.h;

  // escala mínima para o conteúdo alcançar a borda inferior com os olhos na
  // altura alvo: s * (sourceH - eyeY) >= PHOTO_H * (1 - TARGET_EYE_Y_RATIO)
  const bottomScale =
    (PHOTO_H * (1 - TARGET_EYE_Y_RATIO)) / Math.max(sourceH - face.eyeY, 1);
  const widthScale = PHOTO_W / Math.max(sourceW, 1);

  const scale =
    Math.max(faceScale * PERSON_SCALE_CORRECTION, bottomScale, widthScale * 0.98);

  const dx = PHOTO_W / 2 - face.centerX * scale;
  let dy = PHOTO_H * TARGET_EYE_Y_RATIO - face.eyeY * scale;

  // garante margem acima do cabelo (empurra para baixo se necessário)
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

  // 2. segmentação da pessoa
  const cutout = await removeBackgroundOf(source);

  // 3. refinamento do canal alpha
  const framing = calculateDocumentFraming(source.width, source.height, face);
  const cutoutScale = cutout.width / source.width;
  const finalScale = framing.scale / cutoutScale;
  const toCutoutPx = (px: number) => px / Math.max(finalScale, 0.01);
  const refined = refineCutout(
    cutout,
    { x: face.centerX * cutoutScale, y: face.centerY * cutoutScale },
    face.h * cutoutScale,
    Math.max(0.5, toCutoutPx(MASK_REFINEMENT.featherPx)),
    Math.max(0.2, toCutoutPx(MASK_REFINEMENT.erosionPx)),
    Math.max(0.1, toCutoutPx(MASK_REFINEMENT.erosionPxHair)),
  );

  // 4. tratamento leve somente na camada da pessoa
  const person = treatPersonLayer(refined, params);

  // 5. composição sobre branco puro e exportação única
  const composed = compositeOnWhiteBackground(person, { ...framing, scale: finalScale });
  return exportFinalJpeg(composed);
}

export const isPhotoError = (e: unknown): e is PhotoError => e instanceof PhotoError;
