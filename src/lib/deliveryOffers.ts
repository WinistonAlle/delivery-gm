import type { Product } from "@/types/products";
import { supabase } from "@/lib/supabase";

const CATEGORY_NAME_BY_ID: Record<number, string> = {
  1: "Pão de Queijo",
  2: "Salgados Assados",
  3: "Salgados P/ Fritar",
  4: "Pães e Massas Doces",
  5: "Biscoito de Queijo",
  6: "Salgados Grandes",
  7: "Alho em creme",
  8: "Outros",
};

const LS_COMBOS_KEY = "gm_admin_delivery_combos_v1";
const LS_CART_REC_KEY = "gm_admin_delivery_rec_cart_v1";
const LS_CHECKOUT_REC_KEY = "gm_admin_delivery_rec_checkout_v1";
const LS_CROSS_SELL_KEY = "gm_admin_delivery_cross_sell_v1";

export type OfferPlacement = "cart" | "checkout";

export type DeliveryComboConfig = {
  id: string;
  title: string;
  description: string;
  badge: string;
  is_active: boolean;
  sort_order: number;
  items: { product_id: string; quantity: number }[];
};

export type DeliveryComboResolved = {
  id: string;
  title: string;
  description: string;
  badge: string;
  is_active: boolean;
  sort_order: number;
  items: { product: Product; quantity: number }[];
  total: number;
};

export type CrossSellRule = {
  id: string;
  source_product_id: string;
  target_product_id: string;
  priority: number;
  is_active: boolean;
};

type ProductCategory = Product["category"];

type ProductRow = Record<string, unknown> & {
  id?: string | null;
  old_id?: number | string | null;
  name?: string | null;
  price?: number | string | null;
  employee_price?: number | string | null;
  images?: string[] | null;
  image?: string | null;
  image_path?: string | null;
  category_id?: number | string | null;
  category?: string | null;
  category_name?: string | null;
  description?: string | null;
  packageInfo?: string | null;
  package_info?: string | null;
  weight?: number | string | null;
  isPackage?: boolean | null;
  is_package?: boolean | null;
  featured?: boolean | null;
  isFeatured?: boolean | null;
  inStock?: boolean | null;
  in_stock?: boolean | null;
  isLaunch?: boolean | null;
  is_launch?: boolean | null;
  extraInfo?: Product["extraInfo"];
};

type ComboRow = Record<string, unknown> & {
  id?: string | number | null;
  title?: string | null;
  description?: string | null;
  badge?: string | null;
  is_active?: boolean | null;
  sort_order?: number | string | null;
};

type ComboItemRow = Record<string, unknown> & {
  id?: string | number | null;
  combo_id?: string | number | null;
  product_id?: string | number | null;
  quantity?: number | string | null;
};

type RecommendationRow = Record<string, unknown> & {
  id?: string | number | null;
  placement?: string | null;
  product_id?: string | number | null;
  priority?: number | string | null;
  is_active?: boolean | null;
};

type CrossSellRow = Record<string, unknown> & {
  id?: string | number | null;
  source_product_id?: string | number | null;
  target_product_id?: string | number | null;
  priority?: number | string | null;
  is_active?: boolean | null;
};

type IdRow = Record<string, unknown> & {
  id?: string | number | null;
};

const CATEGORY_VALUES: ProductCategory[] = [
  "Salgados P/ Fritar",
  "Salgados Assados",
  "Pães e Massas Doces",
  "Pão de Queijo",
  "Biscoito de Queijo",
  "Kits e Combos",
  "Salgados Grandes",
  "Alho em creme",
  "Outros",
];

function isProductCategory(value: string): value is ProductCategory {
  return CATEGORY_VALUES.includes(value as ProductCategory);
}

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = <T>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore localStorage errors
  }
};

function mapRowToProduct(row: ProductRow): Product {
  const employeePrice = Number(row.employee_price ?? row.price ?? 0);
  const categoryName =
    CATEGORY_NAME_BY_ID[Number(row.category_id ?? 0)] ??
    row.category ??
    row.category_name ??
    "Outros";
  const normalizedCategory = isProductCategory(categoryName) ? categoryName : "Outros";

  return {
    id: String(row.id ?? ""),
    old_id: row.old_id == null ? null : Number(row.old_id),
    name: row.name ?? "",
    price: employeePrice,
    employee_price: employeePrice,
    images: row.images ?? (row.image ? [row.image] : []),
    image_path: row.image_path ?? null,
    category: normalizedCategory,
    description: row.description ?? "",
    packageInfo: row.packageInfo ?? row.package_info ?? "",
    weight: Number(row.weight ?? 0),
    isPackage: row.isPackage ?? row.is_package ?? false,
    featured: row.featured ?? row.isFeatured ?? false,
    inStock: row.inStock ?? row.in_stock ?? true,
    isLaunch: row.isLaunch ?? row.is_launch ?? false,
    extraInfo: row.extraInfo ?? undefined,
  };
}

function resolveCombos(
  combos: Omit<DeliveryComboConfig, "items">[],
  comboItems: { combo_id: string; product_id: string; quantity: number }[],
  productsById: Map<string, Product>
): DeliveryComboResolved[] {
  return combos
    .map((combo) => {
      const items = comboItems
        .filter((item) => item.combo_id === combo.id)
        .map((item) => ({
          product: productsById.get(String(item.product_id)),
          quantity: Math.max(1, Number(item.quantity ?? 1)),
        }))
        .filter((item) => !!item.product) as { product: Product; quantity: number }[];

      const total = items.reduce(
        (sum, item) =>
          sum + Number(item.product.employee_price ?? item.product.price ?? 0) * item.quantity,
        0
      );

      return { ...combo, items, total };
    })
    .filter((combo) => combo.items.length > 0)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function fetchCatalogProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ProductRow[]).map(mapRowToProduct);
}

export async function loadPublicCombos(products: Product[]): Promise<DeliveryComboResolved[]> {
  const productsById = new Map(products.map((p) => [String(p.id), p]));

  try {
    const { data: combosData, error: cErr } = await supabase
      .from("delivery_combos")
      .select("id,title,description,badge,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (cErr) throw cErr;

    const comboRows = (combosData ?? []) as ComboRow[];
    const comboIds = comboRows.map((combo) => String(combo.id));
    if (!comboIds.length) return [];

    const { data: itemsData, error: iErr } = await supabase
      .from("delivery_combo_items")
      .select("combo_id,product_id,quantity")
      .in("combo_id", comboIds)
      .order("id", { ascending: true });
    if (iErr) throw iErr;
    const itemRows = (itemsData ?? []) as ComboItemRow[];

    return resolveCombos(
      comboRows.map((combo) => ({
        id: String(combo.id),
        title: combo.title ?? "",
        description: combo.description ?? "",
        badge: combo.badge ?? "",
        is_active: !!combo.is_active,
        sort_order: Number(combo.sort_order ?? 0),
      })),
      itemRows.map((item) => ({
        combo_id: String(item.combo_id),
        product_id: String(item.product_id),
        quantity: Number(item.quantity ?? 1),
      })),
      productsById
    );
  } catch {
    const localCombos = readJson<DeliveryComboConfig[]>(LS_COMBOS_KEY, []);
    const activeCombos = localCombos.filter((c) => c.is_active);
    return activeCombos
      .map((combo) => {
        const items = (combo.items ?? [])
          .map((item) => ({
            product: productsById.get(String(item.product_id)),
            quantity: Math.max(1, Number(item.quantity ?? 1)),
          }))
          .filter((item) => !!item.product) as { product: Product; quantity: number }[];
        const total = items.reduce(
          (sum, item) =>
            sum + Number(item.product.employee_price ?? item.product.price ?? 0) * item.quantity,
          0
        );
        return { ...combo, items, total };
      })
      .filter((combo) => combo.items.length > 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  }
}

export async function loadPlacementRecommendations(
  placement: OfferPlacement,
  products: Product[]
): Promise<Product[]> {
  const productsById = new Map(products.map((p) => [String(p.id), p]));
  try {
    const { data, error } = await supabase
      .from("delivery_recommendations")
      .select("product_id,priority,is_active")
      .eq("placement", placement)
      .eq("is_active", true)
      .order("priority", { ascending: true });
    if (error) throw error;

    return ((data ?? []) as RecommendationRow[])
      .map((row) => productsById.get(String(row.product_id)))
      .filter(Boolean) as Product[];
  } catch {
    const key = placement === "cart" ? LS_CART_REC_KEY : LS_CHECKOUT_REC_KEY;
    const ids = readJson<string[]>(key, []);
    return ids.map((id) => productsById.get(String(id))).filter(Boolean) as Product[];
  }
}

export async function loadCrossSellMap(products: Product[]): Promise<Record<string, Product[]>> {
  const productsById = new Map(products.map((p) => [String(p.id), p]));
  const map: Record<string, Product[]> = {};

  try {
    const { data, error } = await supabase
      .from("delivery_cross_sell")
      .select("source_product_id,target_product_id,priority,is_active")
      .eq("is_active", true)
      .order("priority", { ascending: true });
    if (error) throw error;

    ((data ?? []) as CrossSellRow[]).forEach((row) => {
      const sourceId = String(row.source_product_id);
      const target = productsById.get(String(row.target_product_id));
      if (!target) return;
      if (!map[sourceId]) map[sourceId] = [];
      map[sourceId].push(target);
    });

    return map;
  } catch {
    const rules = readJson<CrossSellRule[]>(LS_CROSS_SELL_KEY, []).filter((r) => r.is_active);
    rules
      .sort((a, b) => a.priority - b.priority)
      .forEach((rule) => {
        const sourceId = String(rule.source_product_id);
        const target = productsById.get(String(rule.target_product_id));
        if (!target) return;
        if (!map[sourceId]) map[sourceId] = [];
        map[sourceId].push(target);
      });

    return map;
  }
}

export async function loadAdminOfferConfig() {
  try {
    const [products, combosData, itemsData, recData, crossSellData] = await Promise.all([
      fetchCatalogProducts(),
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
    ]);

    if (combosData.error || itemsData.error || recData.error || crossSellData.error) {
      throw (
        combosData.error ||
        itemsData.error ||
        recData.error ||
        crossSellData.error
      );
    }

    const comboRows = (combosData.data ?? []) as ComboRow[];
    const itemRows = (itemsData.data ?? []) as ComboItemRow[];
    const recommendationRows = (recData.data ?? []) as RecommendationRow[];
    const crossSellRows = (crossSellData.data ?? []) as CrossSellRow[];

    const combos: DeliveryComboConfig[] = comboRows.map((combo) => ({
      id: String(combo.id),
      title: combo.title ?? "",
      description: combo.description ?? "",
      badge: combo.badge ?? "",
      is_active: !!combo.is_active,
      sort_order: Number(combo.sort_order ?? 0),
      items: itemRows
        .filter((item) => String(item.combo_id) === String(combo.id))
        .map((item) => ({
          product_id: String(item.product_id),
          quantity: Number(item.quantity ?? 1),
        })),
    }));

    const cartRecommendationIds = recommendationRows
      .filter((row) => row.placement === "cart" && row.is_active)
      .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))
      .map((row) => String(row.product_id));

    const checkoutRecommendationIds = recommendationRows
      .filter((row) => row.placement === "checkout" && row.is_active)
      .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))
      .map((row) => String(row.product_id));

    const crossSellRules: CrossSellRule[] = crossSellRows.map((row) => ({
      id: String(row.id),
      source_product_id: String(row.source_product_id),
      target_product_id: String(row.target_product_id),
      priority: Number(row.priority ?? 0),
      is_active: !!row.is_active,
    }));

    return {
      products,
      combos,
      cartRecommendationIds,
      checkoutRecommendationIds,
      crossSellRules,
      mode: "supabase" as const,
    };
  } catch {
    const products = readJson<Product[]>("gm_catalog_products_v1", []);
    const combos = readJson<DeliveryComboConfig[]>(LS_COMBOS_KEY, []);
    const cartRecommendationIds = readJson<string[]>(LS_CART_REC_KEY, []);
    const checkoutRecommendationIds = readJson<string[]>(LS_CHECKOUT_REC_KEY, []);
    const crossSellRules = readJson<CrossSellRule[]>(LS_CROSS_SELL_KEY, []);

    return {
      products,
      combos,
      cartRecommendationIds,
      checkoutRecommendationIds,
      crossSellRules,
      mode: "local" as const,
    };
  }
}

export async function saveAdminOfferConfig(input: {
  combos: DeliveryComboConfig[];
  cartRecommendationIds: string[];
  checkoutRecommendationIds: string[];
  crossSellRules: CrossSellRule[];
}) {
  const combos = input.combos.map((combo, idx) => ({
    id: combo.id,
    title: combo.title?.trim() || "Combo sem nome",
    description: combo.description ?? "",
    badge: combo.badge ?? "",
    is_active: !!combo.is_active,
    sort_order: Number(combo.sort_order ?? idx + 1),
    items: (combo.items ?? [])
      .filter((item) => item.product_id)
      .map((item) => ({
        product_id: String(item.product_id),
        quantity: Math.max(1, Number(item.quantity ?? 1)),
      })),
  }));

  const cartRecommendationIds = Array.from(new Set(input.cartRecommendationIds.map(String)));
  const checkoutRecommendationIds = Array.from(new Set(input.checkoutRecommendationIds.map(String)));
  const crossSellRules = input.crossSellRules
    .map((rule, idx) => ({
      id: rule.id,
      source_product_id: String(rule.source_product_id),
      target_product_id: String(rule.target_product_id),
      priority: Number(rule.priority ?? idx + 1),
      is_active: !!rule.is_active,
    }))
    .filter((rule) => rule.source_product_id && rule.target_product_id);

  try {
    const { data: existingCombos, error: existingErr } = await supabase
      .from("delivery_combos")
      .select("id");
    if (existingErr) throw existingErr;

    const existingIds = new Set(((existingCombos ?? []) as IdRow[]).map((row) => String(row.id)));
    const incomingIds = new Set(combos.map((combo) => String(combo.id)));

    const deleteIds = Array.from(existingIds).filter((id) => !incomingIds.has(id));
    if (deleteIds.length) {
      for (const id of deleteIds) {
        await supabase.from("delivery_combo_items").delete().eq("combo_id", id);
        await supabase.from("delivery_combos").delete().eq("id", id);
      }
    }

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

    if (combos.length) {
      for (const combo of combos) {
        await supabase.from("delivery_combo_items").delete().eq("combo_id", combo.id);
      }
      const itemsToInsert = combos.flatMap((combo) =>
        combo.items.map((item) => ({
          combo_id: combo.id,
          product_id: item.product_id,
          quantity: item.quantity,
        }))
      );
      if (itemsToInsert.length) {
        const { error: itemsErr } = await supabase.from("delivery_combo_items").insert(itemsToInsert);
        if (itemsErr) throw itemsErr;
      }
    }

    await supabase.from("delivery_recommendations").delete().in("placement", ["cart", "checkout"]);
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

    await supabase.from("delivery_cross_sell").delete().neq("id", "00000000-0000-0000-0000-000000000000");
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

    return { mode: "supabase" as const };
  } catch {
    writeJson(LS_COMBOS_KEY, combos);
    writeJson(LS_CART_REC_KEY, cartRecommendationIds);
    writeJson(LS_CHECKOUT_REC_KEY, checkoutRecommendationIds);
    writeJson(LS_CROSS_SELL_KEY, crossSellRules);
    return { mode: "local" as const };
  }
}
