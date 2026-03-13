import type { Product } from "@/types/products";

function parseKgFromText(text: string): number | null {
  if (!text) return null;
  const normalized = text.toLowerCase().replace(",", ".");

  const kgMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kgMatch) {
    const v = Number(kgMatch[1]);
    if (Number.isFinite(v) && v > 0) return v;
  }

  const gMatch = normalized.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (gMatch) {
    const grams = Number(gMatch[1]);
    if (Number.isFinite(grams) && grams > 0) return grams / 1000;
  }

  return null;
}

export function deriveWeightKg(product: Partial<Product> & { name?: string; packageInfo?: string }): number {
  const direct = Number((product as any).weight ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const fromPackageInfo = parseKgFromText((product.packageInfo || "").toString());
  if (fromPackageInfo) return fromPackageInfo;

  const fromName = parseKgFromText((product.name || "").toString());
  if (fromName) return fromName;

  return 0;
}

export function deriveIsPackage(product: Partial<Product> & { name?: string; packageInfo?: string }): boolean {
  const explicit = (product as any).isPackage;
  if (typeof explicit === "boolean" && explicit) return true;

  const weight = deriveWeightKg(product);
  if (weight > 0 && weight <= 1.05) return true;

  const text = `${product.name || ""} ${product.packageInfo || ""}`.toLowerCase();
  if (
    /\bpct\b/.test(text) ||
    /\bpacote\b/.test(text) ||
    /\bpac\s*\d+/i.test(text) ||
    /\bpote\b/.test(text) ||
    /\bkit\b/.test(text) ||
    /\bcombo\b/.test(text) ||
    /\d+\s*unid/.test(text) ||
    /\d+\s*un\b/.test(text) ||
    /pacote\s+com\s+\d+/.test(text)
  ) {
    return true;
  }

  return false;
}
