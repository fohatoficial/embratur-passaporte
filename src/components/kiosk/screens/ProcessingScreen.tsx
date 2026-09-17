import { useEffect } from "react";
import { BrasilLogo } from "../BrasilLogo";

export function ProcessingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <>
      <BrasilLogo className="w-[18rem]" />

      <div className="flex flex-col items-center gap-20">
        {/* passport page being processed */}
        <div className="relative h-[36rem] w-[28rem] overflow-hidden rounded-[2rem] border-8 border-border bg-brasil-blue-deep">
          <div className="absolute inset-x-10 top-12 h-[18rem] rounded-2xl bg-secondary" />
          <div className="absolute inset-x-10 bottom-24 space-y-5">
            <div className="h-5 w-3/4 rounded-full bg-muted" />
            <div className="h-5 w-1/2 rounded-full bg-muted" />
            <div className="h-5 w-2/3 rounded-full bg-muted" />
          </div>
          <div className="gradient-brasil-bar absolute inset-x-0 bottom-0 h-4" />
          <div className="animate-scan absolute inset-x-0 h-40 bg-gradient-to-b from-transparent via-brasil-cyan/50 to-transparent" />
        </div>

        <h1 className="font-display text-center text-[5.5rem] font-black uppercase leading-none">
          Preparando sua foto...
        </h1>
      </div>

      <p className="text-3xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Brasil 2027
      </p>
    </>
  );
}
