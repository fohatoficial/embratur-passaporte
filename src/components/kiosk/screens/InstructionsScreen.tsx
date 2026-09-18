import { useEffect, useRef, useState } from "react";
import { Camera, Eye, ScanFace, Smile } from "lucide-react";
import { BrasilLogo } from "../BrasilLogo";

const STEP_MS = 2500;
const OPENING_MS = 1300;

const steps = [
  { icon: Eye, text: "Mira directamente\na la cámara.", hint: null },
  {
    icon: ScanFace,
    text: "Deja tu rostro\ncompletamente visible.",
    hint: "Quítate las gafas de sol, la gorra y cualquier objeto que lo cubra.",
  },
  { icon: Smile, text: "Relájate y mantén\nuna expresión natural.", hint: null },
];

export function InstructionsScreen({ onDone }: { onDone: () => void }) {
  /** 0..2 orientações · 3 = abrindo a câmera */
  const [index, setIndex] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // sequência única: encerra todos os temporizadores ao desmontar
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= steps.length; i += 1) {
      timers.push(setTimeout(() => setIndex(i), STEP_MS * i));
    }
    timers.push(
      setTimeout(() => doneRef.current(), STEP_MS * steps.length + OPENING_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const opening = index >= steps.length;
  const current = steps[Math.min(index, steps.length - 1)]!;
  const Icon = opening ? Camera : current.icon;

  return (
    <>
      <BrasilLogo className="w-[18rem]" />

      <div className="flex w-full flex-col items-center gap-16 text-center">
        <h1 className="font-display text-[4.5rem] font-black uppercase leading-none">
          Prepárate para la foto
        </h1>

        <div
          key={index}
          className="animate-journey-in flex min-h-[32rem] w-full flex-col items-center justify-center gap-12"
        >
          <span className="flex h-[16rem] w-[16rem] items-center justify-center rounded-full bg-secondary/60">
            <Icon className="h-32 w-32 text-brasil-yellow" strokeWidth={2.25} />
          </span>

          <p className="font-display max-w-[44rem] whitespace-pre-line text-[3.75rem] font-black uppercase leading-[1.05]">
            {opening ? "Abriendo la cámara…" : current.text}
          </p>

          {!opening && current.hint && (
            <p className="max-w-[40rem] text-[2rem] font-medium leading-snug text-muted-foreground">
              {current.hint}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-5">
        {steps.map((step, i) => (
          <span
            key={step.text}
            className={`h-4 rounded-full transition-all duration-300 ${
              i === Math.min(index, steps.length - 1)
                ? "w-16 bg-brasil-yellow"
                : "w-4 bg-secondary-foreground/35"
            }`}
          />
        ))}
      </div>
    </>
  );
}
