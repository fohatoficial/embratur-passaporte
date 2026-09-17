import { useCallback, useEffect, useRef, useState } from "react";
import { BrasilLogo } from "../BrasilLogo";
import { PrintArea } from "../PrintArea";
import { buildPrintStrip } from "@/lib/buildPrintStrip";

type Props = {
  photo: string;
  onFinished: () => void;
};

type PrintState = "idle" | "preparing" | "printing" | "completed";

/**
 * Monta a tira de impressão 2x6 a partir da foto aprovada e envia um único
 * trabalho de impressão por captura.
 */
export function PrintingScreen({ photo, onFinished }: Props) {
  const [state, setState] = useState<PrintState>("idle");
  const [strip, setStrip] = useState<string | null>(null);
  const stateRef = useRef<PrintState>("idle");
  const finishedRef = useRef(false);
  const doneRef = useRef(onFinished);
  doneRef.current = onFinished;

  const setPrintState = useCallback((next: PrintState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPrintState("completed");
    setStrip(null);
    doneRef.current();
  }, [setPrintState]);

  // idle -> preparing: gera a tira sem reprocessar a fotografia
  useEffect(() => {
    if (stateRef.current !== "idle") return;
    setPrintState("preparing");
    let cancelled = false;
    void (async () => {
      try {
        const doc = await buildPrintStrip(photo);
        if (!cancelled) setStrip(doc);
      } catch {
        if (!cancelled) finish();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photo, finish, setPrintState]);

  useEffect(() => {
    const onAfterPrint = () => finish();
    window.addEventListener("afterprint", onAfterPrint);
    // fallback: nunca dispara uma segunda impressão, apenas encerra a tela
    const fallback = setTimeout(finish, 20000);
    return () => {
      window.removeEventListener("afterprint", onAfterPrint);
      clearTimeout(fallback);
    };
  }, [finish]);

  // única transição preparing -> printing que pode chamar window.print()
  const print = useCallback(() => {
    if (stateRef.current !== "preparing") return;
    setPrintState("printing");
    window.print();
  }, [setPrintState]);

  return (
    <>
      <BrasilLogo className="w-[18rem]" />

      <div className="animate-fade-up flex flex-col items-center gap-14 text-center">
        <div className="gradient-brasil-bar h-4 w-[32rem] rounded-full" />
        <h1 className="font-display text-[6rem] font-black uppercase leading-none">
          Imprimindo sua foto
        </h1>
        <p className="max-w-[46rem] text-4xl font-medium text-muted-foreground">
          {state === "printing" ? "Enviando para a impressora." : "Aguarde alguns instantes."}
        </p>
      </div>

      <p className="text-3xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Passaporte · 5x5
      </p>

      {strip && <PrintArea document={strip} onReady={print} />}
    </>
  );
}
