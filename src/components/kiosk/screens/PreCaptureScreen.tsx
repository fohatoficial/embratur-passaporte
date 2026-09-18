import { useEffect, useRef, useState } from "react";
import { prewarmCamera } from "@/hooks/useCamera";
import { BrasilLogo } from "../BrasilLogo";
import { ImmersiveBrazilLoader } from "../ImmersiveBrazilLoader";
import { TouchButton } from "../TouchButton";

/** tempo mínimo de exibição da narrativa */
const MIN_MS = 5000;

/**
 * Substitui a antiga tela de orientações: a narrativa acontece enquanto a
 * câmera é solicitada e inicializada em segundo plano. A prévia só é revelada
 * quando a câmera está pronta E o tempo mínimo terminou.
 */
export function PreCaptureScreen({ onReady }: { onReady: () => void }) {
  const [minDone, setMinDone] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  // tempo mínimo — independente da operação real
  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  // operação real: começa imediatamente, sem espera bloqueante
  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    void prewarmCamera()
      .then(() => {
        if (!cancelled) setCameraReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // as duas condições são sincronizadas aqui
  useEffect(() => {
    if (minDone && cameraReady) readyRef.current();
  }, [minDone, cameraReady]);

  return (
    <>
      <BrasilLogo className="w-[18rem]" />

      {failed ? (
        <div className="flex flex-col items-center gap-14 text-center">
          <h1 className="font-display text-[3.25rem] font-black uppercase leading-tight">
            No pudimos acceder a la cámara.
          </h1>
          <TouchButton onClick={() => setAttempt((a) => a + 1)} className="text-[2.75rem]">
            Intentar de nuevo
          </TouchButton>
        </div>
      ) : (
        <ImmersiveBrazilLoader variant="preCapture" size={280} label="Prepárate para la foto" />
      )}

      <p className="text-2xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Brasil 2027
      </p>
    </>
  );
}
