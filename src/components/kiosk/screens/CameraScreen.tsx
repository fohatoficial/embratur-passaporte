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
/** espera antes do primeiro número, duração de cada número e número inicial */
const LEAD_MS = 1800;
const STEP_MS = 1000;
const COUNT_FROM = 5;

export function CameraScreen({
  onCaptured,
  paused = false,
}: {
  onCaptured: (photo: string) => void;
  paused?: boolean;
}) {
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const { videoRef, status, freezeFrame, retry } = useCamera(true);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [framing, setFraming] = useState<Framing>("unknown");
  const [armed, setArmed] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [attemptKey, setAttemptKey] = useState(0);
  const freezeRef = useRef(freezeFrame);
  freezeRef.current = freezeFrame;
  const captureCommittedRef = useRef(false);
  const frozenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frozenHostRef = useRef<HTMLDivElement>(null);

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
                measure.ratio > MAX_FACE_CAPTURE_RATIO || measure.belowChin < 0.35
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

  // Controlador único da contagem (relógio monotônico performance.now + rAF).
  // A captura acontece na mesma transição que remove o último número.
  useEffect(() => {
    if (status !== "live" || !armed) {
      setCount(null);
      setFlash(false);
      return;
    }

    captureCommittedRef.current = false;
    let cancelled = false;
    let raf = 0;
    let deliverTimer: ReturnType<typeof setTimeout> | undefined;
    let start = performance.now();
    let shown: number | null = null;

    const loop = () => {
      if (cancelled || captureCommittedRef.current) return;
      // confirmação de saída aberta: segura a contagem e recomeça do zero
      if (pausedRef.current) {
        start = performance.now();
        if (shown !== null) {
          shown = null;
          setCount(null);
        }
        raf = requestAnimationFrame(loop);
        return;
      }
      const elapsed = performance.now() - start;
      if (elapsed < LEAD_MS) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const step = Math.floor((elapsed - LEAD_MS) / STEP_MS);
      if (step < COUNT_FROM) {
        const next = COUNT_FROM - step;
        if (next !== shown) {
          shown = next;
          setCount(next);
        }
        raf = requestAnimationFrame(loop);
        return;
      }

      // instante zero: copia os pixels sincronamente antes de qualquer outra coisa
      captureCommittedRef.current = true;
      const tEnd = start + LEAD_MS + COUNT_FROM * STEP_MS;
      const canvas = freezeRef.current();
      const tDraw = performance.now();
      if (import.meta.env.DEV) {
        console.debug(`[captura] fim do 1: ${tEnd.toFixed(1)}ms · drawImage: ${tDraw.toFixed(1)}ms · Δ ${(tDraw - tEnd).toFixed(1)}ms`);
      }
      setCount(null);
      if (!canvas) {
        setCaptureFailed(true);
        return;
      }
      frozenCanvasRef.current = canvas;
      setFrozen(true);
      setFlash(true);
      // a conversão (lenta) acontece depois de a prévia congelada aparecer
      const deliver = () => {
        if (cancelled) return;
        if (pausedRef.current) {
          deliverTimer = setTimeout(deliver, 200);
          return;
        }
        const data = canvas.toDataURL("image/jpeg", 0.98);
        if (import.meta.env.DEV) {
          console.debug(`[captura] imagem pronta: ${(performance.now() - tDraw).toFixed(1)}ms após drawImage`);
        }
        onCaptured(data);
      };
      deliverTimer = setTimeout(deliver, 450);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (deliverTimer) clearTimeout(deliverTimer);
    };
  }, [status, armed, onCaptured, attemptKey]);

  // mostra o quadro congelado no lugar do vídeo
  useEffect(() => {
    const host = frozenHostRef.current;
    const canvas = frozenCanvasRef.current;
    if (!frozen || !host || !canvas) return;
    canvas.className = "absolute inset-0 h-full w-full object-cover";
    host.replaceChildren(canvas);
    videoRef.current?.pause();
    return () => host.replaceChildren();
  }, [frozen, videoRef]);

  const retryCapture = () => {
    setCaptureFailed(false);
    setFrozen(false);
    setFlash(false);
    frozenCanvasRef.current = null;
    setAttemptKey((k) => k + 1);
  };

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

          <div ref={frozenHostRef} className={frozen ? "absolute inset-0" : "hidden"} />

          {status === "live" && !frozen && <FaceFrameGuide ok={intense || framing === "ok"} />}

          {status === "live" && !frozen && !captureFailed && (
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

          {captureFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 bg-brasil-blue-deep px-14 text-center">
              <p className="font-display text-[3.25rem] font-black uppercase leading-tight">
                No pudimos tomar la foto.
              </p>
              <TouchButton onClick={retryCapture} className="text-[2.5rem]">
                Intentar de nuevo
              </TouchButton>
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
