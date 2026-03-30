import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

type ProductSnapshot = {
  id: string;
  old_id?: number | null;
  name: string;
  employee_price: number;
};

type CreateOrderParams = {
  customerPhone: string;
  customerName: string;
  customerDocumentCpf?: string;
  customerAddress?: string;
  customerCity?: string;
  customerCep?: string;
  paymentMethod?: string;
  notes?: string;
  shippingCost?: number;
  items: Array<{
    product: ProductSnapshot;
    quantity: number;
  }>;
};

function generateOrderNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `GM-${datePart}-${randomPart}`;
}

function normalizePayload(body: unknown): CreateOrderParams {
  if (!body || typeof body !== "object") {
    throw new Error("Payload de pedido invalido.");
  }

  const payload = body as Partial<CreateOrderParams>;
  const items = Array.isArray(payload.items) ? payload.items : [];
  const normalizedItems = items
    .map((item) => {
      const quantity = Number(item?.quantity ?? 0);
      const product = item?.product;
      if (!product || typeof product !== "object") return null;
      if (!product.id || !product.name || !Number.isFinite(quantity) || quantity <= 0) return null;

      return {
        quantity,
        product: {
          id: String(product.id),
          old_id: product.old_id ?? null,
          name: String(product.name),
          employee_price: Number(product.employee_price ?? 0),
        },
      };
    })
    .filter(Boolean) as CreateOrderParams["items"];

  return {
    customerPhone: String(payload.customerPhone ?? "").replace(/\D/g, ""),
    customerName: String(payload.customerName ?? "").trim(),
    customerDocumentCpf: String(payload.customerDocumentCpf ?? "").replace(/\D/g, "").slice(0, 11),
    customerAddress: String(payload.customerAddress ?? "").trim(),
    customerCity: String(payload.customerCity ?? "").trim(),
    customerCep: String(payload.customerCep ?? "").replace(/\D/g, "").slice(0, 8),
    paymentMethod: String(payload.paymentMethod ?? "").trim(),
    notes: String(payload.notes ?? "").trim(),
    shippingCost: Number(payload.shippingCost ?? 0),
    items: normalizedItems,
  };
}

async function createOrderInDatabase(params: CreateOrderParams) {
  const {
    customerPhone,
    customerName,
    customerDocumentCpf,
    customerAddress,
    customerCity,
    customerCep,
    paymentMethod,
    notes,
    shippingCost = 0,
    items,
  } = params;

  if (!customerName || customerName.length < 3) throw new Error("Nome do cliente invalido.");
  if (!customerPhone || customerPhone.length < 10) throw new Error("Telefone do cliente invalido.");
  if (!items.length) throw new Error("Nenhum item no carrinho.");

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemsTotal = items.reduce(
    (sum, item) => sum + (Number(item.product.employee_price) || 0) * item.quantity,
    0
  );
  const finalTotal = itemsTotal + Number(shippingCost || 0);
  const orderNumber = generateOrderNumber();

  const baseOrderPayload = {
    order_number: orderNumber,
    customer_phone: customerPhone,
    customer_document_cpf: customerDocumentCpf || null,
    customer_address: customerAddress || null,
    customer_city: customerCity || null,
    customer_cep: customerCep || null,
    total_items: totalItems,
    total_value: finalTotal,
    total_cents: Math.round(finalTotal * 100),
    payment_method: paymentMethod || null,
    notes: notes || null,
    status: "recebido",
    metadata: {
      customer_name: customerName,
      items_total: itemsTotal,
      shipping_cost: Number(shippingCost || 0),
    },
  };

  const supabase = getSupabaseAdminClient();
  const nextSchemaPayload = {
    ...baseOrderPayload,
    customer_name: customerName,
    shipping_cost: Number(shippingCost || 0),
    shipping_cents: Math.round(Number(shippingCost || 0) * 100),
  };
  const legacySchemaPayload = {
    ...baseOrderPayload,
    employee_cpf: customerPhone,
    employee_name: customerName,
  };

  let order:
    | {
        id: string;
        order_number: string | null;
      }
    | null = null;

  const nextSchemaResult = await supabase
    .from("orders")
    .insert(nextSchemaPayload)
    .select("id, order_number")
    .single();

  order = nextSchemaResult.data;
  if (nextSchemaResult.error) {
    const message = String(nextSchemaResult.error.message || "").toLowerCase();
    const missingColumn =
      message.includes("customer_name") ||
      message.includes("shipping_cost") ||
      message.includes("shipping_cents");

    if (!missingColumn) throw nextSchemaResult.error;

    const legacyResult = await supabase
      .from("orders")
      .insert(legacySchemaPayload)
      .select("id, order_number")
      .single();

    if (legacyResult.error || !legacyResult.data) {
      throw legacyResult.error ?? new Error("Erro ao criar pedido.");
    }

    order = legacyResult.data;
  }

  if (!order) throw new Error("Erro ao criar pedido.");

  const itemsPayload = items.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_old_id: item.product.old_id ?? null,
    product_name: item.product.name,
    unit_price: Number(item.product.employee_price) || 0,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(itemsPayload);
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw itemsError;
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number ?? orderNumber,
    total: finalTotal,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = normalizePayload(req.body);
    const order = await createOrderInDatabase(payload);
    return res.status(200).json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar pedido.";
    return res.status(400).json({ error: message });
  }
}
