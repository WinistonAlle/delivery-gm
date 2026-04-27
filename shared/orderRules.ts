export type ShippingRate = {
  city: string;
  cost: number;
};

export const SHIPPING_RATES: ShippingRate[] = [
  { city: "Águas Claras", cost: 10 },
  { city: "Águas Lindas", cost: 10 },
  { city: "Candangolândia", cost: 15 },
  { city: "Ceilândia", cost: 10 },
  { city: "Gama", cost: 15 },
  { city: "Guará", cost: 15 },
  { city: "Jardim Botânico", cost: 15 },
  { city: "Núcleo Bandeirante", cost: 15 },
  { city: "Octogonal", cost: 15 },
  { city: "Parkway", cost: 15 },
  { city: "Planaltina", cost: 15 },
  { city: "Planaltina DF", cost: 15 },
  { city: "Plano Piloto e Região", cost: 15 },
  { city: "Recanto das Emas", cost: 15 },
  { city: "Riacho Fundo", cost: 15 },
  { city: "Samambaia", cost: 10 },
  { city: "Santa Maria", cost: 15 },
  { city: "Santo Antonio", cost: 15 },
  { city: "São Sebastião", cost: 15 },
  { city: "Sobradinho", cost: 15 },
  { city: "Taguatinga", cost: 10 },
  { city: "Valparaíso", cost: 15 },
  { city: "Vicente Pires", cost: 10 },
];

export const FREE_SHIPPING_THRESHOLD = 150;
export const MIN_PACKAGES = 5;
export const MIN_WEIGHT_KG = 5;

export function normalizeMatch(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getShippingRateByCity(city: string) {
  const normalizedCity = normalizeMatch(city);
  return SHIPPING_RATES.find((entry) => normalizeMatch(entry.city) === normalizedCity) ?? null;
}

export function isFreeShippingEligible(itemsTotal: number) {
  return itemsTotal >= FREE_SHIPPING_THRESHOLD;
}

export function getShippingCostForCity(city: string, itemsTotal: number) {
  const rate = getShippingRateByCity(city);
  if (!rate) return null;
  if (isFreeShippingEligible(itemsTotal)) return 0;
  return rate.cost;
}

export function meetsMinimumOrder(params: { packageCount: number; totalWeightKg: number }) {
  return params.packageCount >= MIN_PACKAGES || params.totalWeightKg >= MIN_WEIGHT_KG;
}
