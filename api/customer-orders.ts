import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireCustomerSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

type FetchOrdersBody = {
  customerPhone?: string;
};

type ReorderBody = {
  action: "reorder";
  orderId?: string;
  customerPhone?: string;
};

type DefaultBody = FetchOrdersBody & {
  action?: "list";
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = (req.body ?? {}) as DefaultBody | ReorderBody;
    const session = await requireCustomerSession(req);
    const customerPhone = String(session.phone ?? "").replace(/\D/g, "");

    const supabase = getSupabaseAdminClient();

    if (body.action === "reorder") {
      const orderId = String(body.orderId ?? "").trim();
      if (!orderId) {
        return res.status(400).json({ error: "Pedido inválido." });
      }

      const { data, error } = await supabase
        .from("order_items")
        .select(
          `
          product_id,
          quantity,
          order:order_id!inner(customer_phone),
          products:product_id (*)
        `
        )
        .eq("order_id", orderId)
        .eq("order.customer_phone", customerPhone);

      if (error) throw error;
      return res.status(200).json({ items: data ?? [] });
    }

    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id,
        order_number,
        customer_phone,
        customer_name,
        total_items,
        total_value,
        status,
        created_at,
        order_items (
          id,
          product_name,
          quantity,
          subtotal
        )
      `
      )
      .eq("customer_phone", customerPhone)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.status(200).json({ orders: data ?? [] });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : "Erro ao buscar pedidos.";
    return res.status(400).json({ error: message });
  }
}
