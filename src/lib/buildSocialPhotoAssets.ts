/**
 * Artes sociais (Story 1080x1920) desenhadas em
 * Canvas a partir da imagem mestre 1440x1440 já aprovada. Nenhum filtro é
 * aplicado à fotografia; nada é capturado do DOM; todos os assets são locais.
 */
import logoAsset from "@/assets/logo-brasil.png.asset.json";
import ballAsset from "@/assets/ball.png.asset.json";

const C = {
  blue: "#0069C7",
  blueDark: "#003A70",
  yellow: "#FFC72C",
  greenLight: "#7BC943",
  green: "#00965E",
  cyan: "#3EB1E6",
  orange: "#F2762E",
  red: "#EF3340",
  white: "#FFFFFF",
};

const HEADLINE: [string, string] = ["YA TENGO MI PASAPORTE", "PARA DESCUBRIR BRASIL."];
const COMPLEMENT = "Descubre Brasil más allá del fútbol.";
const FOOTER = "VISIT BRASIL · FIT 2026";
const STAMP = "BRASIL 2027";
const FONT = '"Archivo", sans-serif';

type Ctx = CanvasRenderingContext2D;
type Assets = { photo: HTMLImageElement; logo: HTMLImageElement; ball: HTMLImageElement };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("asset"));
    img.src = src;
  });
}

async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    ["900", "700", "600"].map((w) => document.fonts.load(`${w} 64px ${FONT}`).catch(() => [])),
  );
  await document.fonts.ready;
}

function setSpacing(ctx: Ctx, px: number) {
  (ctx as Ctx & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

function background(ctx: Ctx, w: number, h: number, ball: HTMLImageElement) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.blue);
  g.addColorStop(1, C.blueDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const blob = (x: number, y: number, r: number, color: string, a: number) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a;
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  };
  blob(-40, h * 0.22, w * 0.45, C.cyan, 0.35);
  blob(w + 60, h * 0.06, w * 0.5, C.green, 0.35);
  blob(-60, h + 40, w * 0.45, C.yellow, 0.22);
  blob(w + 40, h * 0.8, w * 0.4, C.orange, 0.22);

  // bolas discretas apenas nas bordas
  const ballAt = (x: number, y: number, s: number, a: number) => {
    ctx.globalAlpha = a;
    ctx.drawImage(ball, x, y, s, s * (ball.naturalHeight / ball.naturalWidth));
    ctx.globalAlpha = 1;
  };
  ballAt(-w * 0.16, -w * 0.1, w * 0.42, 0.16);
  ballAt(w * 0.8, h * 0.52, w * 0.34, 0.1);
  ballAt(-w * 0.14, h * 0.78, w * 0.3, 0.12);
}

function brandBar(ctx: Ctx, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  [C.greenLight, C.yellow, C.orange, C.red, C.cyan, C.green].forEach((c, i, a) =>
    g.addColorStop(i / (a.length - 1), c),
  );
  ctx.fillStyle = g;
  ctx.fillRect(0, y, w, h);
}

function drawLogo(ctx: Ctx, logo: HTMLImageElement, cx: number, top: number, maxW: number, maxH: number) {
  const ratio = logo.naturalWidth / logo.naturalHeight;
  let lw = maxW;
  let lh = lw / ratio;
  if (lh > maxH) {
    lh = maxH;
    lw = lh * ratio;
  }
  ctx.drawImage(logo, cx - lw / 2, top, lw, lh);
  return top + lh;
}

function fittedText(
  ctx: Ctx,
  text: string,
  cx: number,
  y: number,
  weight: number,
  size: number,
  maxW: number,
  color: string,
  spacing = 0,
) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${FONT}`;
    setSpacing(ctx, spacing * (s / size));
    if (ctx.measureText(text).width <= maxW) break;
    s -= 2;
  } while (s > 16);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, cx, y);
  setSpacing(ctx, 0);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Moldura branca + foto sem nenhum filtro. */
function framedPhoto(ctx: Ctx, photo: HTMLImageElement, x: number, y: number, size: number, pad: number) {
  ctx.save();
  ctx.shadowColor = "rgba(0,20,60,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = C.white;
  roundRect(ctx, x, y, size, size, 28);
  ctx.fill();
  ctx.restore();

  const inner = size - pad * 2;
  ctx.save();
  roundRect(ctx, x + pad, y + pad, inner, inner, 14);
  ctx.clip();
  ctx.drawImage(photo, x + pad, y + pad, inner, inner);
  ctx.restore();
}

/** Carimbo girado sobre o canto superior direito da moldura (área de fundo). */
function stamp(ctx: Ctx, cx: number, cy: number, scale: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.font = `900 ${34 * scale}px ${FONT}`;
  setSpacing(ctx, 5 * scale);
  const tw = ctx.measureText(STAMP).width;
  const w = tw + 56 * scale;
  const h = 78 * scale;
  ctx.fillStyle = C.blueDark;
  roundRect(ctx, -w / 2, -h / 2, w, h, 18 * scale);
  ctx.fill();
  ctx.lineWidth = 7 * scale;
  ctx.strokeStyle = C.greenLight;
  roundRect(ctx, -w / 2 + 8 * scale, -h / 2 + 8 * scale, w - 16 * scale, h - 16 * scale, 12 * scale);
  ctx.stroke();
  ctx.fillStyle = C.greenLight;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(STAMP, 0, 2 * scale);
  ctx.restore();
}

function newCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

function drawStory(a: Assets) {
  const W = 1080;
  const H = 1920;
  const { canvas, ctx } = newCanvas(W, H);
  background(ctx, W, H, a.ball);
  brandBar(ctx, 0, W, 16);
  brandBar(ctx, H - 16, W, 16);

  // topo fora da barra de perfil do Instagram (~200px)
  drawLogo(ctx, a.logo, W / 2, 210, 380, 190);
  fittedText(ctx, HEADLINE[0], W / 2, 515, 900, 70, W - 160, C.white);
  fittedText(ctx, HEADLINE[1], W / 2, 595, 900, 70, W - 160, C.yellow);

  const size = 780;
  const x = (W - size) / 2;
  const y = 680;
  framedPhoto(ctx, a.photo, x, y, size, 22);
  stamp(ctx, x + size - 70, y + 64, 1.1);

  fittedText(ctx, COMPLEMENT, W / 2, y + size + 100, 600, 44, W - 180, C.white);
  fittedText(ctx, FOOTER, W / 2, H - 290, 700, 30, W - 200, C.yellow, 6);
  return canvas;
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"),
  );
}

export type SocialAssets = { story: Blob };

/** Gera o PNG do Story (sem metadados: saída direta do canvas). */
export async function buildSocialPhotoAssets(master: string): Promise<SocialAssets> {
  await ensureFonts();
  const [photo, logo, ball] = await Promise.all([
    loadImage(master),
    loadImage(logoAsset.url),
    loadImage(ballAsset.url),
  ]);
  const assets = { photo, logo, ball };

  const storyCanvas = drawStory(assets);
  const story = await toPng(storyCanvas);
  storyCanvas.width = storyCanvas.height = 0;
  return { story };
}
