import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "starting" | "live" | "error";

const CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
  audio: false,
};

/** stream compartilhado: aquecido antes da prévia e reutilizado por useCamera */
let shared: MediaStream | null = null;
let pending: Promise<MediaStream> | null = null;

function isAlive(stream: MediaStream | null): stream is MediaStream {
  return !!stream && stream.getVideoTracks().some((t) => t.readyState === "live");
}

/** Solicita e inicializa a câmera fora da área visível. Idempotente. */
export function prewarmCamera(): Promise<MediaStream> {
  if (isAlive(shared)) return Promise.resolve(shared);
  if (!pending) {
    pending = navigator.mediaDevices
      .getUserMedia(CONSTRAINTS)
      .then((stream) => {
        shared = stream;
        pending = null;
        return stream;
      })
      .catch((err) => {
        pending = null;
        shared = null;
        throw err;
      });
  }
  return pending;
}

/** Libera a câmera de verdade (fim do atendimento). */
export function releaseCamera() {
  shared?.getTracks().forEach((t) => t.stop());
  shared = null;
}

/**
 * Webcam do totem. Sem modo demonstrativo: se o acesso falhar, o status vira
 * "error" e nenhuma sequência avança até uma nova tentativa.
 */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [attempt, setAttempt] = useState(0);

  /** solta o vídeo, mas mantém o stream compartilhado aquecido */
  const stop = useCallback(() => {
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      setStatus("idle");
      return;
    }
    let cancelled = false;

    const start = async () => {
      setStatus("starting");
      try {
        const stream = await prewarmCamera();
        if (cancelled) return;
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          streamRef.current = null;
          setStatus("error");
          return;
        }
        video.srcObject = stream;
        await video.play().catch(() => undefined);

        // só considera pronta quando há dimensões válidas e reprodução ativa
        const waitReady = () =>
          new Promise<void>((resolve) => {
            const check = () => {
              if (cancelled) return resolve();
              if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
                return resolve();
              }
              requestAnimationFrame(check);
            };
            check();
          });
        await waitReady();
        if (!cancelled) setStatus("live");
      } catch {
        if (!cancelled) {
          stop();
          setStatus("error");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, attempt, stop]);

  const retry = useCallback(() => {
    stop();
    setStatus("starting");
    setAttempt((a) => a + 1);
  }, [stop]);

  /** Captura o frame atual em resolução nativa, já espelhado como no preview. */
  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || status !== "live" || !video.videoWidth || !video.videoHeight) return null;

    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.translate(w, 0);
    ctx.scale(-1, 1); // espelhado, igual ao preview visto pelo visitante
    ctx.drawImage(video, 0, 0, w, h);

    return canvas.toDataURL("image/jpeg", 0.98);
  }, [status]);

  return { videoRef, status, capture, retry, stop };
}
