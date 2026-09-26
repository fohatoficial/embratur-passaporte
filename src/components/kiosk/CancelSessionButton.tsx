import { X } from "lucide-react";

type Props = {
  open: boolean;
  onOpen: () => void;
  onStay: () => void;
  onExit: () => void;
};

/** X discreto no canto superior direito + confirmação compacta de saída. */
export function CancelSessionButton({ open, onOpen, onStay, onExit }: Props) {
  return (
    <>
      <button
        type="button"
        aria-label="Volver al inicio"
        onClick={onOpen}
        className="absolute right-10 top-12 z-40 flex h-24 w-24 items-center justify-center rounded-full border-4 border-border bg-brasil-blue-dark/70 text-foreground transition-transform active:scale-95"
      >
        <X className="h-12 w-12" strokeWidth={3} />
      </button>

      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          className="absolute inset-0 z-50 flex items-center justify-center bg-brasil-blue-deep/80 px-16"
        >
          <div className="flex w-full max-w-[52rem] flex-col items-center gap-10 rounded-[3rem] border-4 border-border bg-brasil-blue-dark p-16 text-center shadow-[var(--shadow-touch)]">
            <h2 id="cancel-title" className="font-display text-[3.5rem] font-black uppercase leading-none">
              ¿Volver al inicio?
            </h2>
            <p className="text-[2rem] font-medium text-muted-foreground">Se cancelará esta sesión.</p>
            <div className="flex w-full flex-col gap-6">
              <button
                type="button"
                autoFocus
                onClick={onStay}
                className="font-display w-full rounded-full bg-primary px-12 py-9 text-[2.25rem] font-black uppercase tracking-[0.08em] text-primary-foreground active:scale-[0.97]"
              >
                Seguir aquí
              </button>
              <button
                type="button"
                onClick={onExit}
                className="font-display w-full rounded-full border-4 border-border bg-secondary px-12 py-9 text-[2.25rem] font-black uppercase tracking-[0.08em] text-secondary-foreground active:scale-[0.97]"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
