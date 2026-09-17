import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Webcam access for the kiosk. Falls back gracefully (status "unavailable")
 * so the experience keeps working with a placeholder preview.
 * Ready for future face detection / background removal steps.
 */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "live" | "unavailable">("idle");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const start = async () => {
      setStatus("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setStatus("live");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    };

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStatus("idle");
    };
  }, [active]);

  /** Captures the current frame cropped to 5x7 (document photo ratio). */
  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || status !== "live" || !video.videoWidth) return null;

    const targetW = 1000;
    const targetH = 1400;
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const scale = Math.max(targetW / video.videoWidth, targetH / video.videoHeight);
    const drawW = video.videoWidth * scale;
    const drawH = video.videoHeight * scale;

    ctx.translate(targetW, 0);
    ctx.scale(-1, 1); // mirror, matching the on-screen preview
    ctx.drawImage(video, (targetW - drawW) / 2, (targetH - drawH) / 2, drawW, drawH);

    return canvas.toDataURL("image/jpeg", 0.92);
  }, [status]);

  return { videoRef, status, capture };
}
