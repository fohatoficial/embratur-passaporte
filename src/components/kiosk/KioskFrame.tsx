import type { ReactNode } from "react";
import ballAsset from "@/assets/ball.png.asset.json";

type Ball = {
  className: string;
  opacity: number;
  delay: string;
};

const balls: Ball[] = [
  { className: "-left-32 top-[-6rem] w-[34rem]", opacity: 0.22, delay: "0s" },
  { className: "-right-40 top-[14rem] w-[28rem]", opacity: 0.14, delay: "-6s" },
  { className: "-left-24 bottom-[8rem] w-[26rem]", opacity: 0.16, delay: "-11s" },
  { className: "right-[-10rem] bottom-[-8rem] w-[38rem]", opacity: 0.2, delay: "-3s" },
];

/**
 * Full-bleed kiosk canvas: brand background, organic shapes and textured balls
 * on the edges, clean center for content. No scroll, no chrome.
 */
export function KioskFrame({ children }: { children: ReactNode }) {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* organic KV blobs — edges only */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-48 top-[22%] h-[36rem] w-[36rem] rounded-full bg-brasil-cyan/25 blur-3xl" />
        <div className="absolute -right-56 top-[5%] h-[40rem] w-[40rem] rounded-full bg-brasil-green/25 blur-3xl" />
        <div className="absolute -left-40 bottom-[-8rem] h-[34rem] w-[34rem] rounded-full bg-brasil-yellow/15 blur-3xl" />
        <div className="absolute -right-40 bottom-[18%] h-[30rem] w-[30rem] rounded-full bg-brasil-orange/15 blur-3xl" />

        {balls.map((ball) => (
          <img
            key={ball.className}
            src={ballAsset.url}
            alt=""
            aria-hidden
            style={{ opacity: ball.opacity, animationDelay: ball.delay }}
            className={`animate-float-slow absolute ${ball.className}`}
          />
        ))}
      </div>

      <div className="gradient-brasil-bar absolute inset-x-0 top-0 h-3" />
      <div className="gradient-brasil-bar absolute inset-x-0 bottom-0 h-3" />

      <div className="relative flex h-full w-full flex-col items-center justify-between px-16 py-24">
        {children}
      </div>
    </main>
  );
}
