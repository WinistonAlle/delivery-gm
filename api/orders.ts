import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireCustomerSession } from "./_lib/authSession";
import { upsertCustomerProfile } from "./_lib/customerProfiles";
import { assertRateLimit, isRateLimitError } from "./_lib/rateLimit";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";
import {
  FREE_SHIPPING_THRESHOLD,
  MIN_PACKAGES,
  MIN_WEIGHT_KG,
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
  couponCode?: string;
  items: Array<{
    product: ProductSnapshot;
    quantity: number;
  }>;
};

type CustomerCoupon = {
  id: string;
  code: string;
  customer_phone: string;
  type: "percent" | "free_shipping";
  value: number;
  used: boolean;
  expires_at: string;
};

const ALLOWED_PAYMENT_METHODS = new Set(["pix", "card", "cash"]);

function getRequestIp(req: VercelRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw ?? req.socket?.remoteAddress ?? "unknown")
    .split(",")[0]
    .trim();
}

function generateOrderNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `GM-${datePart}-${randomPart}`;
}

function normalizePayload(body: unknown): CreateOrderParams {
  if (!body || typeof body !== "object") {
    throw new Error("Payload de pedido inválido.");
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
    couponCode: String(payload.couponCode ?? "").trim() || undefined,
    discountAmount: Number(payload.discountAmount ?? 0),
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

function resolveShippingCost(
  city: string,
  itemsTotal: number,
  couponType?: CustomerCoupon["type"]
) {
  const rate = getShippingRateByCity(city);
  if (!rate) {
    throw new Error("Cidade de entrega inválida ou não atendida.");
  }

  if (itemsTotal >= FREE_SHIPPING_THRESHOLD || couponType === "free_shipping") return 0;

  return rate.cost;
}

async function validateCoupon(
  customerPhone: string,
  couponCode: string | undefined
): Promise<CustomerCoupon | null> {
  if (!couponCode) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_coupons")
    .select("id, code, customer_phone, type, value, used, expires_at")
    .eq("customer_phone", customerPhone)
    .eq("code", couponCode)
    .maybeSingle<CustomerCoupon>();

  if (error) throw error;
  if (!data) {
    throw new Error("Cupom inválido.");
  }
  if (data.used) {
    throw new Error("Cupom já utilizado.");
  }
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error("Cupom expirado.");
  }
  if (data.type !== "percent" && data.type !== "free_shipping") {
    throw new Error("Cupom inválido.");
  }

  return {
    ...data,
    value: Number(data.value ?? 0),
  };
}

async function reserveCoupon(coupon: CustomerCoupon | null) {
  if (!coupon) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_coupons")
    .update({ used: true })
    .eq("id", coupon.id)
    .eq("used", false)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  if (!data?.id) {
    throw new Error("Cupom indisponível. Atualize a página e tente novamente.");
  }

  return coupon;
}

async function releaseCouponReservation(coupon: CustomerCoupon | null) {
  if (!coupon) return;

  const supabase = getSupabaseAdminClient();
  await supabase.from("user_coupons").update({ used: false }).eq("id", coupon.id);
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
    couponCode,
    items,
  } = params;

  if (!customerName || customerName.length < 3) throw new Error("Nome do cliente inválido.");
  if (!customerPhone || customerPhone.length < 10) throw new Error("Telefone do cliente inválido.");
  if (!customerAddress || customerAddress.length < 6) throw new Error("Endereço de entrega inválido.");
  if (!customerCity || customerCity.length < 2) throw new Error("Cidade de entrega inválida.");
  if (!paymentMethod || !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    throw new Error("Forma de pagamento inválida.");
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
  const totalWeightKg = items.reduce((sum, item) => {
    return sum + deriveWeightKg(item.product) * item.quantity;
  }, 0);

  if (!meetsMinimumOrder({ packageCount, totalWeightKg })) {
    throw new Error(
      `Pedido mínimo: ${MIN_PACKAGES} pacotes ou ${MIN_WEIGHT_KG} kg em produtos.`
    );
  }

  const coupon = await validateCoupon(customerPhone, couponCode);
  const reservedCoupon = await reserveCoupon(coupon);
  const normalizedShippingCost = resolveShippingCost(customerCity, itemsTotal, reservedCoupon?.type);
  const safeDiscount =
    reservedCoupon?.type === "percent"
      ? Math.min(itemsTotal, Math.max(0, Math.round(itemsTotal * reservedCoupon.value) / 100))
      : 0;
  const finalTotal = Math.max(0, itemsTotal + normalizedShippingCost - safeDiscount);
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
    coupon_code: reservedCoupon?.code || null,
    discount_cents: Math.round(safeDiscount * 100),
    metadata: {
      customer_name: customerName,
      items_total: itemsTotal,
      shipping_cost: normalizedShippingCost,
      discount: safeDiscount,
    },
  };

  const supabase = getSupabaseAdminClient();

  try {
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
  } catch (error) {
    await releaseCouponReservation(reservedCoupon);
    throw error;
  }
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
    const ip = getRequestIp(req);
    assertRateLimit(`orders:create:ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
    assertRateLimit(`orders:create:customer:${session.phone}`, { limit: 8, windowMs: 15 * 60 * 1000 });
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
    if (isRateLimitError(error)) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
      return res.status(429).json({ error: error.message });
    }
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : "Erro ao criar pedido.";
    return res.status(400).json({ error: message });
  }
}
