import { supabase } from "@/lib/supabase";

const VISITOR_ID_KEY = "gm_delivery_visitor_id_v1";

type EventPayload = {
  eventName:
    | "site_visit"
    | "signup_completed"
    | "login_success"
    | "cart_started"
    | "checkout_started"
    | "checkout_view"
    | "order_completed";
  customerName?: string;
  phone?: string;
  documentCpf?: string;
  path?: string;
  metadata?: Record<string, unknown>;
};

function safeSession() {
  try {
    const raw = localStorage.getItem("employee_session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;

    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  } catch {
    return `visitor-fallback`;
  }
}

export async function trackCustomerEvent(payload: EventPayload) {
  try {
    const session = safeSession();
    const phone = String(payload.phone ?? session?.phone ?? session?.cpf ?? "").replace(/\D/g, "");
    const documentCpf = String(payload.documentCpf ?? session?.document_cpf ?? "").replace(/\D/g, "");
    const customerName = String(
      payload.customerName ?? session?.full_name ?? session?.name ?? ""
    ).trim();

    await supabase.from("delivery_customer_events").insert({
      visitor_id: getVisitorId(),
      event_name: payload.eventName,
      customer_name: customerName || null,
      phone: phone || null,
      document_cpf: documentCpf || null,
      path: payload.path ?? (typeof window !== "undefined" ? window.location.pathname : null),
      metadata: payload.metadata ?? {},
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // best effort only
  }
}

export function trackCustomerEventOnce(key: string, payload: EventPayload) {
  try {
    const storageKey = `gm_delivery_once_${key}`;
    if (sessionStorage.getItem(storageKey) === "1") return;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    // ignore sessionStorage failures and still try tracking
  }

  void trackCustomerEvent(payload);
}
