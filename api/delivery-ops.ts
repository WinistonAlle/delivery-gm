import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireAdminSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

type DeliveryEvent = {
  visitor_id: string | null;
  event_name: string;
  customer_name: string | null;
  phone: string | null;
  document_cpf: string | null;
  path: string | null;
  created_at: string;
};

type VisitorJourney = {
  visitorId: string;
  stageKey: string;
  stageLabel: string;
  customerName: string | null;
  phone: string | null;
  documentCpf: string | null;
  lastPath: string | null;
  lastSeenAt: string;
};

const EVENT_STAGE_MAP: Record<
  string,
  { key: string; label: string; rank: number }
> = {
  site_visit: { key: "visita", label: "Saiu na visita", rank: 1 },
  signup_completed: { key: "cadastro", label: "Saiu apos cadastro", rank: 2 },
  login_success: { key: "login", label: "Saiu apos login", rank: 3 },
  cart_started: { key: "carrinho", label: "Saiu no carrinho", rank: 4 },
  checkout_started: { key: "checkout", label: "Saiu no checkout", rank: 5 },
  checkout_view: { key: "checkout", label: "Saiu no checkout", rank: 5 },
  order_completed: { key: "pedido", label: "Pedido concluido", rank: 6 },
};

function normalizeString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeDigits(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminSession(req);
    const supabase = getSupabaseAdminClient();
    const days = Math.min(Math.max(Number(req.query.days ?? 14), 1), 60);
    const rangeStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: ordersData, error: ordersError }, { data: eventsData, error: eventsError }] =
      await Promise.all([
        supabase
          .from("orders")
          .select(
            `
            id,
            order_number,
            customer_name,
            employee_name,
            customer_phone,
            employee_cpf,
            customer_address,
            customer_city,
            customer_cep,
            payment_method,
            notes,
            status,
            total_items,
            total_value,
            shipping_cost,
            metadata,
            created_at,
            order_items (
              id,
              product_name,
              quantity,
              subtotal
            )
          `
          )
          .gte("created_at", rangeStart)
          .order("created_at", { ascending: false })
          .limit(120),
        supabase
          .from("delivery_customer_events")
          .select(
            "visitor_id, event_name, customer_name, phone, document_cpf, path, created_at"
          )
          .gte("created_at", rangeStart)
          .order("created_at", { ascending: false })
          .limit(800),
      ]);

    if (ordersError) throw ordersError;
    if (eventsError) throw eventsError;

    const journeyByVisitor = new Map<
      string,
      {
        stageKey: string;
        stageLabel: string;
        stageRank: number;
        hasPurchase: boolean;
        customerName: string | null;
        phone: string | null;
        documentCpf: string | null;
        lastPath: string | null;
        lastSeenAt: string;
      }
    >();

    for (const raw of (eventsData ?? []) as DeliveryEvent[]) {
      if (!raw.visitor_id) continue;
      const mappedStage = EVENT_STAGE_MAP[raw.event_name] ?? EVENT_STAGE_MAP.site_visit;
      const existing = journeyByVisitor.get(raw.visitor_id);

      if (!existing) {
        journeyByVisitor.set(raw.visitor_id, {
          stageKey: mappedStage.key,
          stageLabel: mappedStage.label,
          stageRank: mappedStage.rank,
          hasPurchase: raw.event_name === "order_completed",
          customerName: normalizeString(raw.customer_name),
          phone: normalizeDigits(raw.phone),
          documentCpf: normalizeDigits(raw.document_cpf),
          lastPath: normalizeString(raw.path),
          lastSeenAt: raw.created_at,
        });
        continue;
      }

      const nextRank = Math.max(existing.stageRank, mappedStage.rank);
      const nextStage =
        nextRank === existing.stageRank
          ? { key: existing.stageKey, label: existing.stageLabel, rank: existing.stageRank }
          : mappedStage;

      journeyByVisitor.set(raw.visitor_id, {
        stageKey: nextStage.key,
        stageLabel: nextStage.label,
        stageRank: nextStage.rank,
        hasPurchase: existing.hasPurchase || raw.event_name === "order_completed",
        customerName: existing.customerName ?? normalizeString(raw.customer_name),
        phone: existing.phone ?? normalizeDigits(raw.phone),
        documentCpf: existing.documentCpf ?? normalizeDigits(raw.document_cpf),
        lastPath: existing.lastPath ?? normalizeString(raw.path),
        lastSeenAt: existing.lastSeenAt,
      });
    }

    const leadsByStage = new Map<string, VisitorJourney[]>();

    for (const [visitorId, journey] of journeyByVisitor.entries()) {
      if (journey.hasPurchase || journey.stageKey === "pedido") continue;

      const lead: VisitorJourney = {
        visitorId,
        stageKey: journey.stageKey,
        stageLabel: journey.stageLabel,
        customerName: journey.customerName,
        phone: journey.phone,
        documentCpf: journey.documentCpf,
        lastPath: journey.lastPath,
        lastSeenAt: journey.lastSeenAt,
      };

      const bucket = leadsByStage.get(journey.stageKey) ?? [];
      bucket.push(lead);
      leadsByStage.set(journey.stageKey, bucket);
    }

    const stageOrder = ["checkout", "carrinho", "login", "cadastro", "visita"];
    const stageBreakdown = stageOrder.map((stageKey) => {
      const visitors = (leadsByStage.get(stageKey) ?? []).sort(
        (a, b) =>
          new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
      );
      return {
        stageKey,
        stageLabel: visitors[0]?.stageLabel ??
          (EVENT_STAGE_MAP[
            stageKey === "visita"
              ? "site_visit"
              : stageKey === "cadastro"
                ? "signup_completed"
                : stageKey === "login"
                  ? "login_success"
                  : stageKey === "carrinho"
                    ? "cart_started"
                    : "checkout_started"
          ]?.label || stageKey),
        count: visitors.length,
        contactableCount: visitors.filter((lead) => lead.phone || lead.documentCpf).length,
        visitors: visitors.slice(0, 12),
      };
    });

    return res.status(200).json({
      days,
      orders: ordersData ?? [],
      stageBreakdown,
    });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    const message =
      error instanceof Error ? error.message : "Erro ao carregar operacao delivery.";
    return res.status(400).json({ error: message });
  }
}
