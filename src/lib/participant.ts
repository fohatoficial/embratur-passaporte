import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Versão do Aviso de Privacidad exibido no totem. */
export const PRIVACY_NOTICE_VERSION = "2026-09-26b";

/** Inteiro de 1 a 120, somente dígitos. */
export function normalizeAge(raw: string | number): number | null {
  const s = String(raw).trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 120 ? n : null;
}

/** Remove espaços, converte para minúsculas e valida o formato. */
export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (e.length < 5 || e.length > 254) return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(e)) return null;
  if (e.includes("..")) return null;
  return e;
}

export const COUNTRIES: { code: CountryCode; name: string; dial: string }[] = [
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "BR", name: "Brasil", dial: "+55" },
  { code: "UY", name: "Uruguay", dial: "+598" },
  { code: "PY", name: "Paraguay", dial: "+595" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "BO", name: "Bolivia", dial: "+591" },
  { code: "PE", name: "Perú", dial: "+51" },
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "MX", name: "México", dial: "+52" },
  { code: "ES", name: "España", dial: "+34" },
  { code: "US", name: "Estados Unidos", dial: "+1" },
];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [CountryCode, ...CountryCode[]];

/** Colapsa espaços e valida: 2-80, letras Unicode, espaços, apóstrofos e hífens. */
export function normalizeName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) return null;
  if (!/^[\p{L}\p{M}' ’-]+$/u.test(name)) return null;
  if ((name.match(/\p{L}/gu) ?? []).length < 2) return null;
  return name;
}

/** Valida pelo país escolhido e devolve E.164 (ex.: +5491123456789). */
export function normalizeWhatsapp(raw: string, country: CountryCode): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 6) return null;
  const phone = parsePhoneNumberFromString(digits, country);
  if (!phone || !phone.isValid() || phone.country !== country) return null;
  return phone.number;
}
