/**
 * Arte Story 1080x1920: fundo oficial do cliente + pessoa recortada (RGBA,
 * mesmo enquadramento/tratamento da imagem mestre, antes do fundo branco).
 * Nada é capturado do DOM; nenhum filtro é aplicado à fotografia.
 */
import bgAsset from "@/assets/story-bg-mundial-2027.png.asset.json";

const W = 1080;
const H = 1920;
// área reservada à pessoa (abaixo do título)
const AREA = { x0: 0.15, x1: 0.85, y0: 0.29, y1: 0.8 };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("asset"));
    img.src = src;
  });
}

function drawStory(bg: HTMLImageElement, person: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // fundo: cover proporcional, centralizado
  const bs = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
  const bw = bg.naturalWidth * bs;
  const bh = bg.naturalHeight * bs;
  ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);

  // pessoa: contain proporcional dentro da área, centralizada
  const ax = W * AREA.x0;
  const ay = H * AREA.y0;
  const aw = W * (AREA.x1 - AREA.x0);
  const ah = H * (AREA.y1 - AREA.y0);
  const ps = Math.min(aw / person.naturalWidth, ah / person.naturalHeight);
  const pw = Math.round(person.naturalWidth * ps);
  const ph = Math.round(person.naturalHeight * ps);
  ctx.drawImage(person, Math.round(ax + (aw - pw) / 2), Math.round(ay + (ah - ph) / 2), pw, ph);
  return canvas;
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"),
  );
}

export type SocialAssets = { story: Blob };

/** Recebe o recorte transparente da pessoa e gera o PNG final do Story. */
export async function buildSocialPhotoAssets(transparentPerson: string): Promise<SocialAssets> {
  const [bg, person] = await Promise.all([loadImage(bgAsset.url), loadImage(transparentPerson)]);
  const canvas = drawStory(bg, person);
  const story = await toPng(canvas);
  canvas.width = canvas.height = 0;
  return { story };
}
