import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { BrasilLogo } from "../BrasilLogo";
import { ImmersiveBrazilLoader } from "../ImmersiveBrazilLoader";
import { KioskSpinner } from "../KioskSpinner";
import { TouchButton } from "../TouchButton";
import { buildPrintStrip } from "@/lib/buildPrintStrip";
import { enqueuePrintJob, fetchJob, type PrintJobStatus } from "@/lib/printQueue";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  photo: string;
  /** devolve o documento 2x6 já montado para eventual reimpressão */
  onFinished: (strip: string | null) => void;
  /** descarta só esta captura e volta à câmera, preservando o cadastro */
  onRetake: () => void;
};

type Phase = "sending" | "queued" | "processing" | "sent" | "error";
/** etapa que falhou — cada uma é repetida isoladamente */
type FailStage = "strip" | "queue" | "network" | "printer";

const headline: Record<Exclude<Phase, "error">, string> = {
  sending: "Preparando la impresión…",
  queued: "Enviando a la estación…",
  processing: "Impresión solicitada.",
  sent: "Tu foto fue enviada a la impresora",
};

const failText: Record<FailStage, string> = {
  strip: "No pudimos preparar el archivo de impresión.",
  queue: "No pudimos enviar tu foto a la estación de impresión.",
  network: "Sin conexión en este momento. Revisa la red e intenta de nuevo.",
  printer: "La estación de impresión no pudo imprimir tu foto.",
};

const MIN_MS = 5000;

/**
 * O totem não imprime: monta o documento 2x6 e o envia para a fila da
 * estação, acompanhando o status até "sent". O compartilhamento digital
 * corre em paralelo e nunca interfere aqui.
 */
export function PrintingScreen({ photo, onFinished, onRetake }: Props) {
  const [phase, setPhase] = useState<Phase>("sending");
  const [fail, setFail] = useState<FailStage | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  // um ID por captura: toda nova tentativa reutiliza o mesmo trabalho
  const jobIdRef = useRef<string>(crypto.randomUUID());
  const stripRef = useRef<string | null>(null);
  const startedRef = useRef(Date.now());
  const doneRef = useRef(onFinished);
  doneRef.current = onFinished;

  useEffect(() => {
    let cancelled = false;
    setPhase("sending");
    setFail(null);

    void (async () => {
      // 1. tira: gerada uma única vez
      if (!stripRef.current) {
        try {
          stripRef.current = await buildPrintStrip(photo);
        } catch {
          if (!cancelled) {
            setFail("strip");
            setPhase("error");
            setRetrying(false);
          }
          return;
        }
      }
      // 2. fila: idempotente pelo mesmo ID (não duplica, recoloca se falhou)
      try {
        const job = await enqueuePrintJob(jobIdRef.current, stripRef.current);
        if (cancelled) return;
        applyStatus(job.status);
      } catch {
        if (cancelled) return;
        setFail(typeof navigator !== "undefined" && !navigator.onLine ? "network" : "queue");
        setPhase("error");
      } finally {
        if (!cancelled) setRetrying(false);
      }
    })();

    function applyStatus(status: PrintJobStatus) {
      const next = mapStatus(status);
      if (next === "error") setFail("printer");
      setPhase(next === "processing" || next === "sent" || next === "error" ? next : "queued");
    }

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
      if (cancelled) return;
      const next = mapStatus(status);
      if (next === "error") setFail("printer");
      setPhase(next);
    };

    const channel = supabase
      .channel(`print-job-${jobId}-${attempt}`)
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
  }, [phase, attempt]);

  useEffect(() => {
    if (phase !== "sent") return;
    const elapsed = Date.now() - startedRef.current;
    const wait = Math.max(2500, MIN_MS - elapsed);
    const timer = setTimeout(() => doneRef.current(stripRef.current), wait);
    return () => clearTimeout(timer);
  }, [phase]);

  const retry = useCallback(() => {
    if (retrying) return;
    setRetrying(true);
    setAttempt((a) => a + 1);
  }, [retrying]);

  const isError = phase === "error";

  return (
    <>
      <BrasilLogo className="w-[18rem]" />

      <div className="animate-fade-up flex flex-col items-center gap-14 text-center">
        {isError || phase === "sent" ? (
          <h1 className="font-display text-[3rem] font-black uppercase leading-tight">
            {isError ? "No pudimos enviar tu foto" : headline.sent}
          </h1>
        ) : (
          <ImmersiveBrazilLoader variant="printPreparation" size={280} label={headline[phase]} />
        )}
        {isError || phase !== "sent" ? (
          <p className="max-w-[44rem] text-[1.75rem] font-medium text-muted-foreground">
            {isError
              ? failText[fail ?? "queue"]
              : "Esto tardará solo unos segundos."}
          </p>
        ) : null}
      </div>

      {isError ? (
        <div className="flex w-full max-w-[52rem] flex-col gap-8">
          <TouchButton onClick={retry} disabled={retrying} className="text-[2.75rem]">
            <span className="flex items-center justify-center gap-5">
              {retrying ? <KioskSpinner size={48} /> : <RotateCcw className="h-12 w-12" strokeWidth={3} />}
              {retrying ? "Intentando…" : "Intentar de nuevo"}
            </span>
          </TouchButton>
          <TouchButton variant="ghost" onClick={onRetake} disabled={retrying} className="text-[2.75rem]">
            <span className="flex items-center justify-center gap-5">
              <Camera className="h-12 w-12" strokeWidth={3} />
              Tomar otra foto
            </span>
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
