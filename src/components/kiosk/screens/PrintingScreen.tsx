import { useCallback, useEffect, useRef, useState } from "react";
import { BrasilLogo } from "../BrasilLogo";
import { PassportJourney } from "../PassportJourney";
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

/** estado real do sistema — nenhuma etapa simulada */
const headline: Record<Phase, string> = {
  sending: "Preparando tu foto…",
  queued: "Enviando a impresión…",
  processing: "Creando tus copias…",
  sent: "Tu foto fue enviada a la impresora",
  error: "No pudimos enviar tu foto",
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
        {phase !== "error" && <PassportJourney size={460} />}
        <h1 className="font-display text-[3rem] font-black uppercase leading-tight">
          {headline[phase]}
        </h1>
        <p className="max-w-[44rem] text-[2rem] font-medium text-muted-foreground">
          {phase === "error"
            ? "Revisa la conexión y toca para intentar de nuevo."
            : phase === "sent"
              ? "Retira tu foto en la estación de impresión."
              : "Esto tardará solo unos segundos."}
        </p>
      </div>

      {phase === "error" ? (
        <div className="flex w-full max-w-[52rem] flex-col gap-8">
          <TouchButton onClick={retry} className="text-[2.75rem]">
            Intentar de nuevo
          </TouchButton>
        </div>
      ) : (
        <p className="text-2xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Brasil 2027
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
