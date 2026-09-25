import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Share2, Trash2 } from "lucide-react";
import logoAsset from "@/assets/logo-brasil.png.asset.json";
import ballAsset from "@/assets/ball.png.asset.json";
import { deletePhotoShare, getPhotoShareStatus, signPhotoShareStory } from "@/lib/photoShare.functions";
import { TOKEN_PATTERN } from "@/lib/shareConfig";

const title = "Tu recuerdo de Brasil está listo · Visit Brasil";
const description = "Comparte tu foto de la experiencia EMBRATUR en la FIT y lleva Brasil contigo.";

export const Route = createFileRoute("/mi-foto/$token")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: MiFoto,
});

const FILE_NAME = "mi-pasaporte-brasil-story.png";

function saveBlob(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

function Stamp() {
  return (
    <div className="-rotate-12 rounded-2xl bg-brasil-blue-dark p-1.5 shadow-[var(--shadow-touch)]">
      <div className="font-display rounded-xl border-4 border-brasil-green-light px-5 py-2 text-xl font-black uppercase tracking-[0.2em] text-brasil-green-light">
        Brasil 2027
      </div>
    </div>
  );
}

function StateBlock({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-4 py-10" role="status">
      <h1 className="font-display text-3xl font-black uppercase leading-tight">{title}</h1>
      {text && <p className="text-base text-muted-foreground">{text}</p>}
      {action}
    </section>
  );
}

function MiFoto() {
  const { token } = Route.useParams();
  const valid = TOKEN_PATTERN.test(token);
  const getStatus = useServerFn(getPhotoShareStatus);
  const signStory = useServerFn(signPhotoShareStory);
  const removeShare = useServerFn(deletePhotoShare);
  const [busy, setBusy] = useState<"share" | "delete" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const query = useQuery({
    queryKey: ["photo-share-status", token],
    queryFn: () => getStatus({ data: { token } }),
    enabled: valid && !deleted,
    staleTime: 60_000,
    retry: 1,
  });

  const shareFile = async () => {
    if (busy) return;
    setBusy("share");
    setNotice(null);
    try {
      const signed = await signStory({ data: { token } });
      if (!signed.ok) {
        await query.refetch();
        return;
      }
      const res = await fetch(signed.url);
      if (!res.ok) throw new Error("download");
      const blob = await res.blob();
      const file = new File([blob], FILE_NAME, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch {
          /* cancelado pelo visitante — sem erro */
        }
      } else {
        saveBlob(blob, FILE_NAME);
        setNotice("Imagen guardada. Ahora puedes compartirla desde Instagram.");
      }
    } catch {
      setNotice("No pudimos preparar tu foto. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    setBusy("delete");
    try {
      const res = await removeShare({ data: { token } });
      if (res.ok) {
        setDeleted(true);
        setConfirming(false);
      } else setNotice("No pudimos eliminar tu foto. Intenta de nuevo.");
    } catch {
      setNotice("No pudimos eliminar tu foto. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const status = query.data?.status;

  let content: React.ReactNode;
  if (deleted || status === "deleted") {
    content = <StateBlock title="Esta foto fue eliminada" />;
  } else if (!valid || status === "expired") {
    content = (
      <StateBlock
        title="Este enlace ya expiró"
        text="Por seguridad, la foto estuvo disponible durante 24 horas."
      />
    );
  } else if (query.isError) {
    content = (
      <StateBlock
        title="No pudimos preparar tu foto"
        action={
          <button
            onClick={() => query.refetch()}
            className="font-display rounded-full bg-brasil-yellow px-8 py-4 text-base font-black uppercase tracking-wider text-brasil-blue-dark"
          >
            Intentar de nuevo
          </button>
        }
      />
    );
  } else if (status !== "active") {
    content = (
      <div className="flex flex-col items-center py-20" role="status" aria-live="polite">
        <Loader2 className="h-10 w-10 animate-spin text-brasil-yellow" />
      </div>
    );
  } else {
    content = (
      <>
        <Stamp />
        <header className="flex flex-col gap-4">
          <h1 className="font-display text-3xl font-black uppercase leading-tight">
            ¡Gracias por visitar el stand de EMBRATUR!
          </h1>
          <p className="font-display text-xl font-black uppercase text-brasil-yellow">
            Tu recuerdo de Brasil está listo.
          </p>
          <p className="text-base font-medium text-muted-foreground">
            Comparte tu foto y lleva esta experiencia contigo.
          </p>
        </header>

        <button
          onClick={shareFile}
          disabled={!!busy}
          aria-busy={busy === "share"}
          className="font-display flex w-full items-center justify-center gap-3 rounded-full bg-brasil-yellow py-6 text-xl font-black uppercase tracking-wider text-brasil-blue-dark shadow-[var(--shadow-touch)] disabled:opacity-80"
        >
          {busy === "share" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Share2 className="h-6 w-6" />}
          {busy === "share" ? "Preparando…" : "Compartir"}
        </button>

        {notice && (
          <p role="status" className="text-sm font-semibold text-brasil-yellow">
            {notice}
          </p>
        )}

        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brasil-green-light">
          Disponible durante 24 horas.
        </p>

        {confirming ? (
          <div className="flex w-full flex-col gap-3 rounded-2xl border-2 border-border bg-secondary p-4" role="alertdialog" aria-label="Confirmar eliminación">
            <p className="text-sm font-semibold">¿Eliminar tu foto ahora? Esta acción no se puede deshacer.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirming(false)} disabled={busy === "delete"} className="rounded-full border-2 border-border py-3 text-sm font-bold uppercase">
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={busy === "delete"} className="rounded-full bg-destructive py-3 text-sm font-bold uppercase text-destructive-foreground">
                {busy === "delete" ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 underline underline-offset-4"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar mi foto ahora
          </button>
        )}
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-brasil-blue-dark text-foreground select-text"
      style={{ background: "var(--gradient-kiosk)" }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-[18%] h-72 w-72 rounded-full bg-brasil-cyan/25 blur-3xl" />
        <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-brasil-green/25 blur-3xl" />
        <img src={ballAsset.url} alt="" className="absolute -right-20 bottom-10 w-56 opacity-10" />
        <img src={ballAsset.url} alt="" className="absolute -left-16 top-10 w-40 opacity-10" />
      </div>
      <div className="gradient-brasil-bar fixed inset-x-0 top-0 z-10 h-1.5" />
      <div className="gradient-brasil-bar fixed inset-x-0 bottom-0 z-10 h-1.5" />

      <main
        className="relative mx-auto flex min-h-full w-full max-w-md flex-col items-center gap-7 px-6 text-center"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 2.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)",
        }}
      >
        <img src={logoAsset.url} alt="Brasil" className="h-auto w-44 max-w-full object-contain" />
        {content}
        <p className="mt-auto pt-6 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Visit Brasil · FIT 2026
        </p>
      </main>
    </div>
  );
}
