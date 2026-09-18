import { useState } from "react";
import { Camera, Copy, PlayCircle, Stamp, X } from "lucide-react";
import { BrasilLogo } from "../BrasilLogo";
import { ActionTile } from "../ActionTile";

const howItWorks = [
  { icon: Camera, text: "Toma tu foto." },
  { icon: Copy, text: "Recibe tres copias impresas." },
  { icon: Stamp, text: "Pega una en tu pasaporte." },
];

export function AttractScreen({ onStart }: { onStart: () => void }) {
  const [showHow, setShowHow] = useState(false);

  return (
    <>
      <BrasilLogo className="animate-fade-up w-[22rem]" />

      <div className="animate-fade-up flex w-full max-w-[56rem] flex-col items-center gap-10 text-center">
        <h1 className="font-display text-balance-kiosk text-[5.25rem] font-black uppercase leading-[0.95] tracking-tight">
          Tu viaje por Brasil empieza aquí.
        </h1>
        <p className="max-w-[46rem] text-[2.25rem] font-medium leading-snug text-muted-foreground">
          Toma tu foto, completa tu pasaporte y descubre las ciudades sede del Mundial Femenino
          2027.
        </p>

        <div className="mt-4 flex w-full flex-col gap-6">
          <ActionTile
            onClick={onStart}
            icon={<Camera className="h-20 w-20" strokeWidth={2.5} />}
            label="Comenzar"
          />
          <ActionTile
            variant="ghost"
            onClick={() => setShowHow(true)}
            icon={<PlayCircle className="h-16 w-16" strokeWidth={2.5} />}
            label="Cómo funciona"
          />
        </div>
      </div>

      <p className="text-2xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Brasil 2027
      </p>

      {showHow && (
        <div className="animate-journey-in absolute inset-0 z-10 flex flex-col items-center justify-center gap-16 bg-brasil-blue-dark/95 px-16 py-24 backdrop-blur-sm">
          <h2 className="font-display text-center text-[3.75rem] font-black uppercase leading-none">
            Cómo funciona
          </h2>

          <ol className="flex w-full max-w-[46rem] flex-col gap-10">
            {howItWorks.map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex items-center gap-8">
                <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.75rem] bg-secondary">
                  <Icon className="h-14 w-14" strokeWidth={2.5} />
                </span>
                <span className="text-[2.5rem] font-semibold leading-tight">
                  <span className="font-display mr-4 text-brasil-yellow">{i + 1}</span>
                  {text}
                </span>
              </li>
            ))}
          </ol>

          <ActionTile
            variant="ghost"
            className="w-[34rem] flex-none"
            onClick={() => setShowHow(false)}
            icon={<X className="h-16 w-16" strokeWidth={3} />}
            label="Cerrar"
          />
        </div>
      )}
    </>
  );
}
