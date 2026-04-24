import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireAdminSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  try {
    await requireAdminSession(req);
    const supabase = getSupabaseAdminClient();

    if (req.method === "GET") {
      const { data: coupons, error } = await supabase
        .from("user_coupons")
        .select("id, customer_phone, code, label, type, value, used, expires_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return res.status(200).json({ coupons: coupons ?? [] });
    }

    if (req.method === "POST") {
      const body = req.body as {
        action: string;
        id?: string;
        label?: string;
        type?: string;
        value?: number;
        weight?: number;
        is_active?: boolean;
      };

      if (body.action === "create_slot") {
        if (!body.label?.trim()) return res.status(400).json({ error: "Label obrigatório." });
        if (!["percent", "free_shipping"].includes(body.type ?? "")) {
          return res.status(400).json({ error: "Tipo inválido." });
        }

        const { data, error } = await supabase
          .from("coupon_slots")
          .insert({
            label: body.label.trim(),
            type: body.type,
            value: body.type === "free_shipping" ? 0 : Number(body.value ?? 0),
            weight: Math.max(1, Number(body.weight ?? 1)),
            is_active: true,
          })
          .select("id")
          .single();

        if (error) throw error;
        return res.status(200).json({ id: data.id });
      }

      if (body.action === "toggle_slot") {
        if (!body.id) return res.status(400).json({ error: "ID obrigatório." });
        const { error } = await supabase
          .from("coupon_slots")
          .update({ is_active: Boolean(body.is_active) })
          .eq("id", body.id);

        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (body.action === "delete_slot") {
        if (!body.id) return res.status(400).json({ error: "ID obrigatório." });
        const { error } = await supabase
          .from("coupon_slots")
          .delete()
          .eq("id", body.id);

        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "Ação desconhecida." });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : "Erro interno.";
    return res.status(500).json({ error: message });
  }
}
