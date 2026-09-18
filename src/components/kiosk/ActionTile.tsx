import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: ReactNode;
  /** amarelo = ação principal; ghost = translúcida com contorno claro */
  variant?: "primary" | "ghost";
  /** ação já concluída: contorno verde, sem destaque */
  completed?: boolean;
};

/**
 * Ação de totem com ícone vetorial e legenda curta. Área de toque sempre
 * muito acima de 88x88 px, mesmo quando o ícone é pequeno.
 */
export function ActionTile({
  icon,
  label,
  variant = "primary",
  completed = false,
  className = "",
  ...props
}: Props) {
  const base =
    "font-display flex min-h-[11rem] min-w-[11rem] flex-1 flex-col items-center justify-center gap-4 rounded-[2.25rem] px-10 py-8 text-[2.25rem] font-black uppercase tracking-[0.08em] transition-transform duration-200 active:scale-[0.97] disabled:active:scale-100 disabled:opacity-60";
  const styles = completed
    ? "border-4 border-brasil-green-light bg-secondary/60 text-brasil-green-light"
    : variant === "primary"
      ? "bg-primary text-primary-foreground shadow-[var(--shadow-touch)]"
      : "border-4 border-border bg-secondary/60 text-secondary-foreground";

  return (
    <button {...props} className={`${base} ${styles} ${className}`}>
      <span className="flex items-center justify-center">{icon}</span>
      <span className="whitespace-nowrap text-center leading-none">{label}</span>
    </button>
  );
}
