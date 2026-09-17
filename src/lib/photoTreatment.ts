/**
 * Tratamento fotográfico muito leve — aplicado SOMENTE nos pixels da pessoa
 * (alpha > 0). Nunca toca no fundo branco, nunca altera traços do rosto.
 */
export type TreatmentParams = {
  /** luminância média desejada (0-1) */
  targetLuma: number;
  /** intensidade da correção de exposição (0-1) */
  exposureStrength: number;
  /** intensidade da correção de balanço de branco (0-1) */
  whiteBalanceStrength: number;
  /** recuperação de sombras (0-1) */
  shadowLift: number;
  /** controle de áreas muito claras (0-1) */
  highlightRolloff: number;
  /** contraste extra (1 = neutro) */
  contrast: number;
  /** saturação (1 = neutro) */
  saturation: number;
  /** nitidez final (0-1) */
  sharpenAmount: number;
  /** temperatura relativa (negativo = menos quente) */
  temperature: number;
};

/** Ajuste final de cor: pele um pouco menos quente e menos saturada. */
export const FINAL_COLOR_ADJUSTMENTS = {
  temperature: -0.02,
  saturation: -0.02,
  highlights: -0.03,
  exposure: 0,
  contrast: 0.01,
};

/** Valores conservadores, ajustáveis após os testes reais no totem. */
export const defaultTreatment: TreatmentParams = {
  targetLuma: 0.55,
  exposureStrength: 0.15,
  whiteBalanceStrength: 0.3,
  shadowLift: 0.03,
  highlightRolloff: 0.06,
  contrast: 1.01,
  saturation: 0.98,
  sharpenAmount: 0.04,
  /** leve deslocamento de temperatura (negativo = menos quente) */
  temperature: -0.02,
};

/** Sem suavização de pele e sem redução de ruído: textura é prioridade. */
export const SKIN_SMOOTHING = 0;
export const NOISE_REDUCTION = 0;

const ALPHA_MIN = 8;
const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Correção de luz e cor in-place, restrita aos pixels opacos (a pessoa).
 * O fundo transparente permanece intocado.
 */
export function normalizeLightAndColor(data: ImageData, p = defaultTreatment) {
  const px = data.data;
  const n = px.length;

  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  for (let i = 0; i < n; i += 4 * 5) {
    if ((px[i + 3] ?? 0) <= ALPHA_MIN) continue;
    sr += px[i]!;
    sg += px[i + 1]!;
    sb += px[i + 2]!;
    count += 1;
  }
  if (count === 0) return;

  const ar = sr / count;
  const ag = sg / count;
  const ab = sb / count;
  const gray = (ar + ag + ab) / 3;

  const temp = p.temperature ?? 0;
  const wbR = (1 + (gray / Math.max(ar, 1) - 1) * p.whiteBalanceStrength) * (1 + temp);
  const wbG = 1 + (gray / Math.max(ag, 1) - 1) * p.whiteBalanceStrength;
  const wbB = (1 + (gray / Math.max(ab, 1) - 1) * p.whiteBalanceStrength) * (1 - temp);

  const luma = gray / 255;
  const rawGain = p.targetLuma / Math.max(luma, 0.05);
  const gain = 1 + (Math.min(Math.max(rawGain, 0.85), 1.25) - 1) * p.exposureStrength;

  for (let i = 0; i < n; i += 4) {
    if ((px[i + 3] ?? 0) <= ALPHA_MIN) continue;
    let r = px[i]! * wbR * gain;
    let g = px[i + 1]! * wbG * gain;
    let b = px[i + 2]! * wbB * gain;

    for (let c = 0; c < 3; c += 1) {
      let v = (c === 0 ? r : c === 1 ? g : b) / 255;
      v = v + p.shadowLift * (1 - v) * (1 - v) * v * 4;
      v = v - p.highlightRolloff * v * v * v;
      v = 0.5 + (v - 0.5) * p.contrast;
      const out = clamp255(v * 255);
      if (c === 0) r = out;
      else if (c === 1) g = out;
      else b = out;
    }

    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    px[i] = clamp255(l + (r - l) * p.saturation);
    px[i + 1] = clamp255(l + (g - l) * p.saturation);
    px[i + 2] = clamp255(l + (b - l) * p.saturation);
  }
}

/**
 * Nitidez discreta (unsharp mask 3x3) aplicada só nos pixels opacos.
 * Preserva o canal alpha e não desfoca nada.
 */
export function sharpen(
  source: HTMLCanvasElement,
  p = defaultTreatment,
): HTMLCanvasElement {
  if (p.sharpenAmount <= 0) return source;
  const ctx = source.getContext("2d");
  if (!ctx) return source;

  const { width: w, height: h } = source;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const a = p.sharpenAmount;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const alpha = src.data[i + 3] ?? 0;
      out.data[i + 3] = alpha;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      for (let c = 0; c < 3; c += 1) {
        const center = src.data[i + c] ?? 0;
        if (edge || alpha <= ALPHA_MIN) {
          out.data[i + c] = center;
          continue;
        }
        const up = src.data[i - w * 4 + c] ?? center;
        const down = src.data[i + w * 4 + c] ?? center;
        const left = src.data[i - 4 + c] ?? center;
        const right = src.data[i + 4 + c] ?? center;
        const lap = center * 4 - (up + down + left + right);
        out.data[i + c] = clamp255(center + lap * a * 0.25);
      }
    }
  }

  ctx.putImageData(out, 0, 0);
  return source;
}
