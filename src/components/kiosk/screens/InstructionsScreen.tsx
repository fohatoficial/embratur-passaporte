import { useEffect } from "react";
import { BrasilLogo } from "../BrasilLogo";
import { FaceGuide } from "../FaceGuide";

const steps = [
  "Olhe diretamente para a câmera.",
  "Posicione seu rosto dentro da marcação.",
  "Retire óculos escuros, boné ou objetos que cubram o rosto.",
  "Mantenha uma expressão natural.",
];

export function InstructionsScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <>
      <BrasilLogo className="w-[18rem]" />

      <div className="animate-fade-up flex w-full flex-col items-center gap-14">
        <h1 className="font-display text-center text-[5.5rem] font-black uppercase leading-none">
          Prepare-se para a foto
        </h1>

        <div className="flex w-full items-center gap-14">
          <div className="h-[30rem] w-[22rem] shrink-0">
            <FaceGuide />
          </div>

          <ol className="flex flex-col gap-8">
            {steps.map((step, i) => (
              <li key={step} className="flex items-start gap-6">
                <span className="font-display flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-4xl font-black text-primary-foreground">
                  {i + 1}
                </span>
                <span className="pt-3 text-4xl font-medium leading-tight">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex items-center gap-6 rounded-full border-4 border-border bg-secondary px-14 py-8">
        <span className="h-6 w-6 animate-pulse rounded-full bg-brasil-green-light" />
        <p className="text-4xl font-semibold uppercase tracking-wide">
          A câmera abrirá automaticamente
        </p>
      </div>
    </>
  );
}
