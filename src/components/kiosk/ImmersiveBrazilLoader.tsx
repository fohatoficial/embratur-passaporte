import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import {
  christTheRedeemerLine,
  footballLine,
  mountainLine,
  passportLine,
  picLine,
  playFootballLine,
  sealLine,
  sunLine,
  waveLine,
} from "./immersiveIcons";

/**
 * Carregamento temático imersivo, reutilizado nas duas etapas de processamento
 * (preparação da foto e envio para impressão).
 *
 * Duas camadas independentes:
 *  1. narrativa visual em looping (cena animada + frase em espanhol);
 *  2. estado técnico real, recebido por propriedade e exibido discretamente.
 *
 * Pictogramas: MingCute Icon (Apache-2.0) — ver `immersiveIcons.ts`.
 */

type Scene = {
  id: string;
  ms: number;
  text: string;
  render: (size: number) => React.ReactNode;
};

const box = (size: number) => ({ width: size, height: size });

const SCENES: Scene[] = [
  {
    id: "ball",
    ms: 1600,
    text: "El fútbol nos une",
    render: (s) => (
      <Icon
        icon={footballLine}
        aria-hidden
        className="animate-im-ball-in text-brasil-yellow"
        style={box(s * 0.62)}
      />
    ),
  },
  {
    id: "player",
    ms: 1700,
    text: "Ellas hacen historia",
    render: (s) => (
      <>
        <Icon
          icon={playFootballLine}
          aria-hidden
          className="animate-im-player text-brasil-yellow"
          style={box(s * 0.74)}
        />
        <Icon
          icon={footballLine}
          aria-hidden
          className="animate-im-ball-kicked absolute text-white/80"
          style={{ ...box(s * 0.22), left: "14%", bottom: "16%" }}
        />
      </>
    ),
  },
  {
    id: "redeemer",
    ms: 1700,
    text: "Brasil te recibe",
    render: (s) => (
      <>
        <span
          aria-hidden
          className="animate-im-arc absolute rounded-full"
          style={{
            width: s * 0.86,
            height: s * 0.86,
            background:
              "conic-gradient(from 200deg, var(--color-brasil-green, #009739), var(--color-brasil-yellow, #FFDF00), transparent 65%)",
            filter: "blur(18px)",
            opacity: 0.55,
          }}
        />
        <Icon
          icon={christTheRedeemerLine}
          aria-hidden
          className="animate-im-rise relative text-white"
          style={box(s * 0.7)}
        />
      </>
    ),
  },
  {
    id: "landscape",
    ms: 1700,
    text: "Descubre lugares inolvidables",
    render: (s) => (
      <div className="relative" style={box(s * 0.82)}>
        <Icon
          icon={sunLine}
          aria-hidden
          className="animate-im-layer absolute text-brasil-yellow"
          style={{ ...box(s * 0.26), left: "10%", top: "4%", animationDelay: "0ms" }}
        />
        <Icon
          icon={mountainLine}
          aria-hidden
          className="animate-im-layer absolute text-white"
          style={{ ...box(s * 0.58), right: "4%", top: "18%", animationDelay: "140ms" }}
        />
        <Icon
          icon={waveLine}
          aria-hidden
          className="animate-im-layer absolute text-brasil-cyan"
          style={{ ...box(s * 0.5), left: "6%", bottom: "2%", animationDelay: "280ms" }}
        />
      </div>
    ),
  },
  {
    id: "passport",
    ms: 1700,
    text: "Completa tu pasaporte",
    render: (s) => (
      <>
        <Icon
          icon={passportLine}
          aria-hidden
          className="animate-im-open text-white"
          style={box(s * 0.64)}
        />
        <span
          aria-hidden
          className="animate-im-pulse absolute rounded-full border-4 border-brasil-yellow/70"
          style={box(s * 0.7)}
        />
        <Icon
          icon={sealLine}
          aria-hidden
          className="animate-im-seal absolute text-brasil-yellow"
          style={{ ...box(s * 0.32), right: "12%", bottom: "16%" }}
        />
      </>
    ),
  },
  {
    id: "copies",
    ms: 1700,
    text: "Llévate tres recuerdos",
    render: (s) => (
      <div className="relative flex items-center justify-center" style={box(s * 0.78)}>
        <Icon
          icon={picLine}
          aria-hidden
          className="animate-im-fan-left absolute text-white/60"
          style={box(s * 0.5)}
        />
        <Icon
          icon={picLine}
          aria-hidden
          className="animate-im-fan-right absolute text-white/60"
          style={box(s * 0.5)}
        />
        <Icon
          icon={picLine}
          aria-hidden
          className="animate-im-layer relative text-brasil-yellow"
          style={box(s * 0.5)}
        />
      </div>
    ),
  },
  {
    id: "loop",
    ms: 1400,
    text: "Tu viaje comienza aquí",
    render: (s) => (
      <div className="relative flex items-center justify-center" style={box(s * 0.7)}>
        <span className="animate-im-orbit absolute inset-0">
          {["--color-brasil-yellow", "--color-brasil-green", "--color-brasil-cyan"].map(
            (token, i) => (
              <span
                key={token}
                className="absolute rounded-full"
                style={{
                  width: s * 0.07,
                  height: s * 0.07,
                  background: `var(${token}, #FFDF00)`,
                  left: "50%",
                  top: "50%",
                  transform: `rotate(${i * 120}deg) translate(${s * 0.3}px) translate(-50%, -50%)`,
                }}
              />
            ),
          )}
        </span>
        <Icon
          icon={footballLine}
          aria-hidden
          className="animate-im-layer relative text-brasil-yellow"
          style={box(s * 0.4)}
        />
      </div>
    ),
  },
];

type Props = {
  /** estado técnico real do processamento; independente da narrativa */
  label?: string;
  size?: number;
};

export function ImmersiveBrazilLoader({ label, size = 280 }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const scene = SCENES[index];
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % SCENES.length),
      scene?.ms ?? 1600,
    );
    return () => clearTimeout(timer);
  }, [index]);

  const scene = SCENES[index] ?? SCENES[0]!;

  return (
    <div className="flex flex-col items-center gap-10">
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={box(size)}
      >
        <div
          key={scene.id}
          className="relative flex h-full w-full items-center justify-center"
        >
          {scene.render(size)}
        </div>
      </div>

      <div className="flex h-[7.5rem] flex-col items-center justify-start gap-4 text-center">
        <p
          key={scene.id}
          className="animate-im-fade font-display text-[2.5rem] font-black uppercase leading-none tracking-wide text-white"
        >
          {scene.text}
        </p>
        {label && (
          <p className="text-[1.6rem] font-semibold text-muted-foreground">{label}</p>
        )}
      </div>
    </div>
  );
}
