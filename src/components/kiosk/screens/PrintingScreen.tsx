import { useCallback, useEffect, useRef, useState } from "react";
import { BrasilLogo } from "../BrasilLogo";
import { TouchButton } from "../TouchButton";
import { buildPrintStrip } from "@/lib/buildPrintStrip";
import { enqueuePrintJob, fetchJob, type PrintJobStatus } from "@/lib/printQueue";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  photo: string;
  /** devolve o documento 2x6 já montado para eventual reimpressão */
  onFinished: (strip: string | null) => void;
};

type Phase = "sending" | "queued" | "processing" | "sent" | "error";

const headline: Record<Phase, string> = {
  sending: "Enviando sua foto para impressão",
  queued: "Enviando sua foto para impressão",
  processing: "Preparando sua impressão",
  sent: "Sua foto foi enviada para a impressora",
  error: "Não foi possível enviar sua foto",
};

/**
 * O totem não imprime: monta o documento 2x6 e o envia para a fila da
 * estação de impressão, acompanhando o status até "sent".
 */
export function PrintingScreen({ photo, onFinished }: Props) {
  const [phase, setPhase] = useState<Phase>("sending");
  const [attempt, setAttempt] = useState(0);
  const jobIdRef = useRef<string>(crypto.randomUUID());
  const stripRef = useRef<string | null>(null);
  const doneRef = useRef(onFinished);
  doneRef.current = onFinished;

  // envio (idempotente: mesma dedupe_key em cada tentativa)
  useEffect(() => {
    let cancelled = false;
    setPhase("sending");

    void (async () => {
      try {
        if (!stripRef.current) stripRef.current = await buildPrintStrip(photo);
        const job = await enqueuePrintJob(jobIdRef.current, stripRef.current);
        if (cancelled) return;
        setPhase(job.status === "pending" ? "queued" : mapStatus(job.status));
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photo, attempt]);

  // acompanhamento do status: realtime + verificação periódica
  useEffect(() => {
    if (phase !== "queued" && phase !== "processing") return;
    const jobId = jobIdRef.current;
    let cancelled = false;

    const apply = (status: PrintJobStatus) => {
      if (!cancelled) setPhase(mapStatus(status));
    };

    const channel = supabase
      .channel(`print-job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "print_jobs", filter: `id=eq.${jobId}` },
        (payload) => apply((payload.new as { status: PrintJobStatus }).status),
      )
      .subscribe();

    const poll = setInterval(() => {
      void fetchJob(jobId).then((job) => job && apply(job.status));
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [phase]);

  // encerra a jornada alguns segundos após a confirmação
  useEffect(() => {
    if (phase !== "sent") return;
    const timer = setTimeout(() => doneRef.current(stripRef.current), 4000);
    return () => clearTimeout(timer);
  }, [phase]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return (
    <>
      <BrasilLogo className="w-[18rem]" />

      <div className="animate-fade-up flex flex-col items-center gap-14 text-center">
        <div className="gradient-brasil-bar h-4 w-[32rem] rounded-full" />
        <h1 className="font-display text-[5.5rem] font-black uppercase leading-none">
          {headline[phase]}
        </h1>
        <p className="max-w-[46rem] text-4xl font-medium text-muted-foreground">
          {phase === "error"
            ? "Verifique a conexão e toque para tentar novamente."
            : phase === "sent"
              ? "Retire sua foto na estação de impressão."
              : "Aguarde alguns instantes."}
        </p>
      </div>

      {phase === "error" ? (
        <div className="flex w-full max-w-[52rem] flex-col gap-8">
          <TouchButton onClick={retry}>Tentar novamente</TouchButton>
        </div>
      ) : (
        <p className="text-3xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Passaporte · 5x5
        </p>
      )}
    </>
  );
}

function mapStatus(status: PrintJobStatus): Phase {
  if (status === "sent") return "sent";
  if (status === "processing") return "processing";
  if (status === "failed" || status === "cancelled") return "error";
  return "queued";
}
