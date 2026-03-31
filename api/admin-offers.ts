import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireAdminSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

type AdminOfferConfigPayload = {
  combos?: Array<{
    id?: string;
    title?: string;
    description?: string;
    badge?: string;
    is_active?: boolean;
    sort_order?: number;
    items?: Array<{ product_id?: string; quantity?: number }>;
  }>;
  cartRecommendationIds?: string[];
  checkoutRecommendationIds?: string[];
  crossSellRules?: Array<{
    source_product_id?: string;
    target_product_id?: string;
    priority?: number;
    is_active?: boolean;
  }>;
  theme?: string;
};

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function asBool(value: unknown) {
  return Boolean(value);
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchTheme() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_theme_settings")
    .select("theme_key")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return asString(data?.theme_key) || "default";
}

async function listConfig() {
  const supabase = getSupabaseAdminClient();
  const [productsRes, combosRes, itemsRes, recRes, crossRes, theme] = await Promise.all([
    supabase.from("products").select("*").order("name", { ascending: true }),
    supabase
      .from("delivery_combos")
      .select("id,title,description,badge,is_active,sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("delivery_combo_items")
      .select("id,combo_id,product_id,quantity")
      .order("id", { ascending: true }),
    supabase
      .from("delivery_recommendations")
      .select("id,placement,product_id,priority,is_active")
      .order("priority", { ascending: true }),
    supabase
      .from("delivery_cross_sell")
      .select("id,source_product_id,target_product_id,priority,is_active")
      .order("priority", { ascending: true }),
    fetchTheme(),
  ]);

  if (
    productsRes.error ||
    combosRes.error ||
    itemsRes.error ||
    recRes.error ||
    crossRes.error
  ) {
    throw (
      productsRes.error ||
      combosRes.error ||
      itemsRes.error ||
      recRes.error ||
      crossRes.error
    );
  }

  const combos = (combosRes.data ?? []).map((combo: any) => ({
    id: String(combo.id),
    title: combo.title ?? "",
    description: combo.description ?? "",
    badge: combo.badge ?? "",
    is_active: !!combo.is_active,
    sort_order: Number(combo.sort_order ?? 0),
    items: (itemsRes.data ?? [])
      .filter((item: any) => String(item.combo_id) === String(combo.id))
      .map((item: any) => ({
        product_id: String(item.product_id),
        quantity: Number(item.quantity ?? 1),
      })),
  }));

  const cartRecommendationIds = (recRes.data ?? [])
    .filter((row: any) => row.placement === "cart" && row.is_active)
    .sort((a: any, b: any) => Number(a.priority ?? 0) - Number(b.priority ?? 0))
    .map((row: any) => String(row.product_id));

  const checkoutRecommendationIds = (recRes.data ?? [])
    .filter((row: any) => row.placement === "checkout" && row.is_active)
    .sort((a: any, b: any) => Number(a.priority ?? 0) - Number(b.priority ?? 0))
    .map((row: any) => String(row.product_id));

  const crossSellRules = (crossRes.data ?? []).map((row: any) => ({
    id: String(row.id),
    source_product_id: String(row.source_product_id),
    target_product_id: String(row.target_product_id),
    priority: Number(row.priority ?? 0),
    is_active: !!row.is_active,
  }));

  return {
    products: productsRes.data ?? [],
    combos,
    cartRecommendationIds,
    checkoutRecommendationIds,
    crossSellRules,
    theme,
    mode: "supabase" as const,
  };
}

async function saveConfig(body: AdminOfferConfigPayload) {
  const supabase = getSupabaseAdminClient();

  const combos = (body.combos ?? []).map((combo, idx) => ({
    id: asString(combo.id),
    title: asString(combo.title) || "Combo sem nome",
    description: String(combo.description ?? ""),
    badge: String(combo.badge ?? ""),
    is_active: asBool(combo.is_active),
    sort_order: asNumber(combo.sort_order, idx + 1),
    items: (combo.items ?? [])
      .map((item) => ({
        product_id: asString(item.product_id),
        quantity: Math.max(1, asNumber(item.quantity, 1)),
      }))
      .filter((item) => item.product_id),
  }));

  const cartRecommendationIds = Array.from(
    new Set((body.cartRecommendationIds ?? []).map((value) => asString(value)).filter(Boolean))
  );
  const checkoutRecommendationIds = Array.from(
    new Set((body.checkoutRecommendationIds ?? []).map((value) => asString(value)).filter(Boolean))
  );
  const crossSellRules = (body.crossSellRules ?? [])
    .map((rule, idx) => ({
      source_product_id: asString(rule.source_product_id),
      target_product_id: asString(rule.target_product_id),
      priority: asNumber(rule.priority, idx + 1),
      is_active: asBool(rule.is_active),
    }))
    .filter((rule) => rule.source_product_id && rule.target_product_id);

  const theme = asString(body.theme) || "default";

  const { data: existingCombos, error: existingErr } = await supabase
    .from("delivery_combos")
    .select("id");
  if (existingErr) throw existingErr;

  const { data: existingComboItems, error: existingItemsErr } = await supabase
    .from("delivery_combo_items")
    .select("id, combo_id, product_id");
  if (existingItemsErr) throw existingItemsErr;

  const { data: existingRecommendations, error: existingRecommendationsErr } = await supabase
    .from("delivery_recommendations")
    .select("id");
  if (existingRecommendationsErr) throw existingRecommendationsErr;

  const { data: existingCrossSell, error: existingCrossSellErr } = await supabase
    .from("delivery_cross_sell")
    .select("id");
  if (existingCrossSellErr) throw existingCrossSellErr;

  const existingIds = new Set((existingCombos ?? []).map((row: any) => String(row.id)));
  const incomingIds = new Set(combos.map((combo) => combo.id));
  const deleteIds = Array.from(existingIds).filter((id) => !incomingIds.has(id));

  if (combos.length) {
    const { error: upsertComboErr } = await supabase.from("delivery_combos").upsert(
      combos.map((combo) => ({
        id: combo.id,
        title: combo.title,
        description: combo.description,
        badge: combo.badge,
        is_active: combo.is_active,
        sort_order: combo.sort_order,
      })),
      { onConflict: "id" }
    );
    if (upsertComboErr) throw upsertComboErr;

    const itemsToInsert = combos.flatMap((combo) =>
      combo.items.map((item) => ({
        combo_id: combo.id,
        product_id: item.product_id,
        quantity: item.quantity,
      }))
    );
    if (itemsToInsert.length) {
      const { error: itemsErr } = await supabase
        .from("delivery_combo_items")
        .upsert(itemsToInsert, { onConflict: "combo_id,product_id" });
      if (itemsErr) throw itemsErr;
    }
  } else {
    const existingItemIds = (existingComboItems ?? []).map((row: any) => String(row.id)).filter(Boolean);
    if (existingItemIds.length) {
      const { error: clearItemsErr } = await supabase
        .from("delivery_combo_items")
        .delete()
        .in("id", existingItemIds);
      if (clearItemsErr) throw clearItemsErr;
    }

    if (existingIds.size) {
      const { error: clearCombosErr } = await supabase
        .from("delivery_combos")
        .delete()
        .in("id", Array.from(existingIds));
      if (clearCombosErr) throw clearCombosErr;
    }
  }

  const recRows = [
    ...cartRecommendationIds.map((productId, idx) => ({
      placement: "cart",
      product_id: productId,
      priority: idx + 1,
      is_active: true,
    })),
    ...checkoutRecommendationIds.map((productId, idx) => ({
      placement: "checkout",
      product_id: productId,
      priority: idx + 1,
      is_active: true,
    })),
  ];
  if (recRows.length) {
    const { error: recErr } = await supabase.from("delivery_recommendations").insert(recRows);
    if (recErr) throw recErr;
  }

  if (crossSellRules.length) {
    const { error: crossErr } = await supabase.from("delivery_cross_sell").insert(
      crossSellRules.map((rule) => ({
        source_product_id: rule.source_product_id,
        target_product_id: rule.target_product_id,
        priority: rule.priority,
        is_active: rule.is_active,
      }))
    );
    if (crossErr) throw crossErr;
  }

  const { error: themeErr } = await supabase
    .from("app_theme_settings")
    .upsert(
      {
        id: 1,
        theme_key: theme,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (themeErr) throw themeErr;

  const desiredComboKeys = new Set(
    combos.flatMap((combo) => combo.items.map((item) => `${combo.id}:${item.product_id}`))
  );
  const staleComboItemIds = (existingComboItems ?? [])
    .filter((row: any) => !desiredComboKeys.has(`${row.combo_id}:${row.product_id}`))
    .map((row: any) => String(row.id))
    .filter(Boolean);
  if (staleComboItemIds.length) {
    const { error: staleItemsErr } = await supabase
      .from("delivery_combo_items")
      .delete()
      .in("id", staleComboItemIds);
    if (staleItemsErr) throw staleItemsErr;
  }

  if (deleteIds.length) {
    const { error: deleteCombosErr } = await supabase
      .from("delivery_combos")
      .delete()
      .in("id", deleteIds);
    if (deleteCombosErr) throw deleteCombosErr;
  }

  const existingRecommendationIds = (existingRecommendations ?? [])
    .map((row: any) => String(row.id))
    .filter(Boolean);
  if (existingRecommendationIds.length) {
    const { error: clearRecErr } = await supabase
      .from("delivery_recommendations")
      .delete()
      .in("id", existingRecommendationIds);
    if (clearRecErr) throw clearRecErr;
  }

  const existingCrossSellIds = (existingCrossSell ?? [])
    .map((row: any) => String(row.id))
    .filter(Boolean);
  if (existingCrossSellIds.length) {
    const { error: clearCrossErr } = await supabase
      .from("delivery_cross_sell")
      .delete()
      .in("id", existingCrossSellIds);
    if (clearCrossErr) throw clearCrossErr;
  }

  return { mode: "supabase" as const };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  try {
    await requireAdminSession(req);

    if (req.method === "GET") {
      return res.status(200).json(await listConfig());
    }

    if (req.method === "POST") {
      return res.status(200).json(await saveConfig((req.body ?? {}) as AdminOfferConfigPayload));
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    const message = error instanceof Error ? error.message : "Erro ao salvar configuracoes.";
    return res.status(500).json({ error: message });
  }
}
