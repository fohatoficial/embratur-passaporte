import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
  cameraLine,
  christTheRedeemerLine,
  emojiLine,
  footballLine,
  mountainLine,
  passportLine,
  picLine,
  playFootballLine,
  printLine,
  scanLine,
  sealLine,
  sunLine,
  waveLine,
} from "./immersiveIcons";

/**
 * Carregamento temático imersivo, com três variantes:
 *   preCapture       — antes de revelar a câmera
 *   photoProcessing  — tratamento da fotografia
 *   printPreparation — preparação e envio para impressão
 *
 * Duas camadas independentes: a narrativa (cena + frase, em looping) e o
 * estado técnico real, recebido por propriedade — atualizações do estado
 * técnico não remontam nem reiniciam a narrativa.
 *
 * Desempenho: apenas a cena ativa fica montada, um único agendador controla a
 * troca, só transform/opacity são animados e o ciclo pausa quando a aba fica
 * oculta. Pictogramas MingCute (Apache-2.0) embutidos — sem chamadas externas.
 */

export type LoaderVariant = "preCapture" | "photoProcessing" | "printPreparation";

type Scene = {
  id: string;
  ms: number;
  text: string;
  render: (size: number) => React.ReactNode;
};

const box = (size: number) => ({ width: size, height: size });

/* ---------- variante 1: antes da câmera ---------- */
const PRE_CAPTURE: Scene[] = [
  {
    id: "camera",
    ms: 1600,
    text: "Preparamos la cámara",
    render: (s) => (
      <>
        <Icon
          icon={cameraLine}
          aria-hidden
          className="animate-im-zoom-in text-brasil-yellow"
          style={box(s * 0.64)}
        />
        <span
          aria-hidden
          className="animate-im-pulse-once absolute rounded-full border-4 border-brasil-yellow/70"
          style={box(s * 0.3)}
        />
      </>
    ),
  },
  {
    id: "light",
    ms: 1600,
    text: "Busca una buena luz",
    render: (s) => (
      <>
        <Icon
          icon={sunLine}
          aria-hidden
          className="animate-im-layer text-brasil-yellow"
          style={box(s * 0.6)}
        />
        <span
          aria-hidden
          className="animate-im-rays absolute rounded-full border-4 border-brasil-yellow/60"
          style={box(s * 0.78)}
        />
      </>
    ),
  },
  {
    id: "face",
    ms: 1700,
    text: "Mira de frente",
    render: (s) => (
      <>
        <Icon
          icon={emojiLine}
          aria-hidden
          className="animate-im-layer text-white"
          style={box(s * 0.52)}
        />
        <Icon
          icon={scanLine}
          aria-hidden
          className="animate-im-frame-close absolute text-brasil-green-light"
          style={box(s * 0.82)}
        />
      </>
    ),
  },
  {
    id: "expression",
    ms: 1700,
    text: "Muestra tu mejor versión",
    render: (s) => (
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-full"
        style={box(s * 0.74)}
      >
        <Icon
          icon={emojiLine}
          aria-hidden
          className="animate-im-zoom-in text-brasil-yellow"
          style={box(s * 0.58)}
        />
        <span
          aria-hidden
          className="animate-im-sweep absolute top-0 h-full bg-white/25"
          style={{ width: s * 0.12 }}
        />
      </div>
    ),
  },
];

/* ---------- variante 2: processamento da fotografia ---------- */
const PHOTO_PROCESSING: Scene[] = [
  {
    id: "ball",
    ms: 1600,
    text: "El fútbol nos une",
    render: (s) => (
      <Icon
        icon={footballLine}
        aria-hidden
        className="animate-im-ball text-brasil-yellow"
        style={box(s * 0.6)}
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
          style={box(s * 0.72)}
        />
        <Icon
          icon={footballLine}
          aria-hidden
          className="animate-im-ball-kicked absolute bottom-[16%] left-[16%] text-white/80"
          style={box(s * 0.2)}
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
          className="animate-im-arc absolute rounded-full border-t-8 border-l-8 border-brasil-green-light/80 border-r-brasil-yellow/70 border-b-transparent border-r-8"
          style={box(s * 0.82)}
        />
        <Icon
          icon={christTheRedeemerLine}
          aria-hidden
          className="animate-im-rise relative text-white"
          style={box(s * 0.66)}
        />
      </>
    ),
  },
  {
    id: "landscape",
    ms: 1700,
    text: "Descubre lugares inolvidables",
    render: (s) => (
      <div className="relative" style={box(s * 0.8)}>
        <Icon
          icon={sunLine}
          aria-hidden
          className="animate-im-layer absolute left-[8%] top-[4%] text-brasil-yellow"
          style={box(s * 0.26)}
        />
        <Icon
          icon={mountainLine}
          aria-hidden
          className="animate-im-layer absolute right-[4%] top-[18%] text-white"
          style={{ ...box(s * 0.56), animationDelay: "120ms" }}
        />
        <Icon
          icon={waveLine}
          aria-hidden
          className="animate-im-layer absolute bottom-[2%] left-[6%] text-brasil-cyan"
          style={{ ...box(s * 0.48), animationDelay: "240ms" }}
        />
      </div>
    ),
  },
  {
    id: "brasil",
    ms: 1500,
    text: "Tu viaje comienza aquí",
    render: (s) => (
      <div className="relative flex items-center justify-center" style={box(s * 0.7)}>
        <span className="animate-im-orbit-once absolute inset-0">
          {[
            "var(--brasil-yellow)",
            "var(--brasil-green)",
            "var(--brasil-cyan)",
          ].map((color, i) => (
            <span
              key={color}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: s * 0.07,
                height: s * 0.07,
                background: color,
                transform: `rotate(${i * 120}deg) translate(${s * 0.3}px) translate(-50%, -50%)`,
              }}
            />
          ))}
        </span>
        <Icon
          icon={footballLine}
          aria-hidden
          className="animate-im-layer relative text-brasil-yellow"
          style={box(s * 0.38)}
        />
      </div>
    ),
  },
];

/* ---------- variante 3: preparação e envio para impressão ---------- */
const PRINT_PREPARATION: Scene[] = [
  {
    id: "passport",
    ms: 1600,
    text: "Un recuerdo de tu viaje",
    render: (s) => (
      <Icon
        icon={passportLine}
        aria-hidden
        className="animate-im-open text-white"
        style={box(s * 0.62)}
      />
    ),
  },
  {
    id: "photo",
    ms: 1600,
    text: "Tu foto está lista",
    render: (s) => (
      <Icon
        icon={picLine}
        aria-hidden
        className="animate-im-zoom-in text-brasil-yellow"
        style={box(s * 0.56)}
      />
    ),
  },
  {
    id: "copies",
    ms: 1700,
    text: "Tres recuerdos para llevar",
    render: (s) => (
      <div className="relative flex items-center justify-center" style={box(s * 0.78)}>
        <Icon
          icon={picLine}
          aria-hidden
          className="animate-im-fan-left absolute text-white/55"
          style={box(s * 0.48)}
        />
        <Icon
          icon={picLine}
          aria-hidden
          className="animate-im-fan-right absolute text-white/55"
          style={box(s * 0.48)}
        />
        <Icon
          icon={picLine}
          aria-hidden
          className="animate-im-layer relative text-brasil-yellow"
          style={box(s * 0.48)}
        />
      </div>
    ),
  },
  {
    id: "printer",
    ms: 1700,
    text: "Camino a la impresión",
    render: (s) => (
      <div className="relative flex items-center justify-center" style={box(s * 0.8)}>
        <Icon
          icon={printLine}
          aria-hidden
          className="animate-im-layer text-white"
          style={box(s * 0.6)}
        />
        <span
          aria-hidden
          className="animate-im-strip-out absolute rounded-sm bg-brasil-yellow"
          style={{ width: s * 0.09, height: s * 0.27 }}
        />
      </div>
    ),
  },
  {
    id: "stamp",
    ms: 1600,
    text: "Brasil 2027",
    render: (s) => (
      <>
        <Icon
          icon={sealLine}
          aria-hidden
          className="animate-im-seal text-brasil-yellow"
          style={box(s * 0.58)}
        />
        <span
          aria-hidden
          className="animate-im-pulse-once absolute rounded-full border-4 border-brasil-green-light/70"
          style={box(s * 0.72)}
        />
      </>
    ),
  },
];

const VARIANTS: Record<LoaderVariant, Scene[]> = {
  preCapture: PRE_CAPTURE,
  photoProcessing: PHOTO_PROCESSING,
  printPreparation: PRINT_PREPARATION,
};

/** tempo em que a cena mantém will-change ativo */
const WILL_CHANGE_MS = 1300;

type Props = {
  variant: LoaderVariant;
  /** estado técnico real; independente da narrativa */
  label?: string;
  size?: number;
};

function ImmersiveBrazilLoaderBase({ variant, label, size = 280 }: Props) {
  const scenes = VARIANTS[variant];
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(true);
  const renders = useRef(0);
  renders.current += 1;

  // agendador único da narrativa, pausado quando a página fica oculta
  useEffect(() => {
    setIndex(0);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current = 0;
    let stopped = false;

    const schedule = () => {
      if (stopped || document.hidden) return;
      timer = setTimeout(() => {
        current = (current + 1) % scenes.length;
        setIndex(current);
        schedule();
      }, scenes[current]?.ms ?? 1600);
    };

    const onVisibility = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (!document.hidden) schedule();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [scenes]);

  // will-change apenas enquanto a cena está realmente animando
  useEffect(() => {
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), WILL_CHANGE_MS);
    return () => clearTimeout(timer);
  }, [index]);

  const scene = scenes[index] ?? scenes[0]!;
  const stage = useMemo(() => box(size), [size]);

  if (import.meta.env.DEV) {
    // instrumentação discreta, apenas em desenvolvimento
    console.debug(
      `[loader] variant=${variant} scene=${scene.id} (${index + 1}/${scenes.length}) renders=${renders.current} loops=1`,
    );
  }

  return (
    <div className="flex flex-col items-center gap-10">
      <div className="relative flex items-center justify-center" style={stage}>
        <div
          key={`${variant}-${scene.id}`}
          className="relative flex h-full w-full items-center justify-center"
          style={{ willChange: animating ? "transform, opacity" : "auto" }}
        >
          {scene.render(size)}
        </div>
      </div>

      <div className="flex h-[7.5rem] flex-col items-center justify-start gap-4 text-center">
        <p
          key={`${variant}-${scene.id}-text`}
          className="animate-im-fade font-display text-[2.5rem] font-black uppercase leading-none tracking-wide text-white"
          style={{ animationDelay: "220ms" }}
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

export const ImmersiveBrazilLoader = memo(ImmersiveBrazilLoaderBase);
