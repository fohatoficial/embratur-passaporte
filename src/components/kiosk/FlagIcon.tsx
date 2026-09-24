import type { CountryCode } from "libphonenumber-js";
import arFlag from "@/assets/flags/ar.svg";
import boFlag from "@/assets/flags/bo.svg";
import brFlag from "@/assets/flags/br.svg";
import clFlag from "@/assets/flags/cl.svg";
import coFlag from "@/assets/flags/co.svg";
import esFlag from "@/assets/flags/es.svg";
import mxFlag from "@/assets/flags/mx.svg";
import peFlag from "@/assets/flags/pe.svg";
import pyFlag from "@/assets/flags/py.svg";
import usFlag from "@/assets/flags/us.svg";
import uyFlag from "@/assets/flags/uy.svg";

const FLAGS: Partial<Record<CountryCode, string>> = {
  AR: arFlag,
  BO: boFlag,
  BR: brFlag,
  CL: clFlag,
  CO: coFlag,
  ES: esFlag,
  MX: mxFlag,
  PE: peFlag,
  PY: pyFlag,
  US: usFlag,
  UY: uyFlag,
};

/** Bandeira SVG local, proporção 4:3 preservada, cantos levemente arredondados. */
export function FlagIcon({ code, className }: { code: CountryCode; className?: string }) {
  const src = FLAGS[code];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={`aspect-[4/3] w-16 rounded-[0.4rem] object-contain ${className ?? ""}`}
    />
  );
}
