/**
 * Arte técnica de teste para a KODAK 6900: mesma tira 2x6 (600x1800 px)
 * com os três quadrados de 591x591 px nas posições reais de corte.
 * Gerada localmente, sem passar pela fila do totem.
 */
import { CUT_SIZE, CUT_TOPS, STRIP_H, STRIP_W } from "./buildPrintStrip";

export function buildTestStrip(): string {
  const canvas = document.createElement("canvas");
  canvas.width = STRIP_W;
  canvas.height = STRIP_H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas indisponível.");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, STRIP_W, STRIP_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const x = (STRIP_W - CUT_SIZE) / 2;
  const stamp = new Date().toLocaleString("pt-BR");

  CUT_TOPS.forEach((top, index) => {
    const cx = x + CUT_SIZE / 2;
    const cy = top + CUT_SIZE / 2;

    // borda fina indicando o limite de corte
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, top + 0.5, CUT_SIZE - 1, CUT_SIZE - 1);

    // marca central discreta
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy);
    ctx.lineTo(cx + 24, cy);
    ctx.moveTo(cx, cy - 24);
    ctx.lineTo(cx, cy + 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#111111";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("TESTE DE IMPRESSÃO", cx, top + 120);
    ctx.font = "bold 34px sans-serif";
    ctx.fillText("5 × 5 CM", cx, top + 175);
    ctx.font = "bold 90px sans-serif";
    ctx.fillText(String(index + 1), cx, top + CUT_SIZE - 120);
    ctx.font = "20px sans-serif";
    ctx.fillText(`POSIÇÃO ${index + 1}`, cx, top + CUT_SIZE - 50);
    ctx.fillText(stamp, cx, top + CUT_SIZE - 22);
  });

  return canvas.toDataURL("image/jpeg", 0.95);
}
