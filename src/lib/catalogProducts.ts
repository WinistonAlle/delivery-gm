import type { Category, Product } from "@/types/products";

const CATEGORY_NAME_BY_ID: Record<number, Category> = {
  1: "Pão de Queijo",
  2: "Salgados Assados",
  3: "Salgados P/ Fritar",
  4: "Pães e Massas Doces",
  5: "Biscoito de Queijo",
  6: "Salgados Grandes",
  7: "Alho em creme",
  8: "Outros",
};

const CATEGORY_VALUES: Category[] = [
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
  saleType?: Product["saleType"] | null;
  sale_type?: Product["saleType"] | null;
  weight?: number | string | null;
  isPackage?: boolean | null;
  is_package?: boolean | null;
  featured?: boolean | null;
  isFeatured?: boolean | null;
  inStock?: boolean | null;
  in_stock?: boolean | null;
  isLaunch?: boolean | null;
  is_launch?: boolean | null;
  extraInfo?: Product["extraInfo"] | null;
  extra_info?: Product["extraInfo"] | null;
};

type ProductPriceRow = {
  product_id?: string | null;
  price_table?: string | null;
  price?: number | string | null;
};

function isCategory(value: string): value is Category {
  return CATEGORY_VALUES.includes(value as Category);
}

function resolveCategory(row: ProductRow): Category {
  const categoryName =
    CATEGORY_NAME_BY_ID[Number(row.category_id ?? 0)] ??
    row.category ??
    row.category_name ??
    "Outros";

  return isCategory(String(categoryName)) ? (categoryName as Category) : "Outros";
}

function resolveImages(row: ProductRow): string[] {
  if (Array.isArray(row.images)) {
    return row.images.filter((value): value is string => typeof value === "string" && Boolean(value));
  }

  if (typeof row.images === "string" && row.images.trim()) {
    return row.images
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof row.image === "string" && row.image.trim()) return [row.image];
  if (typeof row.image_path === "string" && row.image_path.trim()) return [row.image_path];
  return [];
}

export function mapCatalogProductRow(row: ProductRow): Product {
  const employeePrice = Number(row.employee_price ?? row.price ?? 0);
  const images = resolveImages(row);
  const priceTables = {
    varejo: employeePrice,
  };

  return {
    id: String(row.id ?? ""),
    old_id: row.old_id == null ? null : Number(row.old_id),
    name: String(row.name ?? ""),
    price: employeePrice,
    employee_price: employeePrice,
    price_tables: priceTables,
    priceTablePrices: priceTables,
    images,
    image_path: row.image_path ?? (images[0] ?? null),
    category: resolveCategory(row),
    description: String(row.description ?? ""),
    packageInfo: String(row.packageInfo ?? row.package_info ?? ""),
    saleType: row.saleType === "pct" || row.sale_type === "pct" ? "pct" : "kg",
    weight: Number(row.weight ?? 0),
    isPackage: row.isPackage ?? row.is_package ?? false,
    featured: row.featured ?? row.isFeatured ?? false,
    inStock: row.inStock ?? row.in_stock ?? true,
    isLaunch: row.isLaunch ?? row.is_launch ?? false,
    extraInfo: (row.extraInfo ?? row.extra_info ?? undefined) as Product["extraInfo"] | undefined,
  };
}

export function attachProductPriceRows(products: Product[], rows: ProductPriceRow[]) {
  if (!rows.length) return products;

  const pricesByProductId = new Map<string, Partial<Record<"varejo" | "atacado_2", number>>>();
  for (const row of rows) {
    const productId = String(row.product_id ?? "").trim();
    const priceTable = String(row.price_table ?? "").trim();
    if (!productId || (priceTable !== "varejo" && priceTable !== "atacado_2")) continue;

    const price = Number(row.price ?? 0);
    if (!Number.isFinite(price) || price <= 0) continue;

    const current = pricesByProductId.get(productId) ?? {};
    current[priceTable] = price;
    pricesByProductId.set(productId, current);
  }

  return products.map((product) => {
    const tablePrices = pricesByProductId.get(String(product.id)) ?? {};
    const merged = {
      varejo: tablePrices.varejo ?? product.employee_price ?? product.price,
      ...tablePrices,
    };

    return {
      ...product,
      price: merged.varejo ?? product.price,
      employee_price: merged.varejo ?? product.employee_price,
      price_tables: merged,
      priceTablePrices: merged,
    };
  });
}

export function isVisibleCatalogProduct(product: Product) {
  return product.extraInfo?.hidden !== true;
}

export function mapVisibleCatalogProducts(rows: ProductRow[]) {
  return rows.map(mapCatalogProductRow).filter(isVisibleCatalogProduct);
}
