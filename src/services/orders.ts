import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/products";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CreateOrderParams {
  customerPhone: string;
  customerName: string;
  customerDocumentCpf?: string;
  customerAddress?: string;
  customerCity?: string;
  customerCep?: string;
  paymentMethod?: string;
  notes?: string;
  shippingCost?: number;
  items: CartItem[];
}

interface CreateOrderResponse {
  orderId: string;
  orderNumber: string;
  total: number;
}

function generateOrderNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `GM-${datePart}-${randomPart}`;
}

async function createOrderClientSide({
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
}: CreateOrderParams): Promise<CreateOrderResponse> {
  if (!items.length) {
    throw new Error("Nenhum item no carrinho.");
  }

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
    customer_document_cpf: customerDocumentCpf ?? null,
    customer_address: customerAddress ?? null,
    customer_city: customerCity ?? null,
    customer_cep: customerCep ?? null,
    total_items: totalItems,
    total_value: finalTotal,
    total_cents: Math.round(finalTotal * 100),
    payment_method: paymentMethod ?? null,
    notes: notes ?? null,
    status: "recebido",
    metadata: {
      customer_name: customerName,
      items_total: itemsTotal,
      shipping_cost: Number(shippingCost || 0),
    },
  };

  let order:
    | {
        id: string;
        order_number: string | null;
      }
    | null = null;
  let orderError: unknown = null;

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

  const nextSchemaResult = await supabase
    .from("orders")
    .insert(nextSchemaPayload)
    .select("id, order_number")
    .single();

  order = nextSchemaResult.data;
  orderError = nextSchemaResult.error;

  if (nextSchemaResult.error) {
    const message = String(nextSchemaResult.error.message || "").toLowerCase();
    const missingColumn =
      message.includes("customer_name") ||
      message.includes("shipping_cost") ||
      message.includes("shipping_cents");

    if (missingColumn) {
      const legacyResult = await supabase
        .from("orders")
        .insert(legacySchemaPayload)
        .select("id, order_number")
        .single();

      order = legacyResult.data;
      orderError = legacyResult.error;
    }
  }

  if (orderError || !order) {
    throw orderError ?? new Error("Erro ao criar pedido.");
  }

  const itemsPayload = items.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_old_id: item.product.old_id ?? null,
    product_name: item.product.name,
    unit_price: Number(item.product.employee_price) || 0,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(itemsPayload);
  if (itemsError) throw itemsError;

  return {
    orderId: order.id,
    orderNumber: order.order_number ?? orderNumber,
    total: finalTotal,
  };
}

export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResponse> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (response.ok) {
    return (await response.json()) as CreateOrderResponse;
  }

  const allowInsecureFallback = import.meta.env.VITE_ALLOW_CLIENT_SIDE_ORDER_WRITE === "true";
  if (!allowInsecureFallback) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Nao foi possivel registrar o pedido.");
  }

  return createOrderClientSide(params);
}
