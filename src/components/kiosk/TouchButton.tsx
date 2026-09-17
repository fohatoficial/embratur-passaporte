import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

/** Oversized touch target for kiosk use. */
export function TouchButton({ variant = "primary", className = "", ...props }: Props) {
  const base =
    "font-display w-full rounded-full px-16 py-12 text-5xl font-black uppercase tracking-[0.08em] transition-transform duration-200 active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100";
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground shadow-[var(--shadow-touch)]"
      : "border-4 border-border bg-secondary text-secondary-foreground";

  return <button {...props} className={`${base} ${styles} ${className}`} />;
}
