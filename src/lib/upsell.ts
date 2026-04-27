import type { CartItem, Product } from "@/types/products";
import { getDisplayProductPrice } from "../../shared/productPricing";

type ComboBlueprint = {
  id: string;
  title: string;
  description: string;
  badge: string;
  audienceLabel: string;
  occasionLabel: string;
  entries: Array<{ legacyId: number; quantity: number }>;
};

export type UpsellResolvedCombo = {
  id: string;
  title: string;
  description: string;
  badge: string;
  audienceLabel: string;
  occasionLabel: string;
  items: Array<{ product: Product; quantity: number }>;
  total: number;
};

export type ProductUpsellSuggestion = {
  title: string;
  description: string;
  product: Product;
};

export type CartUpsellSuggestion = {
  combo: UpsellResolvedCombo;
  matchedUnits: number;
  totalUnits: number;
  coverage: number;
  missingItems: Array<{ product: Product; quantity: number }>;
};

const COMBO_BLUEPRINTS: ComboBlueprint[] = [
  {
    id: "combo-cafe-manha",
    title: "Kit Café da Manhã",
    description:
      "Um café da manhã completo com sabor de padaria, com pão francês, rosca tipo húngara, pão de queijo premium, broa, biscoito meia lua e enroladinho de queijo.",
    badge: "Kit Café da Manhã",
    audienceLabel: "Rende café da manhã completo",
    occasionLabel: "Ideal para casa, revenda ou reposição",
    entries: [
      { legacyId: 40, quantity: 1 },
      { legacyId: 71, quantity: 1 },
      { legacyId: 10010, quantity: 2 },
      { legacyId: 50615, quantity: 1 },
      { legacyId: 50380, quantity: 1 },
      { legacyId: 50627, quantity: 1 },
    ],
  },
  {
    id: "combo-festinha-30",
    title: "Kit Festinha 30 Pessoas",
    description:
      "Serve até 30 convidados com variedade e praticidade, reunindo salgadinhos tradicionais, assados variados e um churros delicioso.",
    badge: "Kit Festa",
    audienceLabel: "Serve até 30 pessoas",
    occasionLabel: "Perfeito para evento prático",
    entries: [
      { legacyId: 20014, quantity: 1 },
      { legacyId: 20035, quantity: 1 },
      { legacyId: 20003, quantity: 1 },
      { legacyId: 50411, quantity: 1 },
      { legacyId: 50410, quantity: 1 },
      { legacyId: 20032, quantity: 1 },
    ],
  },
  {
    id: "combo-festinha-50",
    title: "Kit Festinha 50 Pessoas",
    description:
      "Um kit completo para receber até 50 convidados com salgadinhos variados e mais opções para dar aquele toque especial no evento.",
    badge: "Kit Festa",
    audienceLabel: "Serve até 50 pessoas",
    occasionLabel: "Melhor para evento maior",
    entries: [
      { legacyId: 20014, quantity: 1 },
      { legacyId: 20035, quantity: 1 },
      { legacyId: 20003, quantity: 1 },
      { legacyId: 50411, quantity: 1 },
      { legacyId: 50410, quantity: 1 },
      { legacyId: 20032, quantity: 1 },
      { legacyId: 20005, quantity: 1 },
      { legacyId: 50409, quantity: 1 },
      { legacyId: 50532, quantity: 1 },
      { legacyId: 50412, quantity: 1 },
    ],
  },
];

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const simplifyProductName = (name: string) =>
  normalizeText(name)
    .replace(/\bPCT\b.*$/g, "")
    .replace(/\bPACOTE\b.*$/g, "")
    .replace(/\b\d+(G|GR|KG|UNID|UNIDADES)\b/g, "")
    .replace(/\b(COM|C)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getProductQuantityInCart = (cartItems: CartItem[], productId: string) =>
  cartItems.find((item) => item.product.id === productId)?.quantity ?? 0;

export function getUpsellComboBlueprints() {
  return COMBO_BLUEPRINTS;
}

export function buildUpsellCombos(products: Product[]): UpsellResolvedCombo[] {
  const findProduct = (legacyId: number) =>
    products.find(
      (product) =>
        product.inStock !== false &&
        (Number(product.old_id ?? NaN) === legacyId || Number(product.id) === legacyId)
    );

  return COMBO_BLUEPRINTS.map((combo) => {
    const items = combo.entries
      .map(({ legacyId, quantity }) => {
        const product = findProduct(legacyId);
        return product ? { product, quantity } : null;
      })
      .filter(Boolean) as Array<{ product: Product; quantity: number }>;

    const total = items.reduce(
      (sum, item) => sum + getDisplayProductPrice(item.product) * item.quantity,
      0
    );

    return {
      id: combo.id,
      title: combo.title,
      description: combo.description,
      badge: combo.badge,
      audienceLabel: combo.audienceLabel,
      occasionLabel: combo.occasionLabel,
      items,
      total,
    };
  }).filter((combo) => combo.items.length > 0);
}

export function findProductUpgradeSuggestions(
  product: Product,
  products: Product[],
  limit = 2
): ProductUpsellSuggestion[] {
  const baseName = simplifyProductName(product.name);
  if (!baseName) return [];

  const currentWeight = Number(product.weight ?? 0);
  const currentPrice = getDisplayProductPrice(product);

  return products
    .filter((candidate) => {
      if (candidate.id === product.id || candidate.inStock === false) return false;
      if (candidate.category !== product.category) return false;

      const candidateBaseName = simplifyProductName(candidate.name);
      if (!candidateBaseName) return false;

      return (
        candidateBaseName === baseName ||
        candidateBaseName.includes(baseName) ||
        baseName.includes(candidateBaseName)
      );
    })
    .sort((a, b) => {
      const weightDiff = Number(b.weight ?? 0) - Number(a.weight ?? 0);
      if (weightDiff !== 0) return weightDiff;
      return getDisplayProductPrice(b) - getDisplayProductPrice(a);
    })
    .filter((candidate) => {
      const candidateWeight = Number(candidate.weight ?? 0);
      const candidatePrice = getDisplayProductPrice(candidate);
      return candidateWeight > currentWeight || candidatePrice > currentPrice;
    })
    .slice(0, limit)
    .map((candidate) => ({
      title: "Leve uma versao com mais rendimento",
      description:
        Number(candidate.weight ?? 0) > currentWeight
          ? `${candidate.name} entrega mais volume para a mesma ocasião.`
          : `${candidate.name} costuma funcionar melhor quando você quer reforçar o pedido.`,
      product: candidate,
    }));
}

export function findCartComboUpsell(
  cartItems: CartItem[],
  products: Product[]
): CartUpsellSuggestion | null {
  if (!cartItems.length || !products.length) return null;

  const combos = buildUpsellCombos(products);

  const suggestions = combos
    .map((combo) => {
      const totalUnits = combo.items.reduce((sum, item) => sum + item.quantity, 0);
      const matchedUnits = combo.items.reduce((sum, item) => {
        const cartQuantity = getProductQuantityInCart(cartItems, item.product.id);
        return sum + Math.min(cartQuantity, item.quantity);
      }, 0);

      const missingItems = combo.items
        .map((item) => {
          const cartQuantity = getProductQuantityInCart(cartItems, item.product.id);
          const missingQuantity = Math.max(0, item.quantity - cartQuantity);
          return missingQuantity > 0
            ? { product: item.product, quantity: missingQuantity }
            : null;
        })
        .filter(Boolean) as Array<{ product: Product; quantity: number }>;

      return {
        combo,
        matchedUnits,
        totalUnits,
        coverage: totalUnits > 0 ? matchedUnits / totalUnits : 0,
        missingItems,
      };
    })
    .filter((suggestion) => suggestion.matchedUnits > 0 && suggestion.missingItems.length > 0)
    .sort((a, b) => {
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      return a.missingItems.length - b.missingItems.length;
    });

  return suggestions[0] && suggestions[0].coverage >= 0.28 ? suggestions[0] : null;
}
