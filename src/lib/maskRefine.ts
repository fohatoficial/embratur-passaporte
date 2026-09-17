/**
 * Refinamento do canal alpha do recorte: mantém somente o componente conectado
 * que contém o rosto (descarta ruído e objetos soltos), limita expansões
 * anormais ao lado/atrás da cabeça (encosto de cadeira) e aplica um feather de
 * ~1px na escala final. Nunca usa cor como critério.
 */

export const MASK_SETTINGS = {
  /** feather na escala da imagem final 1200x1800 */
  featherPx: 1,
  /** nenhum blur global */
  blurPx: 0,
  /** limiar de borda do alpha (0-1) */
  edgeThreshold: 0.5,
  /** resolução de análise do componente conectado */
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
  featherPx: number = MASK_SETTINGS.featherPx,
): HTMLCanvasElement {
  const w = Math.max(32, Math.min(MASK_SETTINGS.workWidth, cutout.width));
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

  const cx = faceCenter.x * scale;
  const cy = faceCenter.y * scale;
  const fh = faceHeight * scale;
  const seeds: Point[] = [
    { x: cx, y: cy },
    { x: cx, y: cy + fh * 0.9 },
    { x: cx, y: cy + fh * 1.6 },
    { x: cx, y: cy - fh * 0.3 },
  ];

  const threshold = Math.round(MASK_SETTINGS.edgeThreshold * 255);
  const keep = componentMask(alpha, w, h, seeds, threshold);
  if (!keep) return cutout;

  // limita expansões anormais ao lado/atrás da cabeça (encosto da cadeira),
  // preservando cabelo, orelhas e a linha dos ombros mais abaixo
  const headBottom = cy + fh * 0.85; // aproximadamente o pescoço
  const halfWidth = fh * MASK_SETTINGS.headHalfWidthRatio;
  for (let y = 0; y < Math.min(h, Math.ceil(headBottom)); y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (Math.abs(x - cx) > halfWidth) keep[y * w + x] = 0;
    }
  }

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
  maskCtx.imageSmoothingEnabled = true;
  maskCtx.drawImage(small, 0, 0, cutout.width, cutout.height);

  const out = document.createElement("canvas");
  out.width = cutout.width;
  out.height = cutout.height;
  const octx = out.getContext("2d");
  if (!octx) return cutout;
  octx.drawImage(cutout, 0, 0);
  octx.globalCompositeOperation = "destination-in";
  octx.drawImage(mask, 0, 0);
  octx.globalCompositeOperation = "source-over";

  // aperta a transição do alpha: elimina o halo largo do modelo e deixa
  // apenas um feather estreito (~featherPx na imagem final)
  const fctx = out.getContext("2d");
  if (fctx) {
    const img = fctx.getImageData(0, 0, out.width, out.height);
    const px = img.data;
    const t = MASK_SETTINGS.edgeThreshold * 255;
    const width = Math.max(6, featherPx * 16); // faixa de transição em níveis de alpha
    for (let i = 3; i < px.length; i += 4) {
      const a = px[i]!;
      if (a === 0 || a === 255) continue;
      const v = (a - t) / width + 0.5;
      px[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * v * (3 - 2 * v) * 255);
    }
    fctx.putImageData(img, 0, 0);
  }

  return out;
}
