import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Printer, RefreshCw } from "lucide-react";
import { PrintArea } from "@/components/kiosk/PrintArea";
import { KioskSpinner } from "@/components/kiosk/KioskSpinner";
import { buildTestStrip } from "@/lib/buildTestStrip";
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

type Stage = "conectando" | "reconectando" | "aguardando" | "processando" | "offline";

const stageLabel: Record<Stage, string> = {
  conectando: "Conectando à estação",
  reconectando: "Reconectando…",
  aguardando: "Online — aguardando trabalhos",
  processando: "Processando impressão",
  offline: "Offline — tentar novamente",
};

const STATION_STORAGE_KEY = "totem-print-station-id";
const RECONNECT_DELAYS = [2000, 4000, 8000, 15000, 30000];
/** só depois disso o botão manual aparece */
const MANUAL_RECOVERY_AFTER_MS = 15000;

/** Reutiliza o identificador da estação salvo no navegador. */
function resolveStationId(): string {
  if (typeof window === "undefined") return STATION_ID;
  try {
    const saved = window.localStorage.getItem(STATION_STORAGE_KEY);
    if (saved) return saved;
    window.localStorage.setItem(STATION_STORAGE_KEY, STATION_ID);
  } catch {
    /* armazenamento indisponível: segue com o padrão */
  }
  return STATION_ID;
}

function PrintStation() {
  const [stage, setStage] = useState<Stage>("conectando");
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(0);
  const [lastReceived, setLastReceived] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<PrintJob | null>(null);
  const [strip, setStrip] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stationId, setStationId] = useState(STATION_ID);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const busyRef = useRef(false);
  const readyResolve = useRef<(() => void) | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    setStationId(resolveStationId());
  }, []);

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
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      for (;;) {
        if (!mountedRef.current) break;
        const jobs = await refreshQueue();
        const next = jobs[0];
        if (!next) {
          setStage((current) => (current === "offline" ? current : "aguardando"));
          break;
        }

        setStage("processando");
        const claimed = await claimJob(next);
        if (!claimed) continue; // outro cliente assumiu

        try {
          const url = await signedImageUrl(claimed.image_path);
          setStrip(url);
          await waitForReady();
          const after = waitForAfterPrint();
          window.print();
          await after;
          await markSent(claimed.id);
          setError(null);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Falha ao imprimir.";
          await markFailed(claimed.id, message);
          setError(message);
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

  /** Impressão de teste local: não cria trabalho na fila do totem. */
  const runTestPrint = useCallback(async () => {
    if (busyRef.current || testing) return;
    busyRef.current = true;
    setTesting(true);
    setTestMessage(null);
    try {
      setStrip(buildTestStrip());
      await waitForReady();
      const after = waitForAfterPrint();
      window.print();
      await after;
      setTestMessage("Teste enviado para impressão");
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : "Falha ao imprimir o teste.");
    } finally {
      setStrip(null);
      readyResolve.current = null;
      setTesting(false);
      busyRef.current = false;
    }
  }, [testing]);


  const teardownChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  /** Uma única inscrição por página; reconexão com intervalos progressivos. */
  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    teardownChannel();
    const reconnecting = attemptRef.current > 0;
    setStage((current) =>
      current === "processando" ? current : reconnecting ? "reconectando" : "conectando",
    );

    // botão manual só depois de falhas contínuas por 15s
    if (!manualTimer.current) {
      manualTimer.current = setTimeout(() => {
        manualTimer.current = null;
        if (!mountedRef.current) return;
        setShowManual(true);
        setStage((current) => (current === "processando" ? current : "offline"));
      }, MANUAL_RECOVERY_AFTER_MS);
    }

    const scheduleReconnect = () => {
      if (!mountedRef.current || reconnectTimer.current) return;
      const delay =
        RECONNECT_DELAYS[Math.min(attemptRef.current, RECONNECT_DELAYS.length - 1)] ?? 30000;
      attemptRef.current += 1;
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        connect();
      }, delay);
    };

    const channel = supabase
      .channel(`print-station-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "print_jobs" },
        () => void pump(),
      )
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (status === "SUBSCRIBED") {
          attemptRef.current = 0;
          if (manualTimer.current) {
            clearTimeout(manualTimer.current);
            manualTimer.current = null;
          }
          setShowManual(false);
          setConnected(true);
          setError(null);
          setStage((current) => (current === "processando" ? current : "aguardando"));
          void pump();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
          setStage((current) =>
            current === "processando" || current === "offline" ? current : "reconectando",
          );
          scheduleReconnect();
        }
      });

    channelRef.current = channel;
  }, [pump, teardownChannel]);

  // ativação automática ao carregar a página
  useEffect(() => {
    mountedRef.current = true;
    void refreshQueue();
    connect();
    const recovery = setInterval(() => void pump(), 15000);

    return () => {
      mountedRef.current = false;
      clearInterval(recovery);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (manualTimer.current) clearTimeout(manualTimer.current);
      teardownChannel();
    };
  }, [connect, pump, refreshQueue, teardownChannel]);

  const connecting = stage === "conectando" || stage === "reconectando";

  return (
    <main className="min-h-screen bg-brasil-blue-dark px-10 py-14 text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-5xl font-black uppercase leading-none">
            Estação de impressão
          </h1>
          <p className="text-xl font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {stationId}
          </p>
        </header>

        {/* indicador de conexão: layout estável, só o conteúdo central muda */}
        <div className="flex min-h-[9rem] flex-col items-center justify-center gap-5 rounded-3xl bg-secondary/40">
          {connecting ? (
            <>
              <KioskSpinner size={64} />
              <p className="font-display text-2xl font-black uppercase tracking-[0.2em] text-muted-foreground">
                {stage === "reconectando" ? "Reconectando…" : "Conectando à estação"}
              </p>
            </>
          ) : (
            <p className="font-display text-3xl font-black uppercase leading-tight">
              {stageLabel[stage]}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-6">
          <Info label="Conexão" value={connected ? "Conectada" : stageLabel[stage]} />
          <Info label="Estado" value={stageLabel[stage]} />
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
          {showManual && (
            <button
              onClick={() => {
                attemptRef.current = 0;
                setShowManual(false);
                connect();
              }}
              className="font-display flex items-center justify-center gap-4 rounded-full bg-primary px-10 py-6 text-3xl font-black uppercase text-primary-foreground"
            >
              <RefreshCw className="h-9 w-9" strokeWidth={2.5} />
              Tentar novamente
            </button>
          )}
          <button
            onClick={() => void refreshQueue()}
            className="font-display rounded-full border-4 border-border bg-secondary px-10 py-6 text-2xl font-black uppercase text-secondary-foreground"
          >
            Recarregar fila
          </button>
          <button
            onClick={() => void runTestPrint()}
            disabled={testing || !connected}
            className="font-display flex items-center justify-center gap-4 rounded-full border-4 border-border bg-secondary px-10 py-6 text-2xl font-black uppercase text-secondary-foreground disabled:opacity-50"
          >
            <Printer className="h-9 w-9" strokeWidth={2.5} />
            Imprimir teste
          </button>
          {testMessage && (
            <p className="text-center text-xl font-semibold text-muted-foreground">
              {testMessage}
            </p>
          )}
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
