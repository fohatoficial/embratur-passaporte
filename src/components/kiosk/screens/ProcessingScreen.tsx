import { useCallback, useEffect, useRef, useState } from "react";
import { isPhotoError, processPassportPhoto } from "@/lib/processPassportPhoto";
import { BrasilLogo } from "../BrasilLogo";
import { TouchButton } from "../TouchButton";

type Props = {
  capture: string;
  onDone: (processed: string) => void;
  onBackToCamera: () => void;
};

const messages = {
  "no-face": "Não foi possível identificar seu rosto",
  "multiple-faces": "Apenas uma pessoa deve aparecer na foto",
  generic: "Não foi possível preparar sua foto.",
} as const;

type FailKind = keyof typeof messages;

export function ProcessingScreen({ capture, onDone, onBackToCamera }: Props) {
  const [failed, setFailed] = useState<FailKind | null>(null);
  const [attempt, setAttempt] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    setFailed(null);

    void (async () => {
      try {
        const result = await processPassportPhoto(capture);
        if (!cancelled) doneRef.current(result);
      } catch (err) {
        if (cancelled) return;
        setFailed(isPhotoError(err) ? err.code : "generic");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [capture, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return (
    <>
      <BrasilLogo className="w-[18rem]" />

      <div className="flex flex-col items-center gap-20">
        {/* passport page being processed */}
        <div className="relative h-[36rem] w-[28rem] overflow-hidden rounded-[2rem] border-8 border-border bg-brasil-blue-deep">
          <div className="absolute inset-x-10 top-12 h-[18rem] rounded-2xl bg-secondary" />
          <div className="absolute inset-x-10 bottom-24 space-y-5">
            <div className="h-5 w-3/4 rounded-full bg-muted" />
            <div className="h-5 w-1/2 rounded-full bg-muted" />
            <div className="h-5 w-2/3 rounded-full bg-muted" />
          </div>
          <div className="gradient-brasil-bar absolute inset-x-0 bottom-0 h-4" />
          {!failed && (
            <div className="animate-scan absolute inset-x-0 h-40 bg-gradient-to-b from-transparent via-brasil-cyan/50 to-transparent" />
          )}
        </div>

        <h1 className="font-display text-center text-[5.5rem] font-black uppercase leading-none">
          {failed ? "Não foi possível preparar sua foto." : "Preparando sua foto..."}
        </h1>
      </div>

      {failed ? (
        <div className="flex w-full max-w-[52rem] flex-col gap-8">
          <TouchButton onClick={retry}>Tentar novamente</TouchButton>
          <TouchButton variant="ghost" onClick={onBackToCamera}>
            Voltar para a câmera
          </TouchButton>
        </div>
      ) : (
        <p className="text-3xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Brasil 2027
        </p>
      )}
    </>
  );
}
