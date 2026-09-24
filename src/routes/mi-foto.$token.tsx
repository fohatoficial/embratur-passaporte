import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Loader2, Share2, Trash2 } from "lucide-react";
import logoAsset from "@/assets/logo-brasil.png.asset.json";
import ballAsset from "@/assets/ball.png.asset.json";
import { deletePhotoShare, getPhotoShare } from "@/lib/photoShare.functions";
import { TOKEN_PATTERN } from "@/lib/shareConfig";

const title = "Tu foto está lista · Brasil 2027 | Visit Brasil";
const description = "Descarga o comparte tu foto de pasaporte Brasil 2027 de la experiencia EMBRATUR en la FIT.";

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

type Format = "story" | "post";
const FILE_NAMES: Record<Format, string> = {
  story: "mi-pasaporte-brasil-story.png",
  post: "mi-pasaporte-brasil-publicacion.png",
};

async function fetchBlob(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("download");
  return res.blob();
}

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

function MiFoto() {
  const { token } = Route.useParams();
  const valid = TOKEN_PATTERN.test(token);
  const getShare = useServerFn(getPhotoShare);
  const removeShare = useServerFn(deletePhotoShare);
  const [format, setFormat] = useState<Format>("story");
  const [busy, setBusy] = useState<"download" | "share" | "delete" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const query = useQuery({
    queryKey: ["photo-share", token],
    queryFn: () => getShare({ data: { token } }),
    enabled: valid && !deleted,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const share = query.data?.ok ? query.data : null;
  const src = share ? (format === "story" ? share.storyUrl : share.postUrl) : null;

  const download = async () => {
    if (!src || busy) return;
    setBusy("download");
    setNotice(null);
    try {
      saveBlob(await fetchBlob(src), FILE_NAMES[format]);
    } catch {
      setNotice("No pudimos descargar la imagen. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const shareFile = async () => {
    if (!src || busy) return;
    setBusy("share");
    setNotice(null);
    try {
      const blob = await fetchBlob(src);
      const file = new File([blob], FILE_NAMES[format], { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Mi pasaporte Brasil" });
        } catch {
          /* cancelado pelo usuário */
        }
      } else {
        saveBlob(blob, FILE_NAMES[format]);
        setNotice("Imagen descargada. Ahora puedes compartirla desde Instagram.");
      }
    } catch {
      setNotice("No pudimos preparar la imagen. Intenta de nuevo.");
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

  const unavailable = !valid || (query.isSuccess && !query.data.ok) || query.isError;

  return (
    <div
      className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-brasil-blue-dark text-foreground select-text"
      style={{ background: "var(--gradient-kiosk)" }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-[18%] h-72 w-72 rounded-full bg-brasil-cyan/25 blur-3xl" />
        <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-brasil-green/25 blur-3xl" />
        <img src={ballAsset.url} alt="" className="absolute -right-20 bottom-10 w-56 opacity-10" />
      </div>
      <div className="gradient-brasil-bar fixed inset-x-0 top-0 z-10 h-1.5" />

      <main
        className="relative mx-auto flex min-h-full w-full max-w-md flex-col items-center gap-6 px-5 text-center"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)",
        }}
      >
        <img src={logoAsset.url} alt="Brasil" className="h-auto w-40 object-contain" />

        {deleted ? (
          <section className="flex flex-col items-center gap-3 py-16" role="status">
            <h1 className="font-display text-3xl font-black uppercase">Tu foto fue eliminada</h1>
            <p className="text-base text-muted-foreground">Los archivos ya no están disponibles.</p>
          </section>
        ) : unavailable ? (
          <section className="flex flex-col items-center gap-3 py-16" role="status">
            <h1 className="font-display text-3xl font-black uppercase">Enlace no disponible</h1>
            <p className="text-base text-muted-foreground">
              Este enlace expiró o ya no es válido. Las fotos están disponibles durante 24 horas.
            </p>
          </section>
        ) : !share ? (
          <div className="flex flex-col items-center gap-3 py-24" role="status" aria-live="polite">
            <Loader2 className="h-10 w-10 animate-spin text-brasil-yellow" />
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Cargando tu foto…
            </p>
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="font-display text-4xl font-black uppercase leading-none">Tu foto está lista</h1>
              <p className="text-base font-medium text-muted-foreground">
                Descárgala o compártela y lleva Brasil contigo.
              </p>
            </header>

            <div role="tablist" aria-label="Formato" className="grid w-full grid-cols-2 gap-1 rounded-full bg-secondary p-1">
              {(["story", "post"] as const).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={format === f}
                  onClick={() => setFormat(f)}
                  className={`font-display rounded-full py-3 text-sm font-black uppercase tracking-widest transition-colors ${
                    format === f ? "bg-brasil-yellow text-brasil-blue-dark" : "text-secondary-foreground"
                  }`}
                >
                  {f === "story" ? "Historia" : "Publicación"}
                </button>
              ))}
            </div>

            <img
              key={format}
              src={src ?? undefined}
              alt={format === "story" ? "Tu foto en formato historia" : "Tu foto en formato publicación"}
              className={`animate-fade-up h-auto rounded-2xl shadow-[var(--shadow-touch)] ${
                format === "story" ? "aspect-[9/16] w-[72%]" : "aspect-[4/5] w-[88%]"
              }`}
            />

            <div className="grid w-full grid-cols-2 gap-3">
              <button
                onClick={download}
                disabled={!!busy}
                className="font-display flex items-center justify-center gap-2 rounded-full border-2 border-border bg-secondary py-4 text-base font-black uppercase tracking-wider text-secondary-foreground disabled:opacity-60"
              >
                {busy === "download" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                Descargar
              </button>
              <button
                onClick={shareFile}
                disabled={!!busy}
                className="font-display flex items-center justify-center gap-2 rounded-full bg-primary py-4 text-base font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
              >
                {busy === "share" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
                Compartir
              </button>
            </div>

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
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground underline underline-offset-4"
              >
                <Trash2 className="h-4 w-4" /> Eliminar mi foto ahora
              </button>
            )}
          </>
        )}

        <p className="mt-auto pt-6 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Visit Brasil · FIT 2026
        </p>
      </main>
    </div>
  );
}
