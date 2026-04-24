import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireCustomerSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await requireCustomerSession(req);
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data: coupon } = await supabase
      .from("user_coupons")
      .select("id, code, type, value, label, expires_at")
      .eq("customer_phone", session.phone)
      .eq("used", false)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.status(200).json({ coupon: coupon ?? null });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(400).json({ error: "Erro ao buscar cupom." });
  }
}
