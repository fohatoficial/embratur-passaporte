/**
 * Documento de impressão da KODAK 6900: tira vertical de 2x6 pol
 * (600x1800 px @ 300 dpi), fundo branco, com TRÊS cópias idênticas da
 * foto quadrada 5x5 cm empilhadas verticalmente.
 *
 * Este módulo NÃO processa a fotografia: apenas monta o documento de
 * impressão a partir da imagem final já aprovada.
 */

export const STRIP_W = 600; // 2in @ 300dpi
export const STRIP_H = 1800; // 6in @ 300dpi

/** Área física de corte: 50x50 mm = 591x591 px @ 300dpi. */
export const CUT_SIZE = 591;
/** Sangria discreta da própria foto ao redor da área de corte. */
export const BLEED_PX = 3;
/** Topo de cada uma das três áreas de corte (margens externas mínimas). */
export const CUT_TOPS = [6, 603, 1200] as const;

import logoAsset from "@/assets/logo-brasil.png.asset.json";

/** Logo Brasil só no arquivo de impressão, canto superior direito de cada foto. */
export const PRINT_LOGO_WIDTH_RATIO = 0.18;
export const PRINT_LOGO_MARGIN_RATIO = 0.025;
/** folga mínima da base branca discreta atrás da logo */
const LOGO_PAD_PX = 4;

let logoPromise: Promise<HTMLImageElement | null> | null = null;
/** carrega e decodifica a logo uma única vez (mesma origem, sem CDN externo) */
function loadPrintLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromise) {
    logoPromise = loadImage(logoAsset.url)
      .then(async (img) => {
        await img.decode?.().catch(() => undefined);
        return img;
      })
      .catch(() => {
        console.error("[print] logo indisponível; imprimindo sem logo");
        logoPromise = null;
        return null;
      });
  }
  return logoPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar a foto aprovada."));
    img.src = src;
  });
}

/** Monta a tira de impressão e devolve um JPEG de alta qualidade. */
export async function buildPrintStrip(photo: string): Promise<string> {
  const [img, logo] = await Promise.all([loadImage(photo), loadPrintLogo()]);
  const size = CUT_SIZE + BLEED_PX * 2;

  // 1) uma única foto impressa padronizada (com sangria), com a logo
  const printed = document.createElement("canvas");
  printed.width = size;
  printed.height = size;
  const pctx = printed.getContext("2d", { alpha: false });
  if (!pctx) throw new Error("Canvas indisponível.");
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = "high";
  pctx.fillStyle = "#FFFFFF";
  pctx.fillRect(0, 0, size, size);
  pctx.drawImage(img, 0, 0, size, size);

  if (logo && logo.naturalWidth > 0) {
    const logoW = Math.round(CUT_SIZE * PRINT_LOGO_WIDTH_RATIO);
    const logoH = Math.round((logoW * logo.naturalHeight) / logo.naturalWidth);
    const margin = Math.round(CUT_SIZE * PRINT_LOGO_MARGIN_RATIO);
    const lx = BLEED_PX + CUT_SIZE - margin - logoW;
    const ly = BLEED_PX + margin;
    // base branca pequena e discreta, cantos suaves
    pctx.fillStyle = "#FFFFFF";
    pctx.beginPath();
    pctx.roundRect(lx - LOGO_PAD_PX, ly - LOGO_PAD_PX, logoW + LOGO_PAD_PX * 2, logoH + LOGO_PAD_PX * 2, 6);
    pctx.fill();
    pctx.drawImage(logo, lx, ly, logoW, logoH);
  }

  // 2) a mesma foto impressa, três vezes, sem distorção
  const canvas = document.createElement("canvas");
  canvas.width = STRIP_W;
  canvas.height = STRIP_H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, STRIP_W, STRIP_H);
  const x = (STRIP_W - CUT_SIZE) / 2 - BLEED_PX;
  for (const top of CUT_TOPS) {
    ctx.drawImage(printed, x, top - BLEED_PX);
  }
  printed.width = 0;
  printed.height = 0;

  return canvas.toDataURL("image/jpeg", 0.95);
}
