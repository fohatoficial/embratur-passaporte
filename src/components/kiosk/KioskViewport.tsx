import { useEffect, useState, type ReactNode } from "react";

const BASE_W = 1080;
const BASE_H = 1920;

/**
 * Locks the experience to the 1080x1920 (9:16) totem canvas and scales it to
 * fit whatever screen it runs on. No scroll, always full-bleed.
 */
export function KioskViewport({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () =>
      setScale(Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-brasil-blue-dark">
      <div
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
        className="relative shrink-0 overflow-hidden"
      >
        {children}
      </div>
    </div>
  );
}
