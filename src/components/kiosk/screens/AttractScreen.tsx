import { BrasilLogo } from "../BrasilLogo";
import { TouchButton } from "../TouchButton";

export function AttractScreen({ onStart }: { onStart: () => void }) {
  return (
    <>
      <BrasilLogo className="animate-fade-up w-[24rem]" />

      <div className="animate-fade-up flex flex-col items-center gap-12 text-center">
        <h1 className="font-display text-balance-kiosk max-w-[52rem] text-[5.75rem] font-black uppercase leading-[0.95] tracking-tight">
          Sua viagem para o Brasil começa aqui.
        </h1>
        <p className="max-w-[46rem] text-4xl font-medium leading-snug text-muted-foreground">
          Tire sua foto e prepare-se para viver o Brasil em 2027.
        </p>
      </div>

      <div className="relative w-full max-w-[52rem]">
        <div className="animate-pulse-ring absolute inset-0 rounded-full bg-primary/40 blur-2xl" />
        <TouchButton onClick={onStart} className="relative py-16 text-[3.25rem]">
          Toque para iniciar
        </TouchButton>
      </div>
    </>
  );
}
