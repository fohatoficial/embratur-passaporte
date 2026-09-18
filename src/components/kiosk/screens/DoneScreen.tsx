import { useCallback, useEffect, useRef, useState } from "react";
import { Home, Printer, RotateCcw } from "lucide-react";
import { BrasilLogo } from "../BrasilLogo";
import { enqueuePrintJob } from "@/lib/printQueue";

const AUTO_RESET_SECONDS = 60;

type Props = {
  onReset: () => void;
  /** documento 2x6 já montado; nada é reprocessado aqui */
  strip: string | null;
};

type ReprintState = "idle" | "sending" | "done" | "error";

export function DoneScreen({ onReset, strip }: Props) {
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
          <span className="font-display block text-[10rem] font-black uppercase leading-none">
            Pronto!
          </span>
        </div>

        <p className="max-w-[44rem] text-5xl font-semibold leading-tight">
          Sua foto para o passaporte está pronta.
        </p>
        <p className="max-w-[44rem] text-4xl font-medium text-muted-foreground">
          Prepare-se para viver o Brasil em 2027.
        </p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-8">
          <ActionButton
            label={reprint === "done" ? "Reimpressão enviada" : "Reimprimir"}
            disabled={!strip || reprint !== "idle"}
            completed={reprint === "done"}
            onClick={handleReprint}
            icon={
              <span className="relative block">
                <Printer className="h-16 w-16" strokeWidth={2.5} />
                <RotateCcw
                  className="absolute -bottom-2 -right-3 h-9 w-9 rounded-full bg-secondary p-1"
                  strokeWidth={3}
                />
              </span>
            }
          />
          <ActionButton
            label="Início"
            onClick={() => resetRef.current()}
            icon={<Home className="h-16 w-16" strokeWidth={2.5} />}
          />
        </div>

        {reprint === "error" && (
          <p className="text-2xl font-semibold text-destructive-foreground">
            Não foi possível enviar a reimpressão.
          </p>
        )}

        <p className="text-2xl font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Início automático em {seconds}s
        </p>
      </div>
    </>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  completed,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  completed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-display flex min-h-[8.5rem] min-w-[8.5rem] flex-col items-center justify-center gap-3 rounded-[2rem] border-4 px-10 py-6 text-2xl font-black uppercase tracking-[0.12em] transition-transform duration-200 active:scale-[0.97] disabled:active:scale-100 ${
        completed
          ? "border-brasil-green-light bg-secondary/70 text-brasil-green-light"
          : "border-border bg-secondary/70 text-secondary-foreground disabled:opacity-50"
      }`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
