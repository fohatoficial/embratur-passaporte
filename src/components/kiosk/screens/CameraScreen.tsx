import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { BrasilLogo } from "../BrasilLogo";
import { FaceGuide } from "../FaceGuide";

export function CameraScreen({ onCaptured }: { onCaptured: (photo: string | null) => void }) {
  const { videoRef, status, capture } = useCamera(true);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const captureRef = useRef(capture);
  captureRef.current = capture;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setCount(5), 1800));
    for (let i = 1; i <= 4; i += 1) {
      timers.push(setTimeout(() => setCount(5 - i), 1800 + i * 1000));
    }
    timers.push(
      setTimeout(() => {
        setCount(null);
        setFlash(true);
      }, 1800 + 5000),
    );
    timers.push(
      setTimeout(() => {
        onCaptured(captureRef.current());
      }, 1800 + 5450),
    );
    return () => timers.forEach(clearTimeout);
  }, [onCaptured]);

  const intense = count !== null && count <= 2;

  return (
    <>
      <BrasilLogo className="w-[16rem]" />

      <div className="relative w-full max-w-[56rem]">
        <div
          className={`relative aspect-[5/7] w-full overflow-hidden rounded-[3rem] border-8 bg-brasil-blue-dark transition-colors duration-500 ${
            intense ? "border-brasil-yellow" : "border-border"
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

          {status !== "live" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-brasil-blue-deep">
              <div className="h-56 w-56 rounded-full bg-secondary" />
              <div className="h-72 w-[26rem] rounded-t-[10rem] bg-secondary" />
              <p className="absolute bottom-12 text-3xl font-semibold uppercase tracking-widest text-muted-foreground">
                {status === "unavailable" ? "Pré-visualização simulada" : "Iniciando câmera"}
              </p>
            </div>
          )}

          <div className="absolute inset-0 p-10">
            <FaceGuide intense={intense} />
          </div>

          {count !== null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                key={count}
                className={`font-display animate-count-in text-[22rem] font-black leading-none ${
                  intense ? "text-brasil-yellow" : "text-foreground"
                }`}
                style={{ textShadow: "0 0 6rem oklch(0.2 0.08 253 / 70%)" }}
              >
                {count}
              </span>
            </div>
          )}

          {flash && <div className="animate-flash absolute inset-0 bg-card" />}
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="font-display text-[5rem] font-black uppercase leading-none">
          Posicione seu rosto
        </h1>
        <p className="text-4xl font-medium text-muted-foreground">
          A foto será feita automaticamente.
        </p>
      </div>
    </>
  );
}
