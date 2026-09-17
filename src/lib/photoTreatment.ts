/**
 * Tratamento fotográfico leve — valores conservadores, ajustáveis após os
 * testes reais no totem. Não altera traços, formato do rosto nem identidade.
 */
export type TreatmentParams = {
  /** ganho de exposição alvo (luminância média desejada, 0-1) */
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
  /** raio do blur usado na redução de ruído, em px */
  denoiseRadius: number;
  /** mistura do blur na imagem original (0-1) */
  denoiseAmount: number;
  /** nitidez final (0-1) */
  sharpenAmount: number;
};

export const defaultTreatment: TreatmentParams = {
  targetLuma: 0.56,
  exposureStrength: 0.55,
  whiteBalanceStrength: 0.6,
  shadowLift: 0.16,
  highlightRolloff: 0.12,
  contrast: 1.05,
  saturation: 1.03,
  denoiseRadius: 1,
  denoiseAmount: 0.35,
  sharpenAmount: 0.22,
};

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Correção de luz e cor aplicada in-place no ImageData. */
export function normalizeLightAndColor(data: ImageData, p = defaultTreatment) {
  const px = data.data;
  const n = px.length;

  // médias por canal (amostragem para velocidade)
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  for (let i = 0; i < n; i += 4 * 7) {
    sr += px[i];
    sg += px[i + 1];
    sb += px[i + 2];
    count += 1;
  }
  const ar = sr / count;
  const ag = sg / count;
  const ab = sb / count;
  const gray = (ar + ag + ab) / 3;

  // balanço de branco (gray world, suavizado)
  const wbR = 1 + ((gray / Math.max(ar, 1) - 1) * p.whiteBalanceStrength);
  const wbG = 1 + ((gray / Math.max(ag, 1) - 1) * p.whiteBalanceStrength);
  const wbB = 1 + ((gray / Math.max(ab, 1) - 1) * p.whiteBalanceStrength);

  // exposição
  const luma = gray / 255;
  const rawGain = p.targetLuma / Math.max(luma, 0.05);
  const gain = 1 + (Math.min(Math.max(rawGain, 0.75), 1.45) - 1) * p.exposureStrength;

  for (let i = 0; i < n; i += 4) {
    let r = px[i] * wbR * gain;
    let g = px[i + 1] * wbG * gain;
    let b = px[i + 2] * wbB * gain;

    // sombras e altas luzes
    for (let c = 0; c < 3; c += 1) {
      let v = (c === 0 ? r : c === 1 ? g : b) / 255;
      v = v + p.shadowLift * (1 - v) * (1 - v) * v * 4;
      v = v - p.highlightRolloff * v * v * v;
      // contraste em torno de 0.5
      v = 0.5 + (v - 0.5) * p.contrast;
      const out = clamp255(v * 255);
      if (c === 0) r = out;
      else if (c === 1) g = out;
      else b = out;
    }

    // saturação
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    px[i] = clamp255(l + (r - l) * p.saturation);
    px[i + 1] = clamp255(l + (g - l) * p.saturation);
    px[i + 2] = clamp255(l + (b - l) * p.saturation);
  }
}

/**
 * Redução leve de ruído: mistura discreta de uma versão levemente desfocada
 * sobre a imagem inteira (sem máscara facial instável).
 */
export function denoise(
  source: HTMLCanvasElement,
  p = defaultTreatment,
): HTMLCanvasElement {
  if (p.denoiseAmount <= 0 || p.denoiseRadius <= 0) return source;
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;

  ctx.drawImage(source, 0, 0);
  ctx.globalAlpha = p.denoiseAmount;
  ctx.filter = `blur(${p.denoiseRadius}px)`;
  ctx.drawImage(source, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  return out;
}

/** Nitidez final muito discreta (unsharp mask via composição). */
export function sharpen(
  source: HTMLCanvasElement,
  p = defaultTreatment,
): HTMLCanvasElement {
  if (p.sharpenAmount <= 0) return source;
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;

  ctx.drawImage(source, 0, 0);
  // camada de contraste local muito suave
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = p.sharpenAmount * 0.5;
  ctx.filter = "blur(1.2px) invert(1)";
  ctx.drawImage(source, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  return out;
}
