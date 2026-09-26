import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { originCountries, originCountryName, originFlagUrl } from "@/lib/originCountries";

type Props = {
  value: string | null;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (code: string) => void;
  onClose?: () => void;
};

function fold(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function Flag({ code }: { code: string }) {
  return (
    <img
      src={originFlagUrl(code)}
      alt=""
      aria-hidden
      draggable={false}
      className="aspect-[4/3] w-14 shrink-0 rounded-[0.4rem] object-contain"
    />
  );
}

/** Seletor pesquisável de país de origem: bandeira + nome em espanhol, sem DDI. */
export function OriginCountrySelect({ value, disabled, invalid, onChange, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const list = useMemo(() => originCountries(), []);
  const searchRef = useRef<HTMLInputElement>(null);
  const name = value ? originCountryName(value) : null;

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? list.filter((c) => fold(c.name).includes(q)) : list;
  }, [list, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
    onClose?.();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={name ? `País de origen: ${name}` : "País de origen: selecciona tu país"}
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-between gap-5 rounded-[1.75rem] border-4 bg-card px-7 py-5 text-left text-card-foreground outline-none transition-colors focus:border-brasil-yellow focus:ring-4 focus:ring-brasil-yellow/40 disabled:opacity-60 ${
          invalid ? "border-brasil-red" : "border-transparent"
        }`}
      >
        <span className="flex min-w-0 items-center gap-5">
          {value && <Flag code={value} />}
          <span
            className={`truncate text-[2.25rem] font-semibold ${name ? "" : "text-card-foreground/40"}`}
          >
            {name ?? "Selecciona tu país"}
          </span>
        </span>
        <ChevronDown className="h-10 w-10 shrink-0 opacity-60" strokeWidth={3} />
      </button>

      {open && (
        <div
          className="animate-journey-in absolute inset-0 z-30 flex items-start justify-center bg-brasil-blue-dark/95 px-14 pt-24 pb-20 backdrop-blur-sm"
          onPointerDown={(e) => e.target === e.currentTarget && close()}
        >
          <div className="flex max-h-[70%] w-full max-w-[60rem] flex-col gap-6 rounded-[2.5rem] bg-card p-10 text-card-foreground">
            <div className="flex items-center justify-between gap-6">
              <h2 className="font-display text-[2.75rem] font-black uppercase leading-none">
                País de origen
              </h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={close}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/20 active:scale-95"
              >
                <X className="h-10 w-10" strokeWidth={3} />
              </button>
            </div>
            <label className="flex items-center gap-4 rounded-[1.5rem] border-4 border-border px-6 py-4 focus-within:border-brasil-yellow">
              <Search className="h-9 w-9 opacity-60" strokeWidth={3} />
              <input
                ref={searchRef}
                type="search"
                value={query}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                placeholder="Buscar país"
                aria-label="Buscar país"
                onChange={(e) => setQuery(e.target.value.slice(0, 40))}
                className="w-full bg-transparent text-[2.1rem] font-semibold outline-none placeholder:text-card-foreground/40"
              />
            </label>
            <ul
              role="listbox"
              aria-label="País de origen"
              className="flex-1 overflow-y-auto overscroll-contain"
            >
              {filtered.map((c) => {
                const active = c.code === value;
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(c.code);
                        close();
                      }}
                      className={`flex w-full items-center gap-5 rounded-[1.25rem] px-5 py-5 text-left transition-colors ${
                        active ? "bg-brasil-yellow/25 ring-2 ring-brasil-yellow" : "active:bg-secondary/30"
                      }`}
                    >
                      <Flag code={c.code} />
                      <span className="text-[2.1rem] font-semibold">{c.name}</span>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-5 py-8 text-center text-[1.9rem] opacity-60">Sin resultados.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
