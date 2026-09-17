/**
 * Limpeza da máscara do recorte: mantém apenas o componente conectado ao
 * rosto/corpo e suaviza discretamente a borda do alpha.
 *
 * Nunca usa cor como critério de corte e nunca desfoca a camada RGB.
 */

export const MASK_REFINEMENT = {
  erosionPx: 0,
  blurPx: 0,
  featherPx: 1,
  edgeThreshold: 0.5,
};

export const MASK_SETTINGS = {
  featherPx: MASK_REFINEMENT.featherPx,
  blurPx: MASK_REFINEMENT.blurPx,
  edgeThreshold: MASK_REFINEMENT.edgeThreshold,
  /** resolução de análise do componente conectado (px de largura) */
  workWidth: 260,
  /** largura máxima permitida ao lado da cabeça, em alturas de rosto */
  headHalfWidthRatio: 1.0,
};

type Point = { x: number; y: number };

function componentMask(
  alpha: Uint8Array,
  w: number,
  h: number,
  seeds: Point[],
  threshold: number,
): Uint8Array | null {
  const keep = new Uint8Array(w * h);
  const stack: number[] = [];
  let seeded = false;

  for (const seed of seeds) {
    const sx = Math.min(w - 1, Math.max(0, Math.round(seed.x)));
    const sy = Math.min(h - 1, Math.max(0, Math.round(seed.y)));
    const idx = sy * w + sx;
    if (alpha[idx]! > threshold && !keep[idx]) {
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
      if (n >= 0 && !keep[n] && alpha[n]! > threshold) {
        keep[n] = 1;
        stack.push(n);
      }
    }
  }
  return keep;
}

/**
 * Recebe o recorte com transparência, o centro do rosto e a altura do rosto
 * (px do recorte) e devolve um novo canvas apenas com a pessoa.
 */
export function refineCutout(
  cutout: HTMLCanvasElement,
  faceCenter: Point,
  faceHeight: number,
): HTMLCanvasElement {
  const w = Math.min(cutout.width, Math.max(MASK_SETTINGS.workWidth, 32));
  const scale = w / cutout.width;
  const h = Math.max(32, Math.round(cutout.height * scale));

  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const workCtx = work.getContext("2d");
  if (!workCtx) return cutout;
  workCtx.drawImage(cutout, 0, 0, w, h);

  const data = workCtx.getImageData(0, 0, w, h).data;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) alpha[i] = data[i * 4 + 3] ?? 0;

  const cx = faceCenter.x * scale;
  const cy = faceCenter.y * scale;
  const fh = faceHeight * scale;
  const seeds: Point[] = [
    { x: cx, y: cy },
    { x: cx, y: cy + fh * 0.9 },
    { x: cx, y: cy + fh * 1.6 },
    { x: cx, y: cy - fh * 0.3 },
  ];

  const threshold = Math.round(MASK_REFINEMENT.edgeThreshold * 255);
  const keep = componentMask(alpha, w, h, seeds, threshold);
  if (!keep) return cutout;

  // limita expansões anormais ao lado/atrás da cabeça (encosto da cadeira)
  const headBottom = cy + fh * 0.85;
  const halfWidth = fh * MASK_SETTINGS.headHalfWidthRatio;
  for (let y = 0; y < Math.min(h, Math.ceil(headBottom)); y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (Math.abs(x - cx) > halfWidth) keep[y * w + x] = 0;
    }
  }

  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const maskCtx = mask.getContext("2d");
  if (!maskCtx) return cutout;

  const maskImg = maskCtx.createImageData(w, h);
  for (let i = 0; i < w * h; i += 1) {
    const a = keep[i] ? alpha[i]! : 0;
    const j = i * 4;
    maskImg.data[j] = 255;
    maskImg.data[j + 1] = 255;
    maskImg.data[j + 2] = 255;
    maskImg.data[j + 3] = a;
  }
  maskCtx.putImageData(maskImg, 0, 0);

  const out = document.createElement("canvas");
  out.width = cutout.width;
  out.height = cutout.height;
  const octx = out.getContext("2d");
  if (!octx) return cutout;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(cutout, 0, 0);
  octx.globalCompositeOperation = "destination-in";
  octx.drawImage(mask, 0, 0, out.width, out.height);
  octx.globalCompositeOperation = "source-over";

  return out;
}
