import { useCallback, useState } from "react";
import { Check, Camera, RotateCcw } from "lucide-react";
import { BrasilLogo } from "../BrasilLogo";
import { ActionTile } from "../ActionTile";
import { KioskSpinner } from "../KioskSpinner";

type Props = {
  photo: string;
  onConfirm: () => void;
  onRetake: () => void;
};

export function ReviewScreen({ photo, onConfirm, onRetake }: Props) {
  const [locked, setLocked] = useState(false);

  const confirm = useCallback(() => {
    if (locked) return;
    setLocked(true);
    onConfirm();
  }, [locked, onConfirm]);

  return (
    <>
      <BrasilLogo className="w-[16rem]" />

      <div className="animate-fade-up flex w-full flex-col items-center gap-12">
        <h1 className="font-display text-[4rem] font-black uppercase leading-none">
          Tu foto está lista
        </h1>

        <div className="rounded-[1.5rem] bg-card p-5 shadow-[var(--shadow-touch)]">
          <div className="aspect-square w-[42rem] overflow-hidden bg-card">
            <img
              src={photo}
              alt="Tu foto para el pasaporte"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="flex w-full max-w-[52rem] items-stretch gap-8">
          <ActionTile
            onClick={confirm}
            disabled={locked}
            icon={locked ? <KioskSpinner size={56} /> : <Check className="h-20 w-20" strokeWidth={3} />}
            label={locked ? "Preparando…" : "Usar foto"}
          />
          <ActionTile
            variant="ghost"
            onClick={onRetake}
            disabled={locked}
            icon={
              <span className="relative block">
                <Camera className="h-16 w-16" strokeWidth={2.5} />
                <RotateCcw
                  className="absolute -bottom-2 -right-3 h-9 w-9 rounded-full bg-brasil-blue-dark p-1"
                  strokeWidth={3}
                />
              </span>
            }
            label="Repetir"
          />
        </div>
      </div>

      <p className="text-2xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Brasil 2027
      </p>
    </>
  );
}
