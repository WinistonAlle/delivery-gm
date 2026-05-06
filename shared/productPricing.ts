type PriceableProduct = {
  employee_price?: number | null;
  price?: number | null;
  price_tables?: Partial<Record<PriceTable, number | null>> | null;
  priceTablePrices?: Partial<Record<PriceTable, number | null>> | null;
  saleType?: "kg" | "pct" | null;
  sale_type?: "kg" | "pct" | null;
  weight?: number | string | null;
  packageInfo?: string | null;
  package_info?: string | null;
  name?: string | null;
};

export type PriceTable = "varejo" | "atacado_2";

export const WHOLESALE_PRICE_TABLE: PriceTable = "atacado_2";
export const RETAIL_PRICE_TABLE: PriceTable = "varejo";
export const WHOLESALE_THRESHOLD = 150;

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseKgFromText(text: string): number | null {
  if (!text) return null;

  const normalized = text.toLowerCase().replace(",", ".");

  const kgMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kgMatch) {
    const parsed = Number(kgMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const gramMatch = normalized.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (gramMatch) {
    const grams = Number(gramMatch[1]);
    if (Number.isFinite(grams) && grams > 0) return grams / 1000;
  }

  return null;
}

export function getProductWeightKg(product: PriceableProduct): number {
  const direct = Number(product.weight ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const packageInfo = String(product.packageInfo ?? product.package_info ?? "");
  const fromPackageInfo = parseKgFromText(packageInfo);
  if (fromPackageInfo) return fromPackageInfo;

  const fromName = parseKgFromText(String(product.name ?? ""));
  if (fromName) return fromName;

  return 0;
}

export function getStoredProductPrice(product: PriceableProduct): number {
  const value = Number(product.employee_price ?? product.price ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getStoredTablePrice(product: PriceableProduct, priceTable: PriceTable): number | null {
  const priceTables = product.price_tables ?? product.priceTablePrices ?? null;
  const tableValue = priceTables?.[priceTable];
  const parsed = Number(tableValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getProductSaleType(product: PriceableProduct): "kg" | "pct" {
  return product.saleType === "pct" || product.sale_type === "pct" ? "pct" : "kg";
}

export function getDisplayProductPrice(product: PriceableProduct): number {
  return getProductPrice(product, RETAIL_PRICE_TABLE);
}

export function getActivePriceTable(subtotal: number): PriceTable {
  const safeSubtotal = Number(subtotal);
  return Number.isFinite(safeSubtotal) && safeSubtotal >= WHOLESALE_THRESHOLD
    ? WHOLESALE_PRICE_TABLE
    : RETAIL_PRICE_TABLE;
}

export function getProductPrice(
  product: PriceableProduct,
  activePriceTable: PriceTable = RETAIL_PRICE_TABLE
): number {
  const tablePrice =
    activePriceTable === WHOLESALE_PRICE_TABLE
      ? getStoredTablePrice(product, WHOLESALE_PRICE_TABLE)
      : getStoredTablePrice(product, RETAIL_PRICE_TABLE);
  const basePrice = tablePrice ?? getStoredTablePrice(product, RETAIL_PRICE_TABLE) ?? getStoredProductPrice(product);
  const saleType = getProductSaleType(product);

  if (saleType === "pct") {
    return roundCurrency(basePrice);
  }

  const weight = getProductWeightKg(product);

  if (weight > 1) {
    return roundCurrency(basePrice * weight);
  }

  return roundCurrency(basePrice);
}

export function getRetailProductPrice(product: PriceableProduct): number {
  return getProductPrice(product, RETAIL_PRICE_TABLE);
}

export function getWholesaleRemaining(subtotal: number): number {
  const safeSubtotal = Number.isFinite(Number(subtotal)) ? Number(subtotal) : 0;
  return Math.max(0, roundCurrency(WHOLESALE_THRESHOLD - safeSubtotal));
}
