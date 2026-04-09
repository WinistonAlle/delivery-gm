type PriceableProduct = {
  employee_price?: number | null;
  price?: number | null;
  weight?: number | string | null;
  packageInfo?: string | null;
  package_info?: string | null;
  name?: string | null;
};

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

export function getDisplayProductPrice(product: PriceableProduct): number {
  const basePrice = getStoredProductPrice(product);
  const weight = getProductWeightKg(product);

  if (weight > 1) {
    return roundCurrency(basePrice * weight);
  }

  return roundCurrency(basePrice);
}
