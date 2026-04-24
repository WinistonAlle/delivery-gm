import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireCustomerSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

function generateCouponCode(phone: string) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const phoneDigits = phone.replace(/\D/g, "").slice(-4);
  return `GM${phoneDigits}${suffix}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await requireCustomerSession(req);
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    // Verifica se o usuário já tem um cupom ativo
    const { data: existing } = await supabase
      .from("user_coupons")
      .select("id, code, type, value, label")
      .eq("customer_phone", session.phone)
      .eq("used", false)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ ...existing, alreadyHad: true });
    }

    // Busca os slots ativos ordenados por peso (mesma ordem da roda visual)
    const { data: slots, error: slotsError } = await supabase
      .from("coupon_slots")
      .select("id, label, type, value, weight")
      .eq("is_active", true)
      .order("weight", { ascending: false });

    if (slotsError || !slots?.length) {
      return res.status(400).json({ error: "Nenhum prêmio disponível no momento." });
    }

    // Seleção ponderada aleatória
    const totalWeight = slots.reduce((sum, s) => sum + (s.weight ?? 1), 0);
    let rand = Math.random() * totalWeight;
    let selectedSlot = slots[0];
    let selectedIndex = 0;
    for (let i = 0; i < slots.length; i++) {
      rand -= slots[i].weight ?? 1;
      if (rand <= 0) {
        selectedSlot = slots[i];
        selectedIndex = i;
        break;
      }
    }

    const code = generateCouponCode(session.phone);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: coupon, error: insertError } = await supabase
      .from("user_coupons")
      .insert({
        customer_phone: session.phone,
        code,
        coupon_slot_id: selectedSlot.id,
        type: selectedSlot.type,
        value: selectedSlot.value,
        label: selectedSlot.label,
        used: false,
        expires_at: expiresAt,
      })
      .select("id, code, type, value, label")
      .single();

    if (insertError || !coupon) {
      throw insertError ?? new Error("Erro ao salvar cupom.");
    }

    return res.status(200).json({
      ...coupon,
      slotIndex: selectedIndex,
      totalSlots: slots.length,
      alreadyHad: false,
    });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : "Erro ao sortear cupom.";
    return res.status(400).json({ error: message });
  }
}
