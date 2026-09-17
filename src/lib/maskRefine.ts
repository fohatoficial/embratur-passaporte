/**
 * Refinamento do canal alpha do recorte.
 *
 * Ordem: máscara em alta resolução → componente conectado do rosto/corpo →
 * contração leve (sub-pixel, só no alpha) → feather estreito no alpha →
 * descontaminação de cor apenas nos pixels de borda.
 *
 * Nunca usa cor como critério de corte e nunca desfoca a camada RGB interna.
 */

export const MASK_REFINEMENT = {
  /** contração base do alpha, em px da escala final */
  erosionPx: 0.75,
  /** contração reduzida na região do cabelo / topo da cabeça */
  erosionPxHair: 0.35,
  /** transição suave da borda, em px da escala final */
  featherPx: 1.25,
  /** nenhum blur global */
  blurPx: 0,
  /** limiar de borda do alpha (0-1) */
  edgeThreshold: 0.5,
};

export const MASK_SETTINGS = {
  featherPx: MASK_REFINEMENT.featherPx,
  blurPx: MASK_REFINEMENT.blurPx,
  edgeThreshold: MASK_REFINEMENT.edgeThreshold,
  /** resolução mínima de análise do componente conectado (px de largura) */
  workWidth: 720,
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

/** Box blur separável de um campo float (usado só no alpha). */
function boxBlurField(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius < 1) return src;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const win = radius * 2 + 1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        sum += src[y * w + xx]!;
      }
      tmp[y * w + x] = sum / win;
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        sum += tmp[yy * w + x]!;
      }
      out[y * w + x] = sum / win;
    }
  }
  return out;
}

const smoothstep = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));

/**
 * Descontaminação de borda: nos pixels parcialmente transparentes, aproxima o
 * RGB das cores internas vizinhas da própria pessoa. Não pinta de branco e não
 * toca nos pixels internos.
 */
function decontaminateEdges(data: ImageData, w: number, h: number) {
  const px = data.data;
  const original = new Uint8ClampedArray(px);
  const radius = 2;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const a = px[i + 3]!;
      if (a === 0 || a >= 250) continue;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let wsum = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = (yy * w + xx) * 4;
          if (original[j + 3]! < 250) continue;
          sr += original[j]!;
          sg += original[j + 1]!;
          sb += original[j + 2]!;
          wsum += 1;
        }
      }
      if (!wsum) continue;
      // mistura conservadora: quanto mais transparente, mais peso ao interior
      const t = 0.6 * (1 - a / 250);
      px[i] = Math.round(px[i]! * (1 - t) + (sr / wsum) * t);
      px[i + 1] = Math.round(px[i + 1]! * (1 - t) + (sg / wsum) * t);
      px[i + 2] = Math.round(px[i + 2]! * (1 - t) + (sb / wsum) * t);
    }
  }
}

/**
 * Recebe o recorte com transparência, o centro do rosto e a altura do rosto
 * (px do recorte) e devolve um novo canvas apenas com a pessoa.
 *
 * `featherPx` e `erosionPx` já vêm convertidos para a escala deste recorte.
 */
export function refineCutout(
  cutout: HTMLCanvasElement,
  faceCenter: Point,
  faceHeight: number,
  featherPx: number = MASK_REFINEMENT.featherPx,
  erosionPx: number = MASK_REFINEMENT.erosionPx,
  erosionPxHair: number = MASK_REFINEMENT.erosionPxHair,
): HTMLCanvasElement {
  // análise do componente conectado em resolução alta (sem upscale agressivo)
  const w = Math.min(cutout.width, Math.max(MASK_SETTINGS.workWidth, 32));
  const scale = w / cutout.width;
  const h = Math.max(32, Math.round(cutout.height * scale));

  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const workCtx = work.getContext("2d");
  if (!workCtx) return cutout;
  workCtx.imageSmoothingEnabled = true;
  workCtx.imageSmoothingQuality = "high";
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

  // limita expansões anormais ao lado/atrás da cabeça (encosto da cadeira),
  // preservando cabelo, orelhas e a linha dos ombros mais abaixo
  const headBottom = cy + fh * 0.85;
  const halfWidth = fh * MASK_SETTINGS.headHalfWidthRatio;
  for (let y = 0; y < Math.min(h, Math.ceil(headBottom)); y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (Math.abs(x - cx) > halfWidth) keep[y * w + x] = 0;
    }
  }

  // alpha contínuo do componente mantido (0..1), na resolução de análise
  const field = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) field[i] = keep[i] ? (alpha[i]! / 255) : 0;

  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const maskCtx = mask.getContext("2d");
  if (!maskCtx) return cutout;

  // campo suavizado usado como distância aproximada à borda (só alpha)
  const radius = Math.max(1, Math.round(Math.max(featherPx, erosionPx) * scale + 1));
  const blurred = boxBlurField(field, w, h, radius);

  const featherRange = Math.max(0.35, featherPx * scale) / (radius * 2 + 1);
  const hairLine = cy - fh * 0.35; // acima disso: cabelo / topo da cabeça
  const erosionShift = (erosionPx * scale) / (radius * 2 + 1);
  const erosionShiftHair = (erosionPxHair * scale) / (radius * 2 + 1);

  const maskImg = maskCtx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    const shift = y < hairLine ? erosionShiftHair : erosionShift;
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const d = blurred[i]! - (MASK_REFINEMENT.edgeThreshold + shift);
      const a = smoothstep(d / featherRange + 0.5);
      const j = i * 4;
      maskImg.data[j] = 255;
      maskImg.data[j + 1] = 255;
      maskImg.data[j + 2] = 255;
      maskImg.data[j + 3] = Math.round(a * 255);
    }
  }
  maskCtx.putImageData(maskImg, 0, 0);

  // um único redimensionamento bilinear de alta qualidade para a escala do recorte
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

  // descontaminação apenas nos pixels de borda
  const img = octx.getImageData(0, 0, out.width, out.height);
  decontaminateEdges(img, out.width, out.height);
  octx.putImageData(img, 0, 0);

  return out;
}
