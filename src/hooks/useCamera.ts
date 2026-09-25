import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "starting" | "live" | "error";

const CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  },
  audio: false,
};

/**
 * Pede foco, exposição e balanço de branco contínuos quando a câmera oferecer
 * esses controles. Falhas são ignoradas silenciosamente.
 */
async function applyContinuousControls(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (!track || typeof track.getCapabilities !== "function") return;
  try {
    const caps = track.getCapabilities() as Record<string, unknown>;
    const advanced: Record<string, string> = {};
    for (const key of ["focusMode", "exposureMode", "whiteBalanceMode"] as const) {
      const modes = caps[key];
      if (Array.isArray(modes) && modes.includes("continuous")) advanced[key] = "continuous";
    }
    if (Object.keys(advanced).length === 0) return;
    await track.applyConstraints({
      advanced: [advanced],
    } as MediaTrackConstraints);
  } catch {
    // câmera sem suporte: segue com os padrões do navegador
  }
}

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
      .then(async (stream) => {
        await applyContinuousControls(stream);
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

  /**
   * Congela SINCRONAMENTE o quadro atual do vídeo num canvas, na resolução
   * real videoWidth × videoHeight (nunca o tamanho CSS), espelhado como a
   * prévia. Não usa ImageCapture.takePhoto(): a foto nativa chega depois do
   * instante zero. A conversão para JPEG é feita depois, por quem chamar.
   */
  const freezeFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || status !== "live" || !video.videoWidth || !video.videoHeight) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    return canvas;
  }, [status]);

  return { videoRef, status, freezeFrame, retry, stop };
}

  return { videoRef, status, capture, retry, stop };
}
