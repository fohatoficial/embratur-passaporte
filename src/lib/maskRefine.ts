/**
 * Refinamento conservador da máscara de recorte: mantém somente o componente
 * conectado que contém o rosto (elimina cadeira, objetos e ruído isolado) e
 * aplica um feather muito discreto. Nunca usa cor como critério, para não
 * apagar cabelo escuro, barba, óculos ou roupas escuras.
 */

const WORK_WIDTH = 220; // resolução de análise do componente conectado
const ALPHA_THRESHOLD = 28;

type Point = { x: number; y: number };

function componentMask(
  alpha: Uint8Array,
  w: number,
  h: number,
  seeds: Point[],
): Uint8Array | null {
  const keep = new Uint8Array(w * h);
  const stack: number[] = [];
  let seeded = false;

  for (const seed of seeds) {
    const sx = Math.min(w - 1, Math.max(0, Math.round(seed.x)));
    const sy = Math.min(h - 1, Math.max(0, Math.round(seed.y)));
    const idx = sy * w + sx;
    if (alpha[idx]! > ALPHA_THRESHOLD && !keep[idx]) {
      keep[idx] = 1;
      stack.push(idx);
      seeded = true;
    }
  }
  if (!seeded) return null;

  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % w;
    const y = (idx - x) / w;
    const neighbours = [
      x > 0 ? idx - 1 : -1,
      x < w - 1 ? idx + 1 : -1,
      y > 0 ? idx - w : -1,
      y < h - 1 ? idx + w : -1,
    ];
    for (const n of neighbours) {
      if (n >= 0 && !keep[n] && alpha[n]! > ALPHA_THRESHOLD) {
        keep[n] = 1;
        stack.push(n);
      }
    }
  }
  return keep;
}

/**
 * Recebe o recorte com transparência e o centro do rosto (px do recorte).
 * Devolve um novo canvas apenas com a pessoa.
 */
export function refineCutout(
  cutout: HTMLCanvasElement,
  faceCenter: Point,
  faceHeight: number,
  featherPx: number,
): HTMLCanvasElement {
  const srcCtx = cutout.getContext("2d");
  if (!srcCtx) return cutout;

  const w = Math.max(32, Math.min(WORK_WIDTH, cutout.width));
  const scale = w / cutout.width;
  const h = Math.max(32, Math.round(cutout.height * scale));

  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const smallCtx = small.getContext("2d");
  if (!smallCtx) return cutout;
  smallCtx.drawImage(cutout, 0, 0, w, h);

  const data = smallCtx.getImageData(0, 0, w, h).data;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) alpha[i] = data[i * 4 + 3] ?? 0;

  // sementes: rosto, pescoço e tronco esperados abaixo do rosto
  const cx = faceCenter.x * scale;
  const cy = faceCenter.y * scale;
  const fh = faceHeight * scale;
  const seeds: Point[] = [
    { x: cx, y: cy },
    { x: cx, y: cy + fh * 0.9 },
    { x: cx, y: cy + fh * 1.6 },
    { x: cx, y: cy - fh * 0.3 },
  ];

  const keep = componentMask(alpha, w, h, seeds);
  if (!keep) return cutout;

  // máscara em escala reduzida → aplicada com feather discreto
  const maskData = smallCtx.createImageData(w, h);
  for (let i = 0; i < w * h; i += 1) {
    const on = keep[i] ? 255 : 0;
    maskData.data[i * 4] = 255;
    maskData.data[i * 4 + 1] = 255;
    maskData.data[i * 4 + 2] = 255;
    maskData.data[i * 4 + 3] = on;
  }
  smallCtx.putImageData(maskData, 0, 0);

  const mask = document.createElement("canvas");
  mask.width = cutout.width;
  mask.height = cutout.height;
  const maskCtx = mask.getContext("2d");
  if (!maskCtx) return cutout;
  // sobe a máscara de volta e dilata levemente, para não comer fios de cabelo
  maskCtx.filter = `blur(${Math.max(1, featherPx * 1.5)}px)`;
  maskCtx.drawImage(small, 0, 0, cutout.width, cutout.height);
  maskCtx.filter = "none";
  // reforça o interior (evita máscara translúcida no corpo)
  maskCtx.globalCompositeOperation = "source-over";
  maskCtx.drawImage(mask, 0, 0);
  maskCtx.drawImage(mask, 0, 0);

  const out = document.createElement("canvas");
  out.width = cutout.width;
  out.height = cutout.height;
  const octx = out.getContext("2d");
  if (!octx) return cutout;
  octx.drawImage(cutout, 0, 0);
  octx.globalCompositeOperation = "destination-in";
  octx.drawImage(mask, 0, 0);
  octx.globalCompositeOperation = "source-over";
  return out;
}
