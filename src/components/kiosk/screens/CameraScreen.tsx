import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { measureFace } from "@/lib/faceDetection";
import {
  MAX_FACE_CAPTURE_RATIO,
  MIN_FACE_CAPTURE_RATIO,
} from "@/lib/processPassportPhoto";
import { BrasilLogo } from "../BrasilLogo";
import { FaceFrameGuide } from "../FaceFrameGuide";
import { KioskSpinner } from "../KioskSpinner";
import { TouchButton } from "../TouchButton";

type Framing = "near" | "far" | "ok" | "unknown";

const HINTS: Record<Framing, string> = {
  near: "Aléjate un poco",
  far: "Acércate un poco",
  ok: "Perfecto, no te muevas",
  unknown: "Centra tu rostro",
};

/** intervalo da medição leve durante a prévia */
const MEASURE_MS = 600;
/** medições sem rosto antes de liberar a contagem mesmo assim */
const UNKNOWN_TOLERANCE = 6;

export function CameraScreen({ onCaptured }: { onCaptured: (photo: string) => void }) {
  const { videoRef, status, capture, retry } = useCamera(true);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [framing, setFraming] = useState<Framing>("unknown");
  const [armed, setArmed] = useState(false);
  const captureRef = useRef(capture);
  captureRef.current = capture;

  // medição leve do enquadramento (não altera a captura nem a foto final)
  useEffect(() => {
    if (status !== "live") {
      setFraming("unknown");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unknowns = 0;
    const frame = document.createElement("canvas");

    const tick = async () => {
      const video = videoRef.current;
      if (!cancelled && video && video.videoWidth > 0) {
        const scale = 320 / video.videoWidth;
        frame.width = 320;
        frame.height = Math.round(video.videoHeight * scale);
        const ctx = frame.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, frame.width, frame.height);
          const measure = await measureFace(frame);
          if (!cancelled) {
            if (!measure) {
              unknowns += 1;
              setFraming("unknown");
              if (unknowns >= UNKNOWN_TOLERANCE) setArmed(true);
            } else {
              unknowns = 0;
              const next: Framing =
                measure.ratio > MAX_FACE_CAPTURE_RATIO || measure.belowChin < 0.6
                  ? "near"
                  : measure.ratio < MIN_FACE_CAPTURE_RATIO
                    ? "far"
                    : "ok";
              setFraming(next);
              if (next === "ok") setArmed(true);
            }
          }
        }
      }
      if (!cancelled) timer = setTimeout(() => void tick(), MEASURE_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [status, videoRef]);

  // a contagem só começa com vídeo reproduzindo e enquadramento adequado
  useEffect(() => {
    if (status !== "live" || !armed) {
      setCount(null);
      setFlash(false);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setCount(5), 1800));
    for (let i = 1; i <= 4; i += 1) {
      timers.push(setTimeout(() => setCount(5 - i), 1800 + i * 1000));
    }
    timers.push(
      setTimeout(() => {
        setCount(null);
        setFlash(true);
        const shot = captureRef.current();
        timers.push(
          setTimeout(() => {
            if (shot) onCaptured(shot);
          }, 450),
        );
      }, 1800 + 5000),
    );
    return () => timers.forEach(clearTimeout);
  }, [status, armed, onCaptured]);

  const intense = count !== null && count <= 3;
  const guidance = intense ? HINTS.ok : HINTS[framing];

  return (
    <>
      <BrasilLogo className="w-[16rem]" />

      <div className="flex w-full flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-display text-[4.25rem] font-black uppercase leading-none">
            Encuadra tu rostro
          </h1>
          <p className="text-[2rem] font-medium text-muted-foreground">
            Colócate de frente y mira a la cámara.
          </p>
        </div>

        {/* moldura quadrada: mesma proporção 1:1 do recorte final */}
        <div
          className={`relative aspect-square w-full max-w-[54rem] overflow-hidden rounded-[3rem] border-8 bg-brasil-blue-dark transition-colors duration-500 ${
            intense ? "border-brasil-green-light motion-safe:animate-pulse" : "border-border"
          }`}
          style={intense ? { boxShadow: "var(--shadow-glow)" } : undefined}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full scale-x-[-1] object-cover"
          />

          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-brasil-blue-deep">
              <KioskSpinner size={80} />
            </div>
          )}

          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 bg-brasil-blue-deep px-14 text-center">
              <p className="font-display text-[3.25rem] font-black uppercase leading-tight">
                No pudimos acceder a la cámara.
              </p>
              <TouchButton onClick={retry} className="text-[2.5rem]">
                Intentar de nuevo
              </TouchButton>
            </div>
          )}

          {status === "live" && <FaceFrameGuide ok={intense} />}

          {status === "live" && (
            <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-6">
              {count !== null && (
                <span
                  key={count}
                  className={`font-display animate-count-in flex h-32 w-32 items-center justify-center rounded-full text-[5rem] font-black leading-none ${
                    intense
                      ? "bg-brasil-green-light text-brasil-blue-dark"
                      : "bg-brasil-blue-dark/70 text-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
              <span className="font-display rounded-full bg-brasil-blue-dark/70 px-10 py-4 text-[1.75rem] font-black uppercase tracking-[0.15em]">
                {guidance}
              </span>
            </div>
          )}

          {flash && <div className="animate-flash absolute inset-0 bg-card" />}
        </div>
      </div>

      <p className="text-2xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Brasil 2027
      </p>
    </>
  );
}
