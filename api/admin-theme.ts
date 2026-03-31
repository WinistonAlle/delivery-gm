import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireAdminSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

function normalizeTheme(value: unknown) {
  const theme = String(value ?? "").trim();
  return theme || "default";
}

async function readTheme() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_theme_settings")
    .select("theme_key")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return normalizeTheme(data?.theme_key);
}

async function writeTheme(theme: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("app_theme_settings")
    .upsert(
      {
        id: 1,
        theme_key: normalizeTheme(theme),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) throw error;
  return { mode: "supabase" as const };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  try {
    await requireAdminSession(req);

    if (req.method === "GET") {
      return res.status(200).json({ theme: await readTheme() });
    }

    if (req.method === "POST") {
      const theme = normalizeTheme((req.body ?? {}).theme);
      return res.status(200).json(await writeTheme(theme));
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    const message = error instanceof Error ? error.message : "Erro ao salvar tema.";
    return res.status(500).json({ error: message });
  }
}
