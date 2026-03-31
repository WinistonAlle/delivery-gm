import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireAdminSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

type CarouselMode = "auto" | "manual";

function normalizeMode(value: unknown): CarouselMode {
  return value === "manual" ? "manual" : "auto";
}

async function readConfig() {
  const supabase = getSupabaseAdminClient();

  const [{ data: settings, error: settingsError }, { data: featured, error: featuredError }] =
    await Promise.all([
      supabase.from("carousel_settings").select("mode").eq("id", 1).maybeSingle(),
      supabase
        .from("featured_products")
        .select("position, product_id, active")
        .eq("active", true)
        .order("position", { ascending: true })
        .limit(20),
    ]);

  if (settingsError) throw settingsError;
  if (featuredError) throw featuredError;

  return {
    mode: normalizeMode(settings?.mode),
    featured: featured ?? [],
  };
}

async function saveMode(mode: CarouselMode) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("carousel_settings")
    .upsert({ id: 1, mode }, { onConflict: "id" });

  if (error) throw error;
}

async function saveFeatured(productIds: string[]) {
  const supabase = getSupabaseAdminClient();

  const payload = productIds.map((productId, idx) => ({
    position: idx + 1,
    product_id: productId,
    active: true,
  }));

  if (!payload.length) {
    const { error: clearError } = await supabase
      .from("featured_products")
      .delete()
      .neq("position", 0);
    if (clearError) throw clearError;
    return;
  }

  const { error: upsertError } = await supabase
    .from("featured_products")
    .upsert(payload, { onConflict: "position" });

  if (!upsertError) return;

  const { error: deleteError } = await supabase
    .from("featured_products")
    .delete()
    .in("position", payload.map((item) => item.position));
  if (deleteError) throw upsertError;

  const { error: insertError } = await supabase.from("featured_products").insert(payload);
  if (insertError) throw insertError;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  try {
    await requireAdminSession(req);

    if (req.method === "GET") {
      return res.status(200).json(await readConfig());
    }

    if (req.method === "POST") {
      const body = (req.body ?? {}) as { mode?: unknown; featuredProductIds?: unknown };
      const mode = normalizeMode(body.mode);
      const featuredProductIds = Array.isArray(body.featuredProductIds)
        ? body.featuredProductIds.map((value) => String(value)).filter(Boolean)
        : null;

      if (featuredProductIds) {
        await saveFeatured(featuredProductIds);
      }

      await saveMode(mode);

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    const message = error instanceof Error ? error.message : "Erro ao salvar destaques.";
    return res.status(500).json({ error: message });
  }
}
