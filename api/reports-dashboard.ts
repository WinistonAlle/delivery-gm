import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireAdminSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

type Summary = {
  totalOrders: number;
  totalRevenue: number;
  totalItems: number;
  avgTicket: number;
};

type DashboardOrderItem = {
  product_id?: string | number | null;
  product_name?: string | null;
  quantity?: number | null;
  subtotal?: number | null;
};

type DashboardOrder = {
  id: string;
  customer_phone?: string | null;
  customer_name?: string | null;
  total_items?: number | null;
  total_value?: number | null;
  status?: string | null;
  created_at: string;
  order_items?: DashboardOrderItem[];
};

type DashboardEvent = {
  visitor_id: string | null;
  event_name: string;
  customer_name: string | null;
  phone: string | null;
  document_cpf: string | null;
  path: string | null;
  created_at: string;
};

function buildSummaryFromOrders(orders: Array<{ total_items?: number | null; total_value?: number | null }>): Summary {
  const totalOrders = orders.length;
  let totalRevenue = 0;
  let totalItems = 0;

  for (const order of orders) {
    totalRevenue += Number(order.total_value ?? 0);
    totalItems += Number(order.total_items ?? 0);
  }

  return {
    totalOrders,
    totalRevenue,
    totalItems,
    avgTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
  };
}

function getRange(selectedRange: string) {
  const now = new Date();
  let rangeStart: Date;
  let rangeEnd: Date;

  if (selectedRange === "mes_atual") {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (selectedRange === "mes_anterior") {
    rangeEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  } else {
    rangeEnd = new Date();
    rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 90);
  }

  return { rangeStart, rangeEnd };
}

function getMonthStartEnd(value: string) {
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  return { start, end };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminSession(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action ?? "overview");
    const supabase = getSupabaseAdminClient();

    if (action === "overview") {
      const selectedRange = String(body.selectedRange ?? "mes_atual");
      const { rangeStart, rangeEnd } = getRange(selectedRange);

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          `
          id,
          customer_phone,
          customer_name,
          total_items,
          total_value,
          status,
          created_at,
          order_items (
            product_id,
            product_name,
            quantity,
            subtotal
          )
        `
        )
        .gte("created_at", rangeStart.toISOString())
        .lt("created_at", rangeEnd.toISOString());

      if (ordersError) throw ordersError;

      const orders = (ordersData ?? []) as DashboardOrder[];

      const { data: eventsData, error: eventsError } = await supabase
        .from("delivery_customer_events")
        .select("id, visitor_id, event_name, customer_name, phone, document_cpf, path, created_at")
        .gte("created_at", rangeStart.toISOString())
        .lt("created_at", rangeEnd.toISOString())
        .order("created_at", { ascending: false });

      const visitors = new Set<string>();
      const registered = new Set<string>();
      const checkoutStarted = new Set<string>();
      const buyers = new Set<string>();
      const latestByVisitor = new Map<string, Record<string, unknown>>();

      if (!eventsError) {
        for (const event of (eventsData ?? []) as DashboardEvent[]) {
          if (!event.visitor_id) continue;
          visitors.add(event.visitor_id);
          if (event.event_name === "signup_completed") registered.add(event.visitor_id);
          if (event.event_name === "checkout_started" || event.event_name === "checkout_view") checkoutStarted.add(event.visitor_id);
          if (event.event_name === "order_completed") buyers.add(event.visitor_id);

          if (!latestByVisitor.has(event.visitor_id)) {
            latestByVisitor.set(event.visitor_id, {
              visitorId: event.visitor_id,
              customerName: event.customer_name,
              phone: event.phone,
              documentCpf: event.document_cpf,
              lastEventName: event.event_name,
              lastPath: event.path,
              lastSeenAt: event.created_at,
            });
          }
        }
      }

      const customerMap = new Map<string, { phone: string | null; name: string; totalValue: number; totalOrders: number }>();
      const productMap = new Map<string, { productId: string | number | null; productName: string; totalQuantity: number; totalValue: number }>();

      for (const order of orders) {
        const orderValue = Number(order.total_value ?? 0);
        const customerKey = order.customer_phone || "sem-telefone";
        const customer = customerMap.get(customerKey) ?? {
          phone: order.customer_phone ?? null,
          name: order.customer_name ?? order.customer_phone ?? "Cliente não identificado",
          totalValue: 0,
          totalOrders: 0,
        };

        customer.totalValue += orderValue;
        customer.totalOrders += 1;
        customerMap.set(customerKey, customer);

        for (const item of order.order_items ?? []) {
          const key =
            item.product_id !== null && item.product_id !== undefined
              ? String(item.product_id)
              : String(item.product_name ?? "sem-produto");
          const product = productMap.get(key) ?? {
            productId: item.product_id ?? null,
            productName: item.product_name ?? "Produto sem nome",
            totalQuantity: 0,
            totalValue: 0,
          };
          product.totalQuantity += Number(item.quantity ?? 0);
          product.totalValue += Number(item.subtotal ?? 0);
          productMap.set(key, product);
        }
      }

      const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
      const compEnd = new Date(rangeStart);
      const compStart = new Date(compEnd.getTime() - rangeMs);

      const { data: compData, error: compError } = await supabase
        .from("orders")
        .select("id, total_items, total_value, created_at")
        .gte("created_at", compStart.toISOString())
        .lt("created_at", compEnd.toISOString());

      if (compError) throw compError;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrow = new Date(todayStart);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayOrders, error: todayError } = await supabase
        .from("orders")
        .select("id, total_items, total_value, created_at")
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", tomorrow.toISOString());

      if (todayError) throw todayError;

      return res.status(200).json({
        currentRange: {
          start: rangeStart.toISOString(),
          end: rangeEnd.toISOString(),
        },
        ordersRaw: orders,
        summary: buildSummaryFromOrders(orders),
        comparisonSummary: buildSummaryFromOrders((compData ?? []) as Array<{ total_items?: number | null; total_value?: number | null }>),
        dailySummary: {
          totalOrdersToday: (todayOrders ?? []).length,
          totalRevenueToday: (todayOrders ?? []).reduce(
            (sum, order) => sum + Number(order.total_value ?? 0),
            0
          ),
          totalItemsToday: (todayOrders ?? []).reduce(
            (sum, order) => sum + Number(order.total_items ?? 0),
            0
          ),
        },
        topCustomers: Array.from(customerMap.values()).sort((a, b) => b.totalValue - a.totalValue).slice(0, 5),
        topProducts: Array.from(productMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5),
        visitorFunnel: eventsError
          ? null
          : {
              uniqueVisitors: visitors.size,
              registeredVisitors: registered.size,
              checkoutVisitors: checkoutStarted.size,
              buyers: buyers.size,
              visitorsWithoutPurchase: Math.max(0, visitors.size - buyers.size),
            },
        leadsWithoutPurchase: Array.from(latestByVisitor.values())
          .filter((lead) => !buyers.has(String(lead.visitorId ?? "")))
          .sort((a, b) => new Date(String(b.lastSeenAt ?? "")).getTime() - new Date(String(a.lastSeenAt ?? "")).getTime())
          .slice(0, 12),
      });
    }

    if (action === "monthComparison") {
      const compareMonth1 = String(body.compareMonth1 ?? "");
      const compareMonth2 = String(body.compareMonth2 ?? "");
      const { start: start1, end: end1 } = getMonthStartEnd(compareMonth1);
      const { start: start2, end: end2 } = getMonthStartEnd(compareMonth2);

      const [res1, res2] = await Promise.all([
        supabase.from("orders").select("id, total_items, total_value, created_at").gte("created_at", start1.toISOString()).lt("created_at", end1.toISOString()),
        supabase.from("orders").select("id, total_items, total_value, created_at").gte("created_at", start2.toISOString()).lt("created_at", end2.toISOString()),
      ]);

      if (res1.error || res2.error) {
        throw res1.error ?? res2.error ?? new Error("Erro ao comparar meses.");
      }

      return res.status(200).json({
        monthComparison: {
          month1: buildSummaryFromOrders((res1.data ?? []) as Array<{ total_items?: number | null; total_value?: number | null }>),
          month2: buildSummaryFromOrders((res2.data ?? []) as Array<{ total_items?: number | null; total_value?: number | null }>),
        },
      });
    }

    if (action === "customerOrders") {
      const start = String(body.start ?? "");
      const end = String(body.end ?? "");
      const phone = String(body.phone ?? "");

      let query = supabase
        .from("orders")
        .select("id, total_items, total_value, status, created_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false });

      if (phone) query = query.eq("customer_phone", phone);

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json({ customerOrders: data ?? [] });
    }

    return res.status(400).json({ error: "Ação inválida." });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard.";
    return res.status(400).json({ error: message });
  }
}
