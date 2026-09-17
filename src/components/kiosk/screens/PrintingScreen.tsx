import { useCallback, useEffect, useRef } from "react";
import { BrasilLogo } from "../BrasilLogo";
import { PrintArea } from "../PrintArea";

type Props = {
  photo: string;
  onFinished: () => void;
};

/**
 * Envia a foto exibida para a fila de impressão (4x6) exatamente uma vez
 * por captura e avança quando o navegador termina o diálogo de impressão.
 */
export function PrintingScreen({ photo, onFinished }: Props) {
  const printedRef = useRef(false);
  const finishedRef = useRef(false);
  const doneRef = useRef(onFinished);
  doneRef.current = onFinished;

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    doneRef.current();
  }, []);

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

  const print = useCallback(() => {
    if (printedRef.current) return;
    printedRef.current = true;
    window.print();
  }, []);

  return (
    <>
      <BrasilLogo className="w-[18rem]" />

      <div className="animate-fade-up flex flex-col items-center gap-14 text-center">
        <div className="gradient-brasil-bar h-4 w-[32rem] rounded-full" />
        <h1 className="font-display text-[6rem] font-black uppercase leading-none">
          Imprimindo sua foto
        </h1>
        <p className="max-w-[46rem] text-4xl font-medium text-muted-foreground">
          Aguarde alguns instantes.
        </p>
      </div>

      <p className="text-3xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Passaporte · 4x6
      </p>

      <PrintArea photo={photo} onReady={print} />
    </>
  );
}
