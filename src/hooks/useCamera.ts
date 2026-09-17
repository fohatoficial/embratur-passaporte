import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "starting" | "live" | "error";

/**
 * Webcam do totem. Sem modo demonstrativo: se o acesso falhar, o status vira
 * "error" e nenhuma sequência avança até uma nova tentativa.
 */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [attempt, setAttempt] = useState(0);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
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
