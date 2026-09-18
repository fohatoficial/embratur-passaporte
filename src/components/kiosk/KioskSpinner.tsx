/**
 * Spinner discreto, único para o totem e a estação de impressão.
 * Cores do KV EMBRATUR/FIT. Respeita prefers-reduced-motion.
 */
export function KioskSpinner({ size = 96 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className="inline-block shrink-0 rounded-full border-transparent motion-safe:animate-spin"
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(3, Math.round(size / 12)),
        borderStyle: "solid",
        borderTopColor: "var(--brasil-yellow, #FFD100)",
        borderRightColor: "var(--brasil-green, #00A859)",
        borderBottomColor: "var(--brasil-cyan, #00B7E4)",
        borderLeftColor: "transparent",
        animationDuration: "1.1s",
      }}
    />
  );
}
