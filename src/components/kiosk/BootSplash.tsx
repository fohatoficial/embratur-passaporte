import { useEffect, useRef, useState } from "react";
import { KioskSpinner } from "./KioskSpinner";

const VIEWPORT_STABLE_MS = 250;

/**
 * Carregamento minimalista da abertura: apenas um spinner sobre o fundo da
 * tela inicial. Existe só no carregamento completo da aplicação; não aparece
 * ao voltar para o início depois de um atendimento.
 */
export function BootSplash() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
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
      // primeiro quadro do layout pronto
      await new Promise((res) => requestAnimationFrame(() => res(null)));
      await new Promise((res) => requestAnimationFrame(() => res(null)));
      if (cancelled) return;
      setHidden(true);
      setTimeout(() => !cancelled && setRemoved(true), 350);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-brasil-blue-dark transition-opacity duration-300"
      style={{ height: "100dvh", opacity: hidden ? 0 : 1 }}
    >
      <KioskSpinner size={110} />
    </div>
  );
}
