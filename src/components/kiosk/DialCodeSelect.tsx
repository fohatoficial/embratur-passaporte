import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CountryCode } from "libphonenumber-js";
import { COUNTRIES } from "@/lib/participant";
import { FlagIcon } from "./FlagIcon";

type Props = {
  value: CountryCode;
  disabled?: boolean;
  onChange: (code: CountryCode) => void;
};

/**
 * Seletor de DDI: mostra apenas [bandeira] +DDI.
 * O nome do país existe apenas como rótulo acessível.
 */
export function DialCodeSelect({ value, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = COUNTRIES.find((c) => c.code === value) ?? COUNTRIES[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`País: ${selected.name}, código ${selected.dial}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-full min-w-[17rem] items-center justify-between gap-5 rounded-[1.75rem] border-4 border-transparent bg-card px-7 py-6 text-card-foreground outline-none transition-colors focus:border-brasil-yellow focus:ring-4 focus:ring-brasil-yellow/40 disabled:opacity-60"
      >
        <span className="flex items-center gap-5">
          <FlagIcon code={selected.code} />
          <span className="text-[2.25rem] font-bold">{selected.dial}</span>
        </span>
        <ChevronDown
          className={`h-10 w-10 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={3}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="País"
          aria-activedescendant={`dial-${selected.code}`}
          className="absolute bottom-full left-0 z-30 mb-4 max-h-[34rem] w-full min-w-[17rem] overflow-y-auto overscroll-contain rounded-[1.75rem] border-4 border-border bg-card p-3 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.45)]"
        >
          {COUNTRIES.map((c) => {
            const active = c.code === value;
            return (
              <li key={c.code}>
                <button
                  type="button"
                  role="option"
                  id={`dial-${c.code}`}
                  aria-selected={active}
                  aria-label={`${c.name}, código ${c.dial}`}
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-5 rounded-[1.25rem] px-5 py-4 text-left transition-colors ${
                    active
                      ? "bg-brasil-yellow/25 ring-2 ring-brasil-yellow"
                      : "active:bg-secondary"
                  }`}
                >
                  <FlagIcon code={c.code} />
                  <span className="text-[2.25rem] font-bold text-card-foreground">{c.dial}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
