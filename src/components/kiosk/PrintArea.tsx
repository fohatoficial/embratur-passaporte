import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Área exclusiva de impressão (4x6 pol, portrait, margem 0).
 * Fica fora da árvore visual do totem (portal no body) e só aparece
 * dentro de @media print. Não faz nenhum processamento de imagem.
 */
export function PrintArea({
  photo,
  onReady,
}: {
  photo: string;
  onReady: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const firedRef = useRef(false);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    const fire = () => {
      if (cancelled || firedRef.current) return;
      firedRef.current = true;
      readyRef.current();
    };

    void (async () => {
      const img = imgRef.current;
      try {
        if (img?.decode) await img.decode();
        else if (img && !img.complete) {
          await new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          });
        }
      } catch {
        /* segue mesmo assim: a imagem já está em memória */
      }
      // um frame para garantir o layout aplicado antes de imprimir
      requestAnimationFrame(() => requestAnimationFrame(fire));
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, photo]);

  if (!mounted) return null;

  return createPortal(
    <div className="kiosk-print-area">
      <img ref={imgRef} src={photo} alt="" />
    </div>,
    document.body,
  );
}
