import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { ShareResult } from "@/lib/photoShare";
import { BrasilLogo } from "../BrasilLogo";
import { ImmersiveBrazilLoader } from "../ImmersiveBrazilLoader";

const VIEW_MS = 30_000;
const WAIT_LIMIT_MS = 30_000;
const FAIL_MS = 3500;
const TICK_MS = 100;

type Props = {
  share: Promise<ShareResult | null>;
  onNext: () => void;
};

type Phase = "loading" | "ready" | "failed";

export function QrShareScreen({ share, onNext }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<ShareResult | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const nextRef = useRef(onNext);
  nextRef.current = onNext;

  const next = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    nextRef.current();
  }, []);

  // aguarda a operação digital (com limite) e gera o QR localmente
  useEffect(() => {
    let alive = true;
    const limit = new Promise<null>((r) => setTimeout(() => r(null), WAIT_LIMIT_MS));
    void Promise.race([share, limit]).then(async (res) => {
      if (!alive) return;
      if (!res) return setPhase("failed");
      try {
        const svg = await QRCode.toString(res.url, {
          type: "svg",
          margin: 1,
          errorCorrectionLevel: "M",
        });
        if (!alive) return;
        setResult(res);
        setQr(svg);
        setPhase("ready");
      } catch {
        if (alive) setPhase("failed");
      }
    });
    return () => {
      alive = false;
    };
  }, [share]);

  // contagem só começa depois que o QR está na tela
  useEffect(() => {
    if (phase !== "ready" || !qr) return;
    const raf = requestAnimationFrame(() => {
      startedRef.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [phase, qr]);

  // relógio único: tempo do story + limite de inatividade
  useEffect(() => {
    const tick = setInterval(() => {
      if (!startedRef.current) return;
      setElapsed((e) => {
        const n = e + TICK_MS;
        if (n >= VIEW_MS) queueMicrotask(next);
        return Math.min(n, VIEW_MS);
      });
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [next]);

  useEffect(() => {
    if (phase !== "failed") return;
    const t = setTimeout(next, FAIL_MS);
    return () => clearTimeout(t);
  }, [phase, next]);

  const progress = Math.min(1, elapsed / VIEW_MS);

  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label="Toca la pantalla para continuar"
      onClick={next}
      className="flex h-full w-full cursor-pointer flex-col items-center justify-between outline-none"
    >
      <div className="absolute inset-x-16 top-10 h-2.5 overflow-hidden rounded-full bg-foreground/20">
        <div
          className="h-full rounded-full bg-brasil-yellow"
          style={{ width: `${progress * 100}%`, transition: `width ${TICK_MS}ms linear` }}
        />
      </div>

      <BrasilLogo className="w-[16rem]" />

      {phase === "loading" && (
        <ImmersiveBrazilLoader variant="printPreparation" size={260} label="Preparando tu foto digital…" />
      )}

      {phase === "failed" && (
        <h1 className="animate-fade-up font-display text-center text-[3.5rem] font-black uppercase leading-tight">
          La foto digital no está disponible
        </h1>
      )}

      {phase === "ready" && qr && result && (
        <div className="animate-fade-up flex flex-col items-center gap-12 text-center">
          <div className="flex flex-col items-center gap-5">
            <p className="text-[2rem] font-bold uppercase tracking-[0.2em] text-brasil-yellow">
              Mientras imprimimos tu foto…
            </p>
            <h1 className="font-display text-[5.5rem] font-black uppercase leading-[0.95]">
              Llévala también
              <br />
              en tu celular.
            </h1>
          </div>

          <div className="gradient-brasil-bar rounded-[2.75rem] p-3 shadow-[var(--shadow-touch)]">
            <div className="rounded-[2.25rem] bg-paper p-10">
              <div
                className="h-[36rem] w-[36rem] [&>svg]:h-full [&>svg]:w-full"
                aria-label="Código QR para ver tu foto"
                role="img"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            </div>
          </div>

          <p className="text-[2.1rem] font-semibold">Apunta la cámara de tu celular al código QR.</p>
        </div>
      )}

      <div className="flex flex-col items-center gap-6">
        <p className="text-[1.4rem] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Toca la pantalla para continuar
        </p>
      </div>
    </div>
  );
}
