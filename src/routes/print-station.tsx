import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PrintArea } from "@/components/kiosk/PrintArea";
import { supabase } from "@/integrations/supabase/client";
import {
  claimJob,
  fetchLastFailedJob,
  fetchLastJob,
  fetchPendingJobs,
  markFailed,
  markSent,
  requeueJob,
  signedImageUrl,
  STATION_ID,
  type PrintJob,
} from "@/lib/printQueue";

const title = "Estação de impressão · Totem 1 | EMBRATUR";
const description =
  "Estação de impressão do totem 1: recebe os documentos 2x6 da fila e envia para a KODAK 6900.";

export const Route = createFileRoute("/print-station")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrintStation,
});

type Stage = "offline" | "aguardando" | "preparando" | "imprimindo" | "erro";

const stageLabel: Record<Stage, string> = {
  offline: "Estação desativada",
  aguardando: "Online · aguardando trabalhos",
  preparando: "Preparando trabalho",
  imprimindo: "Imprimindo",
  erro: "Erro no último trabalho",
};

function PrintStation() {
  const [active, setActive] = useState(false);
  const [stage, setStage] = useState<Stage>("offline");
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(0);
  const [lastReceived, setLastReceived] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<PrintJob | null>(null);
  const [strip, setStrip] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const readyResolve = useRef<(() => void) | null>(null);

  const refreshQueue = useCallback(async () => {
    try {
      const [jobs, last, failed] = await Promise.all([
        fetchPendingJobs(),
        fetchLastJob(),
        fetchLastFailedJob(),
      ]);
      setPending(jobs.length);
      setLastReceived(last?.created_at ?? null);
      setLastFailed(failed);
      return jobs;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao consultar a fila.");
      return [];
    }
  }, []);

  /** Aguarda a imagem decodificada dentro da área de impressão. */
  const waitForReady = () =>
    new Promise<void>((resolve) => {
      readyResolve.current = resolve;
    });

  const waitForAfterPrint = () =>
    new Promise<void>((resolve) => {
      const done = () => {
        window.removeEventListener("afterprint", done);
        clearTimeout(fallback);
        resolve();
      };
      const fallback = setTimeout(done, 60000);
      window.addEventListener("afterprint", done);
    });

  /** Processa um trabalho por vez; nunca dois window.print() para o mesmo ID. */
  const pump = useCallback(async () => {
    if (!activeRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      for (;;) {
        if (!activeRef.current) break;
        const jobs = await refreshQueue();
        const next = jobs[0];
        if (!next) {
          setStage("aguardando");
          break;
        }

        setStage("preparando");
        const claimed = await claimJob(next);
        if (!claimed) continue; // outro cliente assumiu

        try {
          const url = await signedImageUrl(claimed.image_path);
          setStrip(url);
          await waitForReady();
          setStage("imprimindo");
          const after = waitForAfterPrint();
          window.print();
          await after;
          await markSent(claimed.id);
          setError(null);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Falha ao imprimir.";
          await markFailed(claimed.id, message);
          setError(message);
          setStage("erro");
        } finally {
          setStrip(null);
          readyResolve.current = null;
        }

        await new Promise((res) => setTimeout(res, 1500));
      }
    } finally {
      busyRef.current = false;
      await refreshQueue();
    }
  }, [refreshQueue]);

  // realtime apenas acorda o processador; a tabela continua sendo a fila oficial
  useEffect(() => {
    const channel = supabase
      .channel("print-station")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "print_jobs" },
        () => void pump(),
      )
      .subscribe((status) => {
        const ok = status === "SUBSCRIBED";
        setConnected(ok);
        if (ok) void pump();
      });

    void refreshQueue();
    const recovery = setInterval(() => void pump(), 15000);

    return () => {
      clearInterval(recovery);
      supabase.removeChannel(channel);
    };
  }, [pump, refreshQueue]);

  const activate = useCallback(() => {
    activeRef.current = true;
    setActive(true);
    setStage("aguardando");
    void pump();
  }, [pump]);

  return (
    <main className="min-h-screen bg-brasil-blue-dark px-10 py-14 text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-5xl font-black uppercase leading-none">
            Estação de impressão
          </h1>
          <p className="text-xl font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {STATION_ID}
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-6">
          <Info label="Conexão" value={connected ? "Conectada" : "Reconectando"} />
          <Info label="Estado" value={stageLabel[active ? stage : "offline"]} />
          <Info label="Trabalhos pendentes" value={String(pending)} />
          <Info
            label="Último trabalho recebido"
            value={lastReceived ? new Date(lastReceived).toLocaleString("pt-BR") : "—"}
          />
        </dl>

        {error && (
          <p className="rounded-2xl bg-destructive/20 px-6 py-4 text-lg font-semibold">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-4">
          <button
            onClick={activate}
            disabled={active}
            className="font-display rounded-full bg-primary px-10 py-6 text-3xl font-black uppercase text-primary-foreground disabled:opacity-60"
          >
            {active ? "Estação ativa" : "Ativar estação"}
          </button>
          <button
            onClick={() => void refreshQueue()}
            className="font-display rounded-full border-4 border-border bg-secondary px-10 py-6 text-2xl font-black uppercase text-secondary-foreground"
          >
            Recarregar fila
          </button>
          {lastFailed && (
            <button
              onClick={() => {
                void requeueJob(lastFailed.id).then(() => pump());
              }}
              className="font-display rounded-full border-4 border-brasil-yellow px-10 py-6 text-2xl font-black uppercase"
            >
              Reimprimir último trabalho com falha
            </button>
          )}
        </div>
      </div>

      {strip && <PrintArea document={strip} onReady={() => readyResolve.current?.()} />}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/60 px-6 py-5">
      <dt className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-bold">{value}</dd>
    </div>
  );
}
