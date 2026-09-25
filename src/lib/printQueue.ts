import { supabase } from "@/integrations/supabase/client";

export const STATION_ID = "totem-1-printer";
export const PRINT_BUCKET = "print-jobs";

export type PrintJobStatus = "pending" | "processing" | "sent" | "failed" | "cancelled";

export type PrintJob = {
  id: string;
  station_id: string;
  image_path: string;
  status: PrintJobStatus;
  dedupe_key: string;
  created_at: string;
  claimed_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  attempts: number;
  error_message: string | null;
};

/** Converte o data URL do documento 2x6 em Blob sem reprocessar a imagem. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const type = /:(.*?);/.exec(head ?? "")?.[1] ?? "image/jpeg";
  const bytes = atob(body ?? "");
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type });
}

/**
 * Envia o documento de impressão (600x1800) para o bucket privado e cria o
 * registro da fila. Idempotente por `jobId`: se o trabalho já existe, não
 * reenvia nem duplica; se a estação o marcou como falho, apenas o recoloca
 * na fila (mesmo ID, sem nova impressão paralela).
 */
export async function enqueuePrintJob(jobId: string, strip: string): Promise<PrintJob> {
  const imagePath = `${STATION_ID}/${jobId}.jpg`;

  const existing = await fetchJob(jobId);
  if (existing) {
    if (existing.status === "failed" || existing.status === "cancelled") {
      await requeueJob(jobId);
      return (await fetchJob(jobId)) ?? existing;
    }
    return existing;
  }

  const upload = await supabase.storage
    .from(PRINT_BUCKET)
    .upload(imagePath, dataUrlToBlob(strip), { contentType: "image/jpeg", upsert: true });
  // arquivo já enviado numa tentativa anterior: segue para o registro
  if (upload.error && !/exist|duplicate/i.test(upload.error.message)) throw upload.error;

  const inserted = await supabase
    .from("print_jobs")
    .insert({
      id: jobId,
      station_id: STATION_ID,
      image_path: imagePath,
      status: "pending",
      dedupe_key: jobId,
      attempts: 0,
    })
    .select("*")
    .single();
  if (inserted.error) {
    // corrida com uma tentativa anterior que chegou a gravar
    const again = await fetchJob(jobId);
    if (again) return again;
    throw inserted.error;
  }
  return inserted.data as PrintJob;
}

export async function fetchJob(jobId: string): Promise<PrintJob | null> {
  const { data } = await supabase.from("print_jobs").select("*").eq("id", jobId).maybeSingle();
  return (data as PrintJob | null) ?? null;
}

export async function fetchPendingJobs(): Promise<PrintJob[]> {
  const { data, error } = await supabase
    .from("print_jobs")
    .select("*")
    .eq("station_id", STATION_ID)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PrintJob[];
}

export async function fetchLastFailedJob(): Promise<PrintJob | null> {
  const { data } = await supabase
    .from("print_jobs")
    .select("*")
    .eq("station_id", STATION_ID)
    .eq("status", "failed")
    .order("failed_at", { ascending: false })
    .limit(1);
  return (data?.[0] as PrintJob | undefined) ?? null;
}

export async function fetchLastJob(): Promise<PrintJob | null> {
  const { data } = await supabase
    .from("print_jobs")
    .select("*")
    .eq("station_id", STATION_ID)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0] as PrintJob | undefined) ?? null;
}

/**
 * Reivindica o trabalho de forma condicional: só tem efeito se ele ainda
 * estiver `pending`. Assim duas abas nunca imprimem o mesmo ID.
 */
export async function claimJob(job: PrintJob): Promise<PrintJob | null> {
  const { data, error } = await supabase
    .from("print_jobs")
    .update({
      status: "processing",
      claimed_at: new Date().toISOString(),
      attempts: job.attempts + 1,
      error_message: null,
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("*");
  if (error) throw error;
  return (data?.[0] as PrintJob | undefined) ?? null;
}

export async function markSent(jobId: string) {
  await supabase
    .from("print_jobs")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "processing");
}

export async function markFailed(jobId: string, message: string) {
  await supabase
    .from("print_jobs")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      error_message: message.slice(0, 400),
    })
    .eq("id", jobId);
}

/** Recoloca um trabalho com falha na fila (operador ou INTENTAR DE NUEVO). */
export async function requeueJob(jobId: string) {
  await supabase
    .from("print_jobs")
    .update({ status: "pending", error_message: null, failed_at: null })
    .eq("id", jobId)
    .in("status", ["failed", "cancelled"]);
}

export async function signedImageUrl(imagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PRINT_BUCKET)
    .createSignedUrl(imagePath, 60);
  if (error || !data) throw error ?? new Error("Não foi possível abrir o arquivo.");
  return data.signedUrl;
}
