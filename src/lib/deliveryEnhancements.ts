const METRICS_KEY = "gm_delivery_metrics_v1";

type DeliveryMetrics = {
  abandonedCartCount: number;
  startedCheckoutCount: number;
  finishedOrderCount: number;
};

function getMetrics(): DeliveryMetrics {
  try {
    const raw = localStorage.getItem(METRICS_KEY);
    if (!raw) return { abandonedCartCount: 0, startedCheckoutCount: 0, finishedOrderCount: 0 };
    const parsed = JSON.parse(raw);
    return {
      abandonedCartCount: Number(parsed?.abandonedCartCount ?? 0),
      startedCheckoutCount: Number(parsed?.startedCheckoutCount ?? 0),
      finishedOrderCount: Number(parsed?.finishedOrderCount ?? 0),
    };
  } catch {
    return { abandonedCartCount: 0, startedCheckoutCount: 0, finishedOrderCount: 0 };
  }
}

function setMetrics(metrics: DeliveryMetrics) {
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
}

export function incrementMetric(field: keyof DeliveryMetrics) {
  const m = getMetrics();
  m[field] += 1;
  setMetrics(m);
}

export function getDeliveryMetrics() {
  return getMetrics();
}

const DRAFT_KEY = "gm_cart_draft_marker_v1";

export function markCartDraft(hasItems: boolean) {
  if (!hasItems) {
    localStorage.removeItem(DRAFT_KEY);
    return;
  }
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      markedAt: Date.now(),
    })
  );
}

export function captureAbandonmentIfNeeded() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const markedAt = Number(parsed?.markedAt ?? 0);
    if (!markedAt) return;
    // Considera abandono após 15 min sem finalizar
    if (Date.now() - markedAt > 15 * 60 * 1000) {
      incrementMetric("abandonedCartCount");
      localStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // ignore
  }
}

export const DELIVERY_STATUSES = [
  "recebido",
  "em_preparo",
  "saiu_para_entrega",
  "entregue",
  "cancelado",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export function statusLabel(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "recebido" || s === "aguardando_separacao") return "Recebido";
  if (s === "em_preparo" || s === "em_separacao") return "Em preparo";
  if (s === "saiu_para_entrega" || s === "pronto_para_retirada") return "Saiu para entrega";
  if (s === "entregue") return "Entregue";
  if (s === "cancelado") return "Cancelado";
  return "Recebido";
}
