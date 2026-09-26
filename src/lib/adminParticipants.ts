export const ADMIN_TZ = "America/Argentina/Buenos_Aires";

export type TriState = "all" | "yes" | "no";
export type SortKey = "created_at" | "name" | "country_of_origin_name" | "age";

export interface ParticipantFilters {
  search: string;
  country: string;
  ageMin: string;
  ageMax: string;
  dateFrom: string; // YYYY-MM-DD (Buenos Aires)
  dateTo: string;
  marketing: TriState;
  privacy: TriState;
  version: string;
}

export const EMPTY_FILTERS: ParticipantFilters = {
  search: "",
  country: "",
  ageMin: "",
  ageMax: "",
  dateFrom: "",
  dateTo: "",
  marketing: "all",
  privacy: "all",
  version: "",
};

export const PARTICIPANT_COLUMNS =
  "id, session_id, name, country_of_origin_code, country_of_origin_name, age, email, privacy_accepted_at, privacy_notice_version, marketing_opt_in, marketing_opt_in_at, created_at, expires_at";

export interface ParticipantRow {
  id: string;
  session_id: string;
  name: string;
  country_of_origin_code: string | null;
  country_of_origin_name: string | null;
  age: number | null;
  email: string | null;
  privacy_accepted_at: string;
  privacy_notice_version: string;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  created_at: string;
  expires_at: string;
}

/** Remove caracteres que alteram a sintaxe do filtro `or` do PostgREST. */
export function cleanSearch(s: string) {
  return s.replace(/[,()%*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

const int = (v: string) => (/^\d{1,3}$/.test(v.trim()) ? Number(v) : null);
// Buenos Aires é UTC-3 fixo (sem horário de verão).
const dayStart = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00-03:00` : null);
const nextDayStart = (d: string) => {
  const s = dayStart(d);
  if (!s) return null;
  return new Date(new Date(s).getTime() + 86400000).toISOString();
};
const tri = (t: TriState) => (t === "all" ? null : t === "yes");

export function normalizedFilters(f: ParticipantFilters) {
  return {
    search: cleanSearch(f.search) || null,
    country: /^[A-Z]{2}$/.test(f.country) ? f.country : null,
    ageMin: int(f.ageMin),
    ageMax: int(f.ageMax),
    from: dayStart(f.dateFrom),
    to: nextDayStart(f.dateTo),
    marketing: tri(f.marketing),
    privacy: tri(f.privacy),
    version: f.version.trim().slice(0, 40) || null,
  };
}
export type NormalizedFilters = ReturnType<typeof normalizedFilters>;

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FilterBuilder {
  or(f: string): any; eq(c: string, v: any): any; gte(c: string, v: any): any; lte(c: string, v: any): any;
  lt(c: string, v: any): any; not(c: string, op: string, v: any): any; is(c: string, v: any): any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
export function applyFilters<Q extends FilterBuilder>(q: Q, n: NormalizedFilters): Q {
  let r: Q = q;
  if (n.search) r = r.or(`name.ilike.*${n.search}*,email.ilike.*${n.search}*`);
  if (n.country) r = r.eq("country_of_origin_code", n.country);
  if (n.ageMin != null) r = r.gte("age", n.ageMin);
  if (n.ageMax != null) r = r.lte("age", n.ageMax);
  if (n.from) r = r.gte("created_at", n.from);
  if (n.to) r = r.lt("created_at", n.to);
  if (n.marketing != null) r = r.eq("marketing_opt_in", n.marketing);
  if (n.privacy === true) r = r.not("privacy_accepted_at", "is", null);
  if (n.privacy === false) r = r.is("privacy_accepted_at", null);
  if (n.version) r = r.eq("privacy_notice_version", n.version);
  return r;
}

export function statsArgs(n: NormalizedFilters) {
  const entries: [string, unknown][] = [
    ["p_search", n.search], ["p_country", n.country], ["p_age_min", n.ageMin], ["p_age_max", n.ageMax],
    ["p_from", n.from], ["p_to", n.to], ["p_marketing", n.marketing], ["p_privacy", n.privacy], ["p_version", n.version],
  ];
  return Object.fromEntries(entries.filter(([, v]) => v != null)) as {
    p_search?: string; p_country?: string; p_age_min?: number; p_age_max?: number; p_from?: string;
    p_to?: string; p_marketing?: boolean; p_privacy?: boolean; p_version?: string;
  };
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: ADMIN_TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: ADMIN_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}
export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : timeFmt.format(d);
}
export function fmtDateTime(iso: string | null | undefined) {
  return iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : "—";
}
