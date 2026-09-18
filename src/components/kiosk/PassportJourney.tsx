import { useEffect, useState } from "react";

/**
 * Sequência animada de pictogramas autorais usada durante o processamento e
 * o envio para impressão: bola entra rolando, jogadora chuta, a bola percorre
 * um arco nas cores do Brasil, surge o Cristo Redentor e um carimbo finaliza.
 *
 * A sequência recomeça de forma contínua enquanto a etapa real continuar em
 * andamento. Nada aqui interfere no processamento da foto.
 */

const BEATS = 5;
const BEAT_MS = 1500;

export function PassportJourney({ size = 420 }: { size?: number }) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setBeat((b) => (b + 1) % BEATS), BEAT_MS);
    return () => clearInterval(tick);
  }, []);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full bg-secondary/40" />
      <div className="animate-pulse-ring absolute inset-6 rounded-full bg-primary/15 blur-2xl" />
      <div key={beat} className="animate-journey-in relative h-[78%] w-[78%]">
        <Scene beat={beat} />
      </div>
    </div>
  );
}

function Scene({ beat }: { beat: number }) {
  if (beat === 0) return <BallScene />;
  if (beat === 1) return <KickScene />;
  if (beat === 2) return <ArcScene />;
  if (beat === 3) return <CityScene />;
  return <StampScene />;
}

const stroke = {
  fill: "none",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full">
      {children}
    </svg>
  );
}

function Ball({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--card)" />
      <circle cx={x} cy={y} r={r} stroke="var(--brasil-blue-dark)" strokeWidth={5} {...stroke} />
      <path
        d={`M${x - r * 0.45} ${y - r * 0.3}L${x} ${y - r * 0.62}L${x + r * 0.45} ${y - r * 0.3}L${x + r * 0.28} ${y + r * 0.3}L${x - r * 0.28} ${y + r * 0.3}Z`}
        fill="var(--brasil-blue-dark)"
      />
    </g>
  );
}

function BallScene() {
  return (
    <Svg>
      <g className="motion-safe:animate-journey-roll">
        <Ball x={120} y={150} r={44} />
      </g>
      <path
        d="M30 206h180"
        stroke="var(--brasil-green-light)"
        strokeWidth={8}
        opacity={0.8}
        {...stroke}
      />
    </Svg>
  );
}

function KickScene() {
  return (
    <Svg>
      {/* jogadora estilizada */}
      <g stroke="var(--brasil-yellow)" strokeWidth={9} {...stroke}>
        <circle cx={96} cy={52} r={20} />
        <path d="M96 72v62" />
        <path d="M96 88l-34 22M96 88l30 14" />
        <path d="M96 134l-26 62" />
        <path className="motion-safe:animate-journey-kick" d="M96 134l52 34" />
      </g>
      <g className="motion-safe:animate-journey-kicked">
        <Ball x={178} y={186} r={30} />
      </g>
    </Svg>
  );
}

function ArcScene() {
  return (
    <Svg>
      <defs>
        <linearGradient id="journeyArc" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--brasil-green-light)" />
          <stop offset="40%" stopColor="var(--brasil-yellow)" />
          <stop offset="75%" stopColor="var(--brasil-orange)" />
          <stop offset="100%" stopColor="var(--brasil-cyan)" />
        </linearGradient>
      </defs>
      <path
        className="motion-safe:animate-journey-draw"
        d="M26 200C60 66 186 54 214 178"
        stroke="url(#journeyArc)"
        strokeWidth={14}
        strokeDasharray="420"
        {...stroke}
      />
      <g className="motion-safe:animate-journey-arc">
        <Ball x={214} y={178} r={26} />
      </g>
    </Svg>
  );
}

function CityScene() {
  return (
    <Svg>
      <g stroke="var(--brasil-cyan)" strokeWidth={9} {...stroke}>
        {/* morro */}
        <path d="M22 210c26-52 58-74 98-74s72 22 98 74" opacity={0.55} />
      </g>
      <g stroke="var(--brasil-yellow)" strokeWidth={10} {...stroke}>
        {/* Cristo Redentor estilizado */}
        <circle cx={120} cy={48} r={14} />
        <path d="M120 62v82" />
        <path d="M66 86h108" />
        <path d="M104 144h32" />
      </g>
    </Svg>
  );
}

function StampScene() {
  return (
    <Svg>
      <g className="motion-safe:animate-journey-stamp">
        <rect
          x={30}
          y={62}
          width={180}
          height={116}
          rx={22}
          stroke="var(--brasil-green-light)"
          strokeWidth={10}
          {...stroke}
        />
        <path
          d="M64 120l26 26 46-52"
          stroke="var(--brasil-green-light)"
          strokeWidth={12}
          {...stroke}
        />
        <path d="M150 104h34M150 134h22" stroke="var(--brasil-yellow)" strokeWidth={9} {...stroke} />
      </g>
    </Svg>
  );
}
