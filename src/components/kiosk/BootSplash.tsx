import { useEffect, useRef, useState } from "react";
import { BrasilLogo } from "./BrasilLogo";

const MIN_VISIBLE_MS = 1000;
const VIEWPORT_STABLE_MS = 300;

/**
 * Cobertura de abertura do totem: só existe no carregamento inicial da
 * aplicação. Esconde a interface até fontes, imagens e dimensões da tela
 * estarem estáveis. Não interfere nas trocas de tela do atendimento.
 */
export function BootSplash() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    let stableTimer: ReturnType<typeof setTimeout> | null = null;

    const viewportStable = () =>
      new Promise<void>((resolve) => {
        const arm = () => {
          if (stableTimer) clearTimeout(stableTimer);
          stableTimer = setTimeout(() => {
            window.removeEventListener("resize", arm);
            window.removeEventListener("orientationchange", arm);
            resolve();
          }, VIEWPORT_STABLE_MS);
        };
        window.addEventListener("resize", arm);
        window.addEventListener("orientationchange", arm);
        arm();
      });

    void (async () => {
      try {
        await Promise.all([
          document.fonts?.ready ?? Promise.resolve(),
          viewportStable(),
        ]);
      } catch {
        /* segue mesmo assim */
      }
      await new Promise((res) => requestAnimationFrame(() => res(null)));
      const remaining = MIN_VISIBLE_MS - (Date.now() - startedAt.current);
      if (remaining > 0) await new Promise((res) => setTimeout(res, remaining));
      if (cancelled) return;
      setHidden(true);
      setTimeout(() => !cancelled && setRemoved(true), 500);
    })();

    return () => {
      cancelled = true;
      if (stableTimer) clearTimeout(stableTimer);
    };
  }, []);

  if (removed) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-16 bg-brasil-blue-dark transition-opacity duration-500"
      style={{ height: "100dvh", opacity: hidden ? 0 : 1 }}
    >
      <BrasilLogo className="w-[26rem]" />
      <div className="gradient-brasil-bar h-3 w-[22rem] animate-pulse rounded-full" />
      <p className="font-display text-3xl font-black uppercase tracking-[0.35em] text-muted-foreground">
        Preparando experiência
      </p>
    </div>
  );
}
