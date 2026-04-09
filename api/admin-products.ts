import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireAdminSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

type AdminProductPayload = {
  id: string;
  old_id: number | null;
  name: string;
  employee_price: number;
  sale_type: "kg" | "pct";
  unit: string;
  category_id: number | null;
  images: string[];
  image_path: string | null;
  description: string;
  package_info: string;
  is_package: boolean;
  featured: boolean;
  in_stock: boolean;
  is_launch: boolean;
  extra_info: Record<string, unknown>;
  weight?: number;
};

function normalizeProductId(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeExtraInfo(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function deleteProduct(productId: string) {
  const supabase = getSupabaseAdminClient();

  if (!productId) {
    throw new Error("Produto inválido.");
  }

  const cleanupTasks = [
    supabase.from("weight").delete().eq("product_id", productId),
    supabase.from("featured_products").delete().eq("product_id", productId),
    supabase.from("delivery_combo_items").delete().eq("product_id", productId),
    supabase.from("delivery_recommendations").delete().eq("product_id", productId),
    supabase.from("delivery_cross_sell").delete().eq("source_product_id", productId),
    supabase.from("delivery_cross_sell").delete().eq("target_product_id", productId),
    supabase.from("order_items").update({ product_id: null }).eq("product_id", productId),
  ];

  const cleanupResults = await Promise.all(cleanupTasks);
  const cleanupError = cleanupResults.find((result) => result.error)?.error;
  if (cleanupError) throw cleanupError;

  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw error;
}

async function listProducts() {
  const supabase = getSupabaseAdminClient();
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });
  if (productsError) throw productsError;

  const productIds = (products ?? [])
    .map((item) => String(item.id ?? "").trim())
    .filter(Boolean);

  if (!productIds.length) return products ?? [];

  const { data: weights, error: weightsError } = await supabase
    .from("weight")
    .select("product_id, weight")
    .in("product_id", productIds);

  if (weightsError) throw weightsError;

  const weightByProductId = new Map<string, number>();
  for (const row of weights ?? []) {
    const productId = String(row.product_id ?? "").trim();
    if (!productId) continue;
    const weight = Number(row.weight ?? 0);
    weightByProductId.set(productId, Number.isFinite(weight) ? weight : 0);
  }

  return (products ?? []).map((item) => ({
    ...item,
    weight: weightByProductId.get(String(item.id ?? "")) ?? Number(item.weight ?? 0),
  }));
}

function normalizePayload(input: unknown): AdminProductPayload {
  const payload = (input ?? {}) as Partial<AdminProductPayload>;
  const weight = Number(payload.weight ?? 0);

  return {
    id: normalizeProductId(payload.id),
    old_id: payload.old_id == null ? null : Number(payload.old_id),
    name: String(payload.name ?? "").trim(),
    employee_price: Number(payload.employee_price ?? 0),
    sale_type: payload.sale_type === "pct" ? "pct" : "kg",
    unit: String(payload.unit ?? "un").trim() || "un",
    category_id: payload.category_id == null ? null : Number(payload.category_id),
    images: normalizeImages(payload.images),
    image_path: payload.image_path ? String(payload.image_path) : null,
    description: String(payload.description ?? ""),
    package_info: String(payload.package_info ?? ""),
    is_package: Boolean(payload.is_package),
    featured: Boolean(payload.featured),
    in_stock: payload.in_stock !== false,
    is_launch: Boolean(payload.is_launch),
    extra_info: normalizeExtraInfo(payload.extra_info),
    weight: Number.isFinite(weight) ? weight : 0,
  };
}

async function saveProduct(input: unknown) {
  const payload = normalizePayload(input);
  if (!payload.id) throw new Error("Produto inválido.");
  if (!payload.name) throw new Error("Nome do produto é obrigatório.");

  const supabase = getSupabaseAdminClient();
  const { weight, ...productPayload } = payload;

  const { error: productError } = await supabase
    .from("products")
    .upsert(
      {
        ...productPayload,
        weight: Number(weight ?? 0),
      },
      { onConflict: "id" }
    );

  if (productError) throw productError;

  const { error: weightError } = await supabase
    .from("weight")
    .upsert(
      {
        product_id: payload.id,
        weight: Number(weight ?? 0),
      },
      { onConflict: "product_id" }
    );

  if (weightError) throw weightError;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  try {
    await requireAdminSession(req);

    if (req.method === "GET") {
      return res.status(200).json({ items: await listProducts() });
    }

    if (req.method === "POST") {
      await saveProduct(req.body);
      return res.status(200).json({ ok: true, items: await listProducts() });
    }

    if (req.method === "DELETE") {
      const productId = normalizeProductId(req.body?.id ?? req.query.id);
      await deleteProduct(productId);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    const message = error instanceof Error ? error.message : "Erro ao excluir produto.";
    return res.status(500).json({ error: message });
  }
}
