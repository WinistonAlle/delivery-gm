import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireCustomerSession } from "./_lib/authSession";
import { upsertCustomerProfile } from "./_lib/customerProfiles";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";
import {
  FREE_SHIPPING_THRESHOLD,
  MIN_ORDER_VALUE,
  MIN_PACKAGES,
  SHIPPING_RATES,
  getShippingRateByCity,
  meetsMinimumOrder,
  normalizeMatch,
} from "../shared/orderRules";
import { getDisplayProductPrice } from "../shared/productPricing";

type ProductSnapshot = {
  id: string;
  old_id?: number | null;
  name: string;
  employee_price: number;
  sale_type?: "kg" | "pct" | null;
  weight?: number | null;
  is_package?: boolean | null;
  package_info?: string | null;
  in_stock?: boolean | null;
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

const ALLOWED_PAYMENT_METHODS = new Set(["pix", "card", "cash"]);

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

function deriveWeightKg(product: ProductSnapshot) {
  const direct = Number(product.weight ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const normalizedPackageInfo = normalizeMatch(String(product.package_info ?? "")).replace(",", ".");
  const normalizedName = normalizeMatch(product.name).replace(",", ".");
  const parseKgFromText = (text: string) => {
    if (!text) return null;

    const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*kg\b/);
    if (kgMatch) {
      const parsed = Number(kgMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    const gramMatch = text.match(/(\d+(?:\.\d+)?)\s*g\b/);
    if (gramMatch) {
      const grams = Number(gramMatch[1]);
      if (Number.isFinite(grams) && grams > 0) return grams / 1000;
    }

    return null;
  };

  const fromPackageInfo = parseKgFromText(normalizedPackageInfo);
  if (fromPackageInfo) return fromPackageInfo;

  const fromName = parseKgFromText(normalizedName);
  if (fromName) return fromName;

  return 0;
}

function deriveIsPackage(product: ProductSnapshot) {
  if (product.is_package === true) return true;

  const weight = deriveWeightKg(product);
  if (weight > 0 && weight <= 1.05) return true;

  const text = normalizeMatch(`${product.name} ${product.package_info ?? ""}`);
  return (
    /\bpct\b/.test(text) ||
    /\bpacote\b/.test(text) ||
    /\bpac\s*\d+/.test(text) ||
    /\bpote\b/.test(text) ||
    /\bkit\b/.test(text) ||
    /\bcombo\b/.test(text) ||
    /\d+\s*unid/.test(text) ||
    /\d+\s*un\b/.test(text)
  );
}

function resolveShippingCost(city: string, itemsTotal: number) {
  const rate = getShippingRateByCity(city);
  if (!rate) {
    throw new Error("Cidade de entrega invalida ou nao atendida.");
  }

  if (itemsTotal >= FREE_SHIPPING_THRESHOLD) return 0;

  return rate.cost;
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
    items,
  } = params;

  if (!customerName || customerName.length < 3) throw new Error("Nome do cliente invalido.");
  if (!customerPhone || customerPhone.length < 10) throw new Error("Telefone do cliente invalido.");
  if (!customerAddress || customerAddress.length < 6) throw new Error("Endereco de entrega invalido.");
  if (!customerCity || customerCity.length < 2) throw new Error("Cidade de entrega invalida.");
  if (!paymentMethod || !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    throw new Error("Forma de pagamento invalida.");
  }
  if (!items.length) throw new Error("Nenhum item no carrinho.");

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemsTotal = items.reduce(
    (sum, item) => sum + getDisplayProductPrice(item.product) * item.quantity,
    0
  );
  const packageCount = items.reduce((sum, item) => {
    return deriveIsPackage(item.product) ? sum + item.quantity : sum;
  }, 0);

  if (!meetsMinimumOrder({ packageCount, orderValue: itemsTotal })) {
    throw new Error(
      `Pedido minimo: ${MIN_PACKAGES} pacotes ou R$ ${MIN_ORDER_VALUE.toFixed(2)} em produtos.`
    );
  }

  const normalizedShippingCost = resolveShippingCost(customerCity, itemsTotal);
  const finalTotal = itemsTotal + normalizedShippingCost;
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
      shipping_cost: normalizedShippingCost,
    },
  };

  const supabase = getSupabaseAdminClient();
  const nextSchemaPayload = {
    ...baseOrderPayload,
    customer_name: customerName,
    shipping_cost: normalizedShippingCost,
    shipping_cents: Math.round(normalizedShippingCost * 100),
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
    unit_price: getDisplayProductPrice(item.product),
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

async function resolveOrderItems(
  items: CreateOrderParams["items"]
): Promise<CreateOrderParams["items"]> {
  if (!items.length) {
    throw new Error("Nenhum item no carrinho.");
  }

  const supabase = getSupabaseAdminClient();
  const uniqueIds = Array.from(new Set(items.map((item) => String(item.product.id ?? "")).filter(Boolean)));
  const { data, error } = await supabase
      .from("products")
    .select("id, old_id, name, employee_price, sale_type, weight, is_package, package_info, in_stock")
    .in("id", uniqueIds);

  if (error) throw error;

  const productMap = new Map<string, ProductSnapshot>();
  for (const row of data ?? []) {
    productMap.set(String(row.id), {
        id: String(row.id),
        old_id: row.old_id ?? null,
        name: String(row.name ?? ""),
        employee_price: Number(row.employee_price ?? 0),
        sale_type: row.sale_type === "pct" ? "pct" : "kg",
        weight: Number(row.weight ?? 0),
        is_package: row.is_package ?? null,
        package_info: String(row.package_info ?? ""),
        in_stock: row.in_stock !== false,
      });
  }

  return items.map((item) => {
    const productId = String(item.product.id ?? "");
    const product = productMap.get(productId);

    if (!product) {
      throw new Error(`Produto inválido no pedido: ${productId}.`);
    }

    if (product.in_stock === false) {
      throw new Error(`Produto sem estoque: ${product.name}.`);
    }

    return {
      quantity: Number(item.quantity ?? 0),
      product,
    };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await requireCustomerSession(req);
    const payload = normalizePayload(req.body);
    const safeItems = await resolveOrderItems(payload.items);

    const normalizedPayload: CreateOrderParams = {
      ...payload,
      customerPhone: session.phone,
      customerName: payload.customerName || session.full_name,
      customerDocumentCpf: session.document_cpf || payload.customerDocumentCpf,
      items: safeItems,
    };

    const order = await createOrderInDatabase(normalizedPayload);

    try {
      await upsertCustomerProfile({
        fullName: normalizedPayload.customerName,
        phone: session.phone,
        documentCpf: normalizedPayload.customerDocumentCpf,
        cep: normalizedPayload.customerCep,
        address: normalizedPayload.customerAddress,
        city: normalizedPayload.customerCity,
        howFoundUs: session.how_found_us,
        howFoundUsDetails: session.how_found_us_details,
      });
    } catch (profileError) {
      console.error("Order created but customer profile sync failed", profileError);
    }

    return res.status(200).json(order);
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : "Erro ao criar pedido.";
    return res.status(400).json({ error: message });
  }
}
