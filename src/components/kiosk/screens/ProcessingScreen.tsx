import { useCallback, useEffect, useRef, useState } from "react";
import { isPhotoError, processPassportPhoto } from "@/lib/processPassportPhoto";
import { BrasilLogo } from "../BrasilLogo";
import { ImmersiveBrazilLoader } from "../ImmersiveBrazilLoader";
import { TouchButton } from "../TouchButton";

type Props = {
  capture: string;
  onDone: (processed: string) => void;
  onBackToCamera: () => void;
  paused?: boolean;
};

const messages = {
  "no-face": "No pudimos identificar tu rostro",
  "multiple-faces": "Solo una persona debe aparecer en la foto",
  generic: "No pudimos preparar tu foto.",
} as const;

type FailKind = keyof typeof messages;

/** tempo mínimo de exibição da narrativa */
const MIN_MS = 5000;

export function ProcessingScreen({ capture, onDone, onBackToCamera, paused = false }: Props) {
  const [failed, setFailed] = useState<FailKind | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const [ready, setReady] = useState<string | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // tempo mínimo, contado independentemente do processamento real
  useEffect(() => {
    setMinDone(false);
    const timer = setTimeout(() => setMinDone(true), MIN_MS);
    return () => clearTimeout(timer);
  }, [attempt]);

  // operação real: começa de imediato e o resultado fica guardado em memória
  useEffect(() => {
    let cancelled = false;
    setFailed(null);
    setReady(null);

    void (async () => {
      try {
        const result = await processPassportPhoto(capture);
        if (!cancelled) setReady(result);
      } catch (err) {
        if (cancelled) return;
        setFailed(isPhotoError(err) ? err.code : "generic");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [capture, attempt]);

  // avanço apenas quando as duas condições estão satisfeitas
  useEffect(() => {
    if (ready && minDone && !paused) doneRef.current(ready);
  }, [ready, minDone, paused]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return (
    <>
      <BrasilLogo className="w-[18rem]" />

      <div className="flex flex-col items-center gap-14 text-center">
        {failed ? (
          <h1 className="font-display text-[3.5rem] font-black uppercase leading-none">
            {messages[failed]}
          </h1>
        ) : (
          <>
            <ImmersiveBrazilLoader
              variant="photoProcessing"
              size={280}
              label="Preparando tu foto…"
            />
            <p className="text-[1.75rem] font-medium text-muted-foreground">
              Esto tardará solo unos segundos.
            </p>
          </>
        )}
      </div>

      {failed ? (
        <div className="flex w-full max-w-[52rem] flex-col gap-8">
          {failed === "generic" && (
            <TouchButton onClick={retry} className="text-[2.75rem]">
              Intentar de nuevo
            </TouchButton>
          )}
          <TouchButton variant="ghost" onClick={onBackToCamera} className="text-[2.75rem]">
            Volver a la cámara
          </TouchButton>
        </div>
      ) : (
        <p className="text-2xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Brasil 2027
        </p>
      )}
    </>
  );
}
