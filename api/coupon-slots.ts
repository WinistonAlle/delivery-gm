import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: slots, error } = await supabase
      .from("coupon_slots")
      .select("id, label, type, value, weight")
      .eq("is_active", true)
      .order("weight", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ slots: slots ?? [] });
  } catch {
    return res.status(500).json({ error: "Erro ao buscar prêmios." });
  }
}
