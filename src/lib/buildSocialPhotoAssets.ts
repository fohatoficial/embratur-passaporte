/**
 * Arte Story 1080x1920: fundo oficial do cliente (intocado) + foto quadrada
 * já processada (fundo branco, enquadramento aprovado da imagem mestre)
 * dentro de um cartão branco de cantos arredondados.
 * Nada é capturado do DOM; nenhum filtro é aplicado à fotografia.
 */
import bgAsset from "@/assets/story-bg-mundial-2027.png.asset.json";

const W = 1080;
const H = 1920;
// cartão branco da foto
const CARD = { x: 160, y: 650, size: 760, radius: 28, pad: 16 };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("asset"));
    img.src = src;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStory(bg: HTMLImageElement, photo: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // fundo do cliente: cover proporcional, centralizado, sem alterações
  const bs = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
  const bw = bg.naturalWidth * bs;
  const bh = bg.naturalHeight * bs;
  ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);

  // cartão branco com cantos arredondados
  ctx.fillStyle = "#FFFFFF";
  roundedRect(ctx, CARD.x, CARD.y, CARD.size, CARD.size, CARD.radius);
  ctx.fill();

  // foto quadrada dentro do cartão, com margem branca uniforme, sem distorção
  const inner = CARD.size - CARD.pad * 2;
  const side = Math.min(photo.naturalWidth, photo.naturalHeight);
  const sx = Math.round((photo.naturalWidth - side) / 2);
  const sy = Math.round((photo.naturalHeight - side) / 2);
  ctx.save();
  roundedRect(ctx, CARD.x + CARD.pad, CARD.y + CARD.pad, inner, inner, Math.max(0, CARD.radius - CARD.pad));
  ctx.clip();
  ctx.drawImage(photo, sx, sy, side, side, CARD.x + CARD.pad, CARD.y + CARD.pad, inner, inner);
  ctx.restore();

  return canvas;
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"),
  );
}

export type SocialAssets = { story: Blob };

/** Recebe a foto quadrada final (imagem mestre, fundo branco) e gera o PNG do Story. */
export async function buildSocialPhotoAssets(masterPhoto: string): Promise<SocialAssets> {
  const [bg, photo] = await Promise.all([loadImage(bgAsset.url), loadImage(masterPhoto)]);
  const canvas = drawStory(bg, photo);
  const story = await toPng(canvas);
  canvas.width = canvas.height = 0;
  return { story };
}
