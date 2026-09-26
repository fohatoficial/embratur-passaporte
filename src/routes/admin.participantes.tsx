import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowDown, ArrowUp, Download, Loader2, LogOut, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrasilLogo } from "@/components/kiosk/BrasilLogo";
import { exportParticipantsCsv } from "@/lib/adminExport.functions";
import { originCountries, originFlagUrl } from "@/lib/originCountries";
import {
  ADMIN_TZ,
  EMPTY_FILTERS,
  PARTICIPANT_COLUMNS,
  applyFilters,
  fmtDate,
  fmtDateTime,
  normalizedFilters,
  statsArgs,
  type ParticipantFilters,
  type ParticipantRow,
  type SortKey,
} from "@/lib/adminParticipants";

export const Route = createFileRoute("/admin/participantes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel da ativação — Participantes" },
      { name: "description", content: "Painel interno de participantes da ativação EMBRATUR." },
      { property: "og:title", content: "Painel da ativação — Participantes" },
      { property: "og:description", content: "Painel interno de participantes da ativação EMBRATUR." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="fixed inset-0 overflow-auto select-text bg-paper font-sans text-paper-ink">
      {session === undefined ? (
        <Center><Loader2 className="size-8 animate-spin text-brasil-blue" /></Center>
      ) : session ? (
        <AdminGate session={session} />
      ) : (
        <LoginScreen />
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6">{children}</div>;
}

async function signOut() {
  await supabase.auth.signOut();
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    setPassword("");
    if (error) setError(error.status === 400 ? "E-mail ou senha inválidos." : "Não foi possível entrar. Tente novamente.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brasil-blue p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-paper p-8 shadow-xl">
        <div className="mb-6 flex justify-center rounded-xl bg-brasil-blue p-4">
          <BrasilLogo className="w-40" />
        </div>
        <h1 className="text-center text-2xl font-black uppercase text-brasil-blue-dark">Painel da ativação</h1>
        <p className="mt-1 text-center text-sm text-paper-ink/60">Acesse para acompanhar os participantes cadastrados.</p>
        <label className="mt-6 block text-sm font-semibold">E-mail
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-paper-ink/20 bg-paper text-paper-ink px-3 py-2 outline-none focus:ring-2 focus:ring-brasil-blue" />
        </label>
        <label className="mt-4 block text-sm font-semibold">Senha
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-paper-ink/20 bg-paper text-paper-ink px-3 py-2 outline-none focus:ring-2 focus:ring-brasil-blue" />
        </label>
        {error && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brasil-yellow py-3 font-black uppercase text-brasil-blue-dark disabled:opacity-60">
          {loading && <Loader2 className="size-4 animate-spin" />} Entrar
        </button>
      </form>
    </div>
  );
}

function AdminGate({ session }: { session: Session }) {
  const [state, setState] = useState<"checking" | "ok" | "denied" | "error">("checking");
  const check = useCallback(async () => {
    setState("checking");
    const { data, error } = await supabase.rpc("is_active_admin", { _user_id: session.user.id });
    setState(error ? "error" : data ? "ok" : "denied");
  }, [session.user.id]);
  useEffect(() => { void check(); }, [check]);

  if (state === "checking") return <Center><Loader2 className="size-8 animate-spin text-brasil-blue" /></Center>;
  if (state !== "ok")
    return (
      <Center>
        <div className="max-w-sm rounded-2xl bg-paper p-8 text-center shadow">
          <h1 className="text-xl font-black uppercase text-brasil-blue-dark">{state === "denied" ? "Acesso não autorizado" : "Não foi possível verificar o acesso"}</h1>
          <p className="mt-2 text-sm text-paper-ink/60">{state === "denied" ? "Esta conta não tem permissão de administrador." : "Tente novamente em instantes."}</p>
          <div className="mt-6 flex justify-center gap-2">
            {state === "error" && <button onClick={check} className="rounded-lg bg-brasil-yellow px-4 py-2 font-bold uppercase text-brasil-blue-dark">Tentar novamente</button>}
            <button onClick={signOut} className="rounded-lg border border-paper-ink/20 px-4 py-2 font-bold uppercase">Sair</button>
          </div>
        </div>
      </Center>
    );
  return <Dashboard email={session.user.email ?? ""} />;
}

interface Stats {
  grand_total: number; total: number; today: number; last_hour: number; marketing: number;
  countries: { code: string; name: string | null; count: number }[];
  versions: string[] | null;
}
type RtStatus = "connecting" | "live" | "reconnecting" | "down";

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function Dashboard({ email }: { email: string }) {
  const [filters, setFilters] = useState<ParticipantFilters>(EMPTY_FILTERS);
  const debouncedSearch = useDebounced(filters.search, 350);
  const effective = useMemo(() => ({ ...filters, search: debouncedSearch }), [filters, debouncedSearch]);
  const norm = useMemo(() => normalizedFilters(effective), [effective]);

  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "created_at", asc: false });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState<ParticipantRow[] | null>(null);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [rt, setRt] = useState<RtStatus>("connecting");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const reqId = useRef(0);
  const knownIds = useRef<Set<string>>(new Set());

  useEffect(() => { setPage(0); }, [norm, pageSize, sort]);

  const load = useCallback(async (silent: boolean) => {
    const id = ++reqId.current;
    if (!silent) setLoading(true);
    const from = page * pageSize;
    let q = applyFilters(supabase.from("activation_participants").select(PARTICIPANT_COLUMNS, { count: "exact" }), norm)
      .order(sort.key, { ascending: sort.asc, nullsFirst: false });
    if (sort.key !== "created_at") q = q.order("created_at", { ascending: false });
    const [list, st] = await Promise.all([
      q.order("id").range(from, from + pageSize - 1),
      supabase.rpc("admin_participant_stats", statsArgs(norm)),
    ]);
    if (id !== reqId.current) return;
    setLoading(false);
    if (list.error || st.error) { setError(true); return; }
    setError(false);
    const data = (list.data ?? []) as unknown as ParticipantRow[];
    if (silent) {
      const newOnes = data.filter((r) => !knownIds.current.has(r.id)).map((r) => r.id);
      if (newOnes.length) {
        setFresh(new Set(newOnes));
        setTimeout(() => setFresh(new Set()), 2500);
      }
    }
    data.forEach((r) => knownIds.current.add(r.id));
    setRows(data);
    setCount(list.count ?? 0);
    setStats(st.data as unknown as Stats);
    setUpdatedAt(new Date());
  }, [norm, page, pageSize, sort]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => { void load(false); }, [load]);

  // Uma única assinatura por página; recarrega silenciosamente (sem piscar) mantendo filtros e página.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel("admin-participants")
      .on("postgres_changes", { event: "*", schema: "public", table: "activation_participants" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void loadRef.current(true), 400);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRt("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRt("reconnecting");
        else if (status === "CLOSED") setRt("down");
      });
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, []);

  const set = <K extends keyof ParticipantFilters>(k: K, v: ParticipantFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key !== "created_at" }));

  const runExport = useServerFn(exportParticipantsCsv);
  async function doExport() {
    if (exporting) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await runExport({ data: effective });
      if (!res.ok) throw new Error(res.error);
      const now = new Date();
      const p = new Intl.DateTimeFormat("en-CA", { timeZone: ADMIN_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
        .formatToParts(now).reduce<Record<string, string>>((a, x) => ({ ...a, [x.type]: x.value }), {});
      const name = `participantes-embratur-fit-${p["year"]}-${p["month"]}-${p["day"]}-${p["hour"]}-${p["minute"]}.csv`;
      const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setExportMsg({ ok: true, text: `CSV exportado com ${res.count} registro(s).` });
    } catch {
      setExportMsg({ ok: false, text: "Não foi possível exportar o CSV. Tente novamente." });
    } finally {
      setExporting(false);
    }
  }

  const countries = useMemo(() => originCountries(), []);
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const filtered = JSON.stringify(effective) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="mx-auto max-w-[1600px] p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-4 rounded-2xl bg-brasil-blue p-4 text-primary-foreground">
        <BrasilLogo className="w-28" />
        <div className="mr-auto">
          <h1 className="text-2xl font-black uppercase">Participantes</h1>
          <p className="flex flex-wrap items-center gap-3 text-xs opacity-90">
            <RtBadge status={rt} />
            <span>Última atualização: {updatedAt ? fmtDateTime(updatedAt.toISOString()) : "—"}</span>
            <span className="opacity-75">{email}</span>
          </p>
        </div>
        <button onClick={() => void load(false)} className="flex items-center gap-2 rounded-lg bg-primary-foreground/15 px-4 py-2 text-sm font-bold uppercase hover:bg-primary-foreground/25">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
        <button onClick={doExport} disabled={exporting} className="flex items-center gap-2 rounded-lg bg-brasil-yellow px-4 py-2 text-sm font-black uppercase text-brasil-blue-dark disabled:opacity-60">
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Exportar CSV
        </button>
        <button onClick={signOut} className="flex items-center gap-2 rounded-lg border border-primary-foreground/40 px-4 py-2 text-sm font-bold uppercase">
          <LogOut className="size-4" /> Sair
        </button>
      </header>
      {exportMsg && (
        <p role="status" className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold ${exportMsg.ok ? "bg-brasil-green/15 text-brasil-green" : "bg-destructive/10 text-destructive"}`}>{exportMsg.text}</p>
      )}

      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total de participantes" value={stats?.total} hint={filtered && stats ? `de ${stats.grand_total} no total geral` : stats ? "total geral" : undefined} />
        <StatCard label="Cadastros hoje" value={stats?.today} />
        <StatCard label="Última hora" value={stats?.last_hour} />
        <StatCard label="Autorizam comunicações" value={stats?.marketing} hint={stats && stats.total ? `${Math.round((stats.marketing / stats.total) * 100)}%` : undefined} />
        <div className="col-span-2 rounded-xl bg-paper p-4 shadow-sm md:col-span-1">
          <p className="text-xs font-bold uppercase text-paper-ink/60">Por país</p>
          <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-sm">
            {stats?.countries.length ? stats.countries.map((c) => (
              <li key={c.code} className="flex items-center gap-2">
                <img src={originFlagUrl(c.code)} alt="" className="h-3 w-4 rounded-sm object-cover" />
                <span className="mr-auto truncate">{c.name ?? c.code}</span>
                <span className="font-bold">{c.count}</span>
              </li>
            )) : <li className="text-paper-ink/60">—</li>}
          </ul>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-paper p-4 shadow-sm md:grid-cols-4 xl:grid-cols-9">
        <Field label="Buscar (nome, e-mail, WhatsApp)" wide>
          <input value={filters.search} onChange={(e) => set("search", e.target.value)} className={inputCls} placeholder="Buscar…" />
        </Field>
        <Field label="País de origem">
          <select value={filters.country} onChange={(e) => set("country", e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Idade mín."><input inputMode="numeric" value={filters.ageMin} onChange={(e) => set("ageMin", e.target.value.replace(/\D/g, "").slice(0, 3))} className={inputCls} /></Field>
        <Field label="Idade máx."><input inputMode="numeric" value={filters.ageMax} onChange={(e) => set("ageMax", e.target.value.replace(/\D/g, "").slice(0, 3))} className={inputCls} /></Field>
        <Field label="Data inicial"><input type="date" value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} className={inputCls} /></Field>
        <Field label="Data final"><input type="date" value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)} className={inputCls} /></Field>
        <Field label="Comunicações">
          <select value={filters.marketing} onChange={(e) => set("marketing", e.target.value as ParticipantFilters["marketing"])} className={inputCls}>
            <option value="all">Todos</option><option value="yes">Autorizou</option><option value="no">Não autorizou</option>
          </select>
        </Field>
        <Field label="Privacidade">
          <select value={filters.privacy} onChange={(e) => set("privacy", e.target.value as ParticipantFilters["privacy"])} className={inputCls}>
            <option value="all">Todos</option><option value="yes">Aceitou</option><option value="no">Não aceitou</option>
          </select>
        </Field>
        <Field label="Versão do aviso">
          <select value={filters.version} onChange={(e) => set("version", e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {(stats?.versions ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <div className="col-span-2 flex items-end md:col-span-4 xl:col-span-9">
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="rounded-lg border border-paper-ink/20 px-4 py-2 text-xs font-bold uppercase hover:bg-paper-ink/10">Limpar filtros</button>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-xl bg-paper shadow-sm">
        {error && (
          <div className="flex items-center justify-between gap-4 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Não foi possível carregar os participantes.
            <button onClick={() => void load(false)} className="rounded-lg bg-destructive px-3 py-1 font-bold text-destructive-foreground">Tentar novamente</button>
          </div>
        )}
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full min-w-[1500px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-brasil-blue-dark text-xs uppercase text-primary-foreground">
              <tr>
                <Th sortKey="created_at" sort={sort} onSort={toggleSort}>Cadastro</Th>
                <Th sortKey="name" sort={sort} onSort={toggleSort}>Nome</Th>
                <Th sortKey="country_of_origin_name" sort={sort} onSort={toggleSort}>País de origem</Th>
                <Th sortKey="age" sort={sort} onSort={toggleSort}>Idade</Th>
                <Th>E-mail</Th><Th>WhatsApp</Th><Th>Privacidade</Th><Th>Comunicações</Th>
                <Th>Aceite privacidade</Th><Th>Versão</Th><Th>Sessão</Th><Th>Expira em</Th>
              </tr>
            </thead>
            <tbody>
              {rows === null && loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-paper-ink/10">
                      {Array.from({ length: 12 }).map((__, j) => <td key={j} className="px-3 py-3"><div className="h-3 animate-pulse rounded bg-paper-ink/10" /></td>)}
                    </tr>
                  ))
                : rows && rows.length === 0
                  ? <tr><td colSpan={12} className="px-3 py-16 text-center text-paper-ink/60">Nenhum participante encontrado.</td></tr>
                  : rows?.map((r) => (
                      <tr key={r.id} className={`border-b border-paper-ink/10 transition-colors duration-1000 ${fresh.has(r.id) ? "bg-brasil-yellow/25" : "hover:bg-paper-ink/5"}`}>
                        <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(r.created_at)}</td>
                        <td className="px-3 py-2 font-semibold">{r.name || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {r.country_of_origin_code ? (
                            <span className="flex items-center gap-2">
                              <img src={originFlagUrl(r.country_of_origin_code)} alt="" className="h-3 w-4 rounded-sm object-cover" />
                              {r.country_of_origin_name ?? r.country_of_origin_code}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2">{r.age ?? "—"}</td>
                        <td className="px-3 py-2">{r.email || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.whatsapp_e164 || "—"}</td>
                        <td className="px-3 py-2"><YesNo v={!!r.privacy_accepted_at} /></td>
                        <td className="px-3 py-2"><YesNo v={r.marketing_opt_in} /></td>
                        <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(r.privacy_accepted_at)}</td>
                        <td className="px-3 py-2">{r.privacy_notice_version || "—"}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-paper-ink/60">{r.session_id}</td>
                        <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.expires_at)}</td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap items-center gap-3 border-t border-paper-ink/10 px-4 py-3 text-sm">
          <span className="mr-auto text-paper-ink/60">{count} registro(s){loading && rows ? " · atualizando…" : ""}</span>
          <label className="flex items-center gap-2">Por página
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded border border-paper-ink/20 bg-paper text-paper-ink px-2 py-1">
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border border-paper-ink/20 px-3 py-1 disabled:opacity-40">Anterior</button>
          <span>Página {page + 1} de {pages}</span>
          <button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border border-paper-ink/20 px-3 py-1 disabled:opacity-40">Próxima</button>
        </footer>
      </section>
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-lg border border-paper-ink/20 bg-paper text-paper-ink px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brasil-blue";

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`block text-xs font-bold uppercase text-paper-ink/60 ${wide ? "col-span-2" : ""}`}>{label}{children}</label>;
}

function StatCard({ label, value, hint }: { label: string; value?: number | undefined; hint?: string | undefined }) {
  return (
    <div className="rounded-xl bg-paper p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-paper-ink/60">{label}</p>
      <p className="mt-1 text-3xl font-black text-brasil-blue-dark">{value ?? "—"}</p>
      {hint && <p className="text-xs text-paper-ink/60">{hint}</p>}
    </div>
  );
}

function YesNo({ v }: { v: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${v ? "bg-brasil-green/15 text-brasil-green" : "bg-paper-ink/10 text-paper-ink/60"}`}>{v ? "Sí" : "No"}</span>;
}

function RtBadge({ status }: { status: RtStatus }) {
  const map = {
    connecting: ["Conectando…", "bg-brasil-yellow"],
    live: ["Tempo real ativo", "bg-brasil-green-light"],
    reconnecting: ["Reconectando", "bg-brasil-orange"],
    down: ["Atualização indisponível", "bg-brasil-red"],
  } as const;
  const [text, dot] = map[status];
  return <span className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${dot} ${status === "live" ? "animate-pulse" : ""}`} />{text}</span>;
}

function Th({ children, sortKey, sort, onSort }: { children: React.ReactNode; sortKey?: SortKey; sort?: { key: SortKey; asc: boolean }; onSort?: (k: SortKey) => void }) {
  if (!sortKey || !onSort) return <th className="whitespace-nowrap px-3 py-3 font-bold">{children}</th>;
  const active = sort?.key === sortKey;
  return (
    <th className="whitespace-nowrap px-3 py-3 font-bold">
      <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 uppercase">
        {children}{active && (sort!.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}
