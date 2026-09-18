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
  const img = await loadImage(photo);

  const canvas = document.createElement("canvas");
  canvas.width = STRIP_W;
  canvas.height = STRIP_H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas indisponível.");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, STRIP_W, STRIP_H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // mesma imagem processada, três vezes, sem distorção
  const size = CUT_SIZE + BLEED_PX * 2;
  const x = (STRIP_W - CUT_SIZE) / 2 - BLEED_PX;
  for (const top of CUT_TOPS) {
    ctx.drawImage(img, x, top - BLEED_PX, size, size);
  }

  return canvas.toDataURL("image/jpeg", 0.95);
}
