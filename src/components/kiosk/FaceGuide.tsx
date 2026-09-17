/**
 * Head-and-shoulders positioning guide — organic silhouette, not a plain
 * rectangular frame.
 */
export function FaceGuide({ intense = false }: { intense?: boolean }) {
  return (
    <svg
      viewBox="0 0 400 560"
      className={`h-full w-full ${intense ? "opacity-100" : "opacity-80"}`}
      aria-hidden
      fill="none"
    >
      <defs>
        <linearGradient id="guideStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brasil-yellow)" />
          <stop offset="55%" stopColor="var(--brasil-green-light)" />
          <stop offset="100%" stopColor="var(--brasil-cyan)" />
        </linearGradient>
      </defs>

      {/* head */}
      <ellipse
        cx="200"
        cy="200"
        rx="118"
        ry="146"
        stroke="url(#guideStroke)"
        strokeWidth={intense ? 10 : 6}
        strokeDasharray="26 22"
      />
      {/* shoulders */}
      <path
        d="M40 545c14-108 78-160 160-160s146 52 160 160"
        stroke="url(#guideStroke)"
        strokeWidth={intense ? 10 : 6}
        strokeLinecap="round"
        strokeDasharray="26 22"
      />
      {/* eye line */}
      <path
        d="M120 196h50M230 196h50"
        stroke="var(--brasil-yellow)"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.7}
      />
    </svg>
  );
}
