import { useCallback, useEffect, useRef, useState } from "react";
import { isPhotoError, processPassportPhoto } from "@/lib/processPassportPhoto";
import { BrasilLogo } from "../BrasilLogo";
import { PassportJourney } from "../PassportJourney";
import { TouchButton } from "../TouchButton";

type Props = {
  capture: string;
  onDone: (processed: string) => void;
  onBackToCamera: () => void;
};

const messages = {
  "no-face": "No pudimos identificar tu rostro",
  "multiple-faces": "Solo una persona debe aparecer en la foto",
  generic: "No pudimos preparar tu foto.",
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

      <div className="flex flex-col items-center gap-14 text-center">
        {!failed && <PassportJourney size={460} />}

        <h1
          className={`font-display uppercase leading-none ${
            failed ? "text-[3.5rem] font-black" : "text-[3rem] font-black"
          }`}
        >
          {failed ? messages[failed] : "Preparando tu foto…"}
        </h1>

        {!failed && (
          <p className="text-[2rem] font-medium text-muted-foreground">
            Esto tardará solo unos segundos.
          </p>
        )}
      </div>

      {failed ? (
        <div className="flex w-full max-w-[52rem] flex-col gap-8">
          {failed !== "multiple-faces" && (
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
