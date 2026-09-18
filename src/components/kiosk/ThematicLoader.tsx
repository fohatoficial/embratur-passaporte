import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import {
  christTheRedeemerLine,
  footballLine,
  passportLine,
  playFootballLine,
} from "./thematicIcons";

/**
 * Carregamento temático das etapas de processamento e envio para impressão.
 * Um pictograma por vez, sempre na mesma caixa, com fade e leve escala.
 * Ícones MingCute (Apache-2.0) embutidos — sem busca online.
 */

const ICONS = [footballLine, playFootballLine, christTheRedeemerLine, passportLine];

const SWAP_MS = 1200;
const FADE_MS = 260;

type Props = {
  /** texto de estado, exibido em tamanho secundário */
  label?: string;
  size?: number;
};

export function ThematicLoader({ label, size = 240 }: Props) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  }, []);

  useEffect(() => {
    const swap = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % ICONS.length);
        setVisible(true);
      }, FADE_MS);
    }, SWAP_MS);
    return () => clearInterval(swap);
  }, []);

  return (
    <div className="flex flex-col items-center gap-12">
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <Icon
          key={index}
          icon={ICONS[index] ?? footballLine}
          aria-hidden
          className="text-brasil-yellow transition-all ease-out"
          style={{
            width: size,
            height: size,
            opacity: visible ? 1 : 0,
            transform: visible || reduced ? "scale(1)" : "scale(0.94)",
            transitionDuration: `${FADE_MS}ms`,
          }}
        />
      </div>

      {label && (
        <p className="font-display text-[2.25rem] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}
    </div>
  );
}
