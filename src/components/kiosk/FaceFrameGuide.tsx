import {
  TARGET_EYE_Y_RATIO,
  TARGET_FACE_HEIGHT_RATIO,
  TOP_HEAD_MARGIN_RATIO,
} from "@/lib/processPassportPhoto";

/**
 * Guia discreta dentro da prévia quadrada: apenas quatro cantos delimitando a
 * zona segura do rosto e uma linha muito sutil na altura dos olhos.
 *
 * As proporções vêm das MESMAS constantes usadas no recorte final, então o que
 * o visitante vê corresponde à área aproveitada na foto 5x5.
 */
export function FaceFrameGuide({ ok = false }: { ok?: boolean }) {
  const top = TOP_HEAD_MARGIN_RATIO * 100;
  const height = (TARGET_FACE_HEIGHT_RATIO + TOP_HEAD_MARGIN_RATIO) * 100;
  const width = height * 0.78;
  const left = (100 - width) / 2;
  const eye = TARGET_EYE_Y_RATIO * 100;
  const color = ok ? "var(--brasil-green-light)" : "var(--brasil-yellow)";

  const corner = "absolute h-16 w-16 border-[6px]";

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="absolute"
        style={{ top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` }}
      >
        <span
          className={`${corner} left-0 top-0 rounded-tl-[1.5rem] border-b-0 border-r-0`}
          style={{ borderColor: color, opacity: 0.85 }}
        />
        <span
          className={`${corner} right-0 top-0 rounded-tr-[1.5rem] border-b-0 border-l-0`}
          style={{ borderColor: color, opacity: 0.85 }}
        />
        <span
          className={`${corner} bottom-0 left-0 rounded-bl-[1.5rem] border-r-0 border-t-0`}
          style={{ borderColor: color, opacity: 0.85 }}
        />
        <span
          className={`${corner} bottom-0 right-0 rounded-br-[1.5rem] border-l-0 border-t-0`}
          style={{ borderColor: color, opacity: 0.85 }}
        />
      </div>

      <div
        className="absolute inset-x-[22%] h-[3px] rounded-full"
        style={{ top: `${eye}%`, background: color, opacity: 0.28 }}
      />
    </div>
  );
}
