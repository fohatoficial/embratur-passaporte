import { useEffect } from "react";
import { BrasilLogo } from "../BrasilLogo";

export function DoneScreen({ onReset }: { onReset: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onReset, 8000);
    return () => clearTimeout(timer);
  }, [onReset]);

  return (
    <>
      <BrasilLogo className="animate-fade-up w-[22rem]" />

      <div className="animate-fade-up flex flex-col items-center gap-12 text-center">
        <div className="relative">
          <span className="font-display block text-[12rem] font-black uppercase leading-none">
            Pronto!
          </span>
          <span
            className="animate-stamp font-display absolute -right-16 -top-10 rounded-[1.5rem] border-8 border-brasil-green-light px-8 py-4 text-4xl font-black uppercase tracking-widest text-brasil-green-light"
            style={{ animationDelay: "0.3s" }}
          >
            Brasil 2027
          </span>
        </div>

        <p className="max-w-[44rem] text-5xl font-semibold leading-tight">
          Sua foto para o passaporte está pronta.
        </p>
        <p className="max-w-[44rem] text-4xl font-medium text-muted-foreground">
          Prepare-se para viver o Brasil em 2027.
        </p>
      </div>

      <div className="gradient-brasil-bar h-4 w-[40rem] rounded-full" />
    </>
  );
}
