import { useCallback, useEffect, useRef, useState } from "react";
import { Home, Printer, QrCode, RotateCcw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getPhotoShare } from "@/lib/photoShare.functions";
import type { ShareResult } from "@/lib/photoShare";
import { BrasilLogo } from "../BrasilLogo";
import { ActionTile } from "../ActionTile";
import { KioskSpinner } from "../KioskSpinner";
import { enqueuePrintJob } from "@/lib/printQueue";

const AUTO_RESET_SECONDS = 60;
const SHARE_CHECK_MS = 20_000;

type Props = {
  onReset: () => void;
  /** documento 2x6 já montado; nada é reprocessado aqui */
  strip: string | null;
  /** compartilhamento já criado neste atendimento (reutilizado, nunca recriado) */
  share?: Promise<ShareResult | null> | null;
  onViewQr?: () => void;
};

type ReprintState = "idle" | "sending" | "done" | "error";

export function DoneScreen({ onReset, strip, share, onViewQr }: Props) {
  const [qrAvailable, setQrAvailable] = useState(false);
  const checkShare = useServerFn(getPhotoShare);
  const [reprint, setReprint] = useState<ReprintState>("idle");
  const [seconds, setSeconds] = useState(AUTO_RESET_SECONDS);
  const resetRef = useRef(onReset);
  resetRef.current = onReset;

  // contagem única; encerra ao desmontar
  useEffect(() => {
    const tick = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(tick);
          resetRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // VER QR só com compartilhamento válido: token existente, dentro das 24h e não excluído
  useEffect(() => {
    if (!share || !onViewQr) return;
    let alive = true;
    let res: ShareResult | null = null;
    const verify = async () => {
      if (!res) return;
      if (Date.parse(res.expiresAt) <= Date.now()) return alive && setQrAvailable(false);
      try {
        const r = await checkShare({ data: { token: res.token } });
        if (alive) setQrAvailable(!!r.ok);
      } catch {
        /* falha de rede: mantém o estado atual */
      }
    };
    void share.then((r) => {
      if (!alive || !r) return;
      res = r;
      setQrAvailable(Date.parse(r.expiresAt) > Date.now());
      void verify();
    });
    const id = setInterval(() => void verify(), SHARE_CHECK_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [share, onViewQr, checkShare]);

  const handleReprint = useCallback(() => {
    if (!strip || reprint !== "idle") return;
    setReprint("sending");
    setSeconds(AUTO_RESET_SECONDS);
    void (async () => {
      try {
        await enqueuePrintJob(crypto.randomUUID(), strip);
        setReprint("done");
      } catch {
        setReprint("error");
      }
    })();
  }, [strip, reprint]);

  const reprintLabel =
    reprint === "sending"
      ? "Enviando otra copia…"
      : reprint === "done"
        ? "Reimpresión enviada"
        : "Reimprimir";

  const tile = qrAvailable ? "px-4 text-[1.85rem] tracking-[0.04em]" : "";

  return (
    <>
      <BrasilLogo className="animate-fade-up w-[18rem]" />

      <div className="animate-fade-up flex flex-col items-center gap-10 text-center">
        <div className="flex flex-col items-center gap-6">
          <span
            className="animate-stamp font-display rounded-[1.5rem] border-8 border-brasil-green-light px-10 py-4 text-4xl font-black uppercase tracking-widest text-brasil-green-light"
            style={{ animationDelay: "0.3s" }}
          >
            Brasil 2027
          </span>
          <span className="font-display block text-[8rem] font-black uppercase leading-none">
            ¡Listo!
          </span>
        </div>

        <p className="max-w-[44rem] text-[2.75rem] font-semibold leading-tight">
          Tu foto para el pasaporte está lista.
        </p>
        <p className="max-w-[44rem] text-[2.25rem] font-medium text-muted-foreground">
          Retira tus tres copias en la estación de impresión.
        </p>
      </div>

      <div className="flex w-full max-w-[60rem] flex-col items-center gap-6">
        <div className={`flex w-full items-stretch ${qrAvailable ? "gap-6" : "gap-8"}`}>
          {qrAvailable && onViewQr && (
            <ActionTile
              variant="ghost"
              className={tile}
              label="Ver QR"
              onClick={() => onViewQr()}
              icon={<QrCode className="h-16 w-16" strokeWidth={2.5} />}
            />
          )}
          <ActionTile
            variant="ghost"
            className={tile}
            label={reprintLabel}
            disabled={!strip || reprint !== "idle"}
            completed={reprint === "done"}
            onClick={handleReprint}
            icon={
              reprint === "sending" ? (
                <KioskSpinner size={56} />
              ) : (
                <span className="relative block">
                  <Printer className="h-16 w-16" strokeWidth={2.5} />
                  <RotateCcw
                    className="absolute -bottom-2 -right-3 h-9 w-9 rounded-full bg-brasil-blue-dark p-1"
                    strokeWidth={3}
                  />
                </span>
              )
            }
          />
          <ActionTile
            variant="ghost"
            className={tile}
            label="Inicio"
            onClick={() => resetRef.current()}
            icon={<Home className="h-16 w-16" strokeWidth={2.5} />}
          />
        </div>

        {reprint === "error" && (
          <p className="text-2xl font-semibold text-destructive-foreground">
            No pudimos enviar la reimpresión.
          </p>
        )}

        <p className="text-2xl font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Inicio automático en {seconds}s
        </p>
      </div>
    </>
  );
}
