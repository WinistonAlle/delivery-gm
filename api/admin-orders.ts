import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireAdminSession } from "./_lib/authSession";
import { getSupabaseAdminClient } from "./_lib/supabaseAdmin";

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

type RawOrderItem = Record<string, unknown> & {
  id: string;
  order_id: string;
  product_id?: string | null;
  product_name?: string | null;
  name?: string | null;
  products?: { name?: string | null } | null;
  quantity?: number | null;
  qtd?: number | null;
  amount?: number | null;
  qty?: number | null;
  unit_price_cents?: number | null;
  price_cents?: number | null;
  unit_price?: number | null;
  price?: number | null;
  unit_value?: number | null;
  value?: number | null;
};

type CancellationOrder = {
  id: string;
  order_number: string | null;
  employee_cpf: string | null;
  employee_name: string | null;
  total_value: number | null;
  total_cents: number | null;
  wallet_used_cents: number | null;
  spent_from_balance_cents: number | null;
  pay_on_pickup_cents: number | null;
  cancelled_at: string | null;
};

async function fetchEmployeeMap() {
  const supabase = getSupabaseAdminClient();
  const map = new Map<string, string>();

  const { data, error } = await supabase
    .from("employees")
    .select("cpf, full_name")
    .order("full_name", { ascending: true });

  if (error) throw error;

  for (const row of data ?? []) {
    const cpf = onlyDigits(String(row.cpf ?? ""));
    const name = String(row.full_name ?? "");
    if (cpf && name) map.set(cpf, name);
  }

  return map;
}

async function listOrders(body: Record<string, unknown>) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("orders")
    .select(
      [
        "id",
        "order_number",
        "employee_id",
        "employee_cpf",
        "employee_name",
        "total_items",
        "total_value",
        "total_cents",
        "wallet_used_cents",
        "spent_from_balance_cents",
        "pay_on_pickup_cents",
        "status",
        "created_at",
        "cancelled_at",
        "cancel_reason",
      ].join(",")
    )
    .order("created_at", { ascending: false });

  const cpfFilter = onlyDigits(String(body.cpfFilter ?? ""));
  const orderFilter = String(body.orderFilter ?? "").trim();
  const statusFilter = String(body.statusFilter ?? "").trim();

  if (cpfFilter) query = query.ilike("employee_cpf", `%${cpfFilter}%`);
  if (orderFilter) query = query.ilike("order_number", `%${orderFilter}%`);
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data, error } = await query;
  if (error) throw error;

  const orders = ((Array.isArray(data) ? data : []) as unknown) as Array<Record<string, unknown>>;
  const cpfMap = await fetchEmployeeMap();

  return orders.map((order) => {
    if (order.employee_name) return order;
    const cpfKey = onlyDigits(String(order.employee_cpf ?? ""));
    return { ...order, employee_name: cpfMap.get(cpfKey) ?? null };
  });
}

async function getOrder(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      [
        "id",
        "order_number",
        "employee_id",
        "employee_cpf",
        "employee_name",
        "total_items",
        "total_value",
        "total_cents",
        "wallet_used_cents",
        "spent_from_balance_cents",
        "pay_on_pickup_cents",
        "status",
        "created_at",
        "cancelled_at",
        "cancel_reason",
      ].join(",")
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getHistory(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_admin_actions")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function getItems(orderId: string) {
  const supabase = getSupabaseAdminClient();
  let response = await supabase
    .from("order_items")
    .select("*, products(name)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (response.error && String(response.error.message || "").toLowerCase().includes("created_at")) {
    response = await supabase
      .from("order_items")
      .select("*, products(name)")
      .eq("order_id", orderId)
      .order("id", { ascending: true });
  }

  if (response.error) throw response.error;

  return ((response.data ?? []) as RawOrderItem[]).map((row) => {
    const quantity = Number(row?.quantity ?? row?.qtd ?? row?.amount ?? row?.qty ?? 0);
    const unitPriceCents =
      Number(row?.unit_price_cents ?? 0) ||
      Number(row?.price_cents ?? 0) ||
      Math.round(Number(row?.unit_price ?? 0) * 100) ||
      Math.round(Number(row?.price ?? 0) * 100) ||
      Math.round(Number(row?.unit_value ?? 0) * 100) ||
      Math.round(Number(row?.value ?? 0) * 100) ||
      0;

    return {
      id: row.id,
      order_id: row.order_id,
      product_id: row.product_id ?? null,
      product_name: row?.products?.name ?? row?.product_name ?? row?.name ?? null,
      quantity,
      unit_price_cents: unitPriceCents,
      total_cents: quantity * unitPriceCents,
    };
  });
}

async function getCancellationHistory() {
  const supabase = getSupabaseAdminClient();
  const cpfMap = await fetchEmployeeMap();

  const { data: actions, error: actionsError } = await supabase
    .from("order_admin_actions")
    .select("order_id, actor_cpf, reason, created_at, action")
    .eq("action", "cancel_order")
    .order("created_at", { ascending: false })
    .limit(200);

  if (actionsError) throw actionsError;

  const actionRows = Array.isArray(actions) ? actions : [];
  const orderIds = Array.from(new Set(actionRows.map((row) => row.order_id).filter(Boolean)));

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id, order_number, employee_cpf, employee_name, total_value, total_cents, wallet_used_cents, spent_from_balance_cents, pay_on_pickup_cents, cancelled_at"
    )
    .in("id", orderIds);

  if (ordersError) throw ordersError;

  const orderMap = new Map<string, CancellationOrder>();
  for (const order of (orders ?? []) as CancellationOrder[]) orderMap.set(order.id, order);

  return actionRows.map((action) => {
    const order = orderMap.get(action.order_id);
    const employeeCpfKey = onlyDigits(String(order?.employee_cpf ?? ""));
    const actorCpfKey = onlyDigits(String(action?.actor_cpf ?? ""));

    return {
      order_id: action.order_id,
      order_number: order?.order_number ?? null,
      employee_cpf: order?.employee_cpf ?? null,
      employee_name: order?.employee_name ?? cpfMap.get(employeeCpfKey) ?? null,
      actor_cpf: action?.actor_cpf ?? null,
      actor_name: cpfMap.get(actorCpfKey) ?? null,
      cancelled_at: order?.cancelled_at ?? action?.created_at ?? null,
      reason: action?.reason ?? null,
      total_value: order?.total_value ?? null,
      total_cents: order?.total_cents ?? null,
      wallet_used_cents: order?.wallet_used_cents ?? null,
      spent_from_balance_cents: order?.spent_from_balance_cents ?? null,
      pay_on_pickup_cents: order?.pay_on_pickup_cents ?? null,
    };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await requireAdminSession(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action ?? "list");
    const actorCpf = onlyDigits(String(session.document_cpf ?? session.phone ?? ""));

    if (action === "list") {
      const orders = await listOrders(body);
      return res.status(200).json({ orders });
    }

    if (action === "get_order") {
      const order = await getOrder(String(body.orderId ?? ""));
      return res.status(200).json({ order });
    }

    if (action === "history") {
      const history = await getHistory(String(body.orderId ?? ""));
      return res.status(200).json({ history });
    }

    if (action === "items") {
      const items = await getItems(String(body.orderId ?? ""));
      return res.status(200).json({ items });
    }

    if (action === "cancel") {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.rpc("admin_cancel_order_v2", {
        p_order_id: String(body.orderId ?? ""),
        p_reason: String(body.reason ?? ""),
        p_actor_cpf: actorCpf,
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "remove_item") {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.rpc("admin_remove_order_item_v3", {
        p_order_id: String(body.orderId ?? ""),
        p_order_item_id: String(body.orderItemId ?? ""),
        p_reason: String(body.reason ?? ""),
        p_actor_cpf: actorCpf,
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "remove_qty") {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.rpc("admin_remove_order_item_qty_v1", {
        p_order_id: String(body.orderId ?? ""),
        p_order_item_id: String(body.orderItemId ?? ""),
        p_remove_qty: Number(body.qty ?? 0),
        p_reason: String(body.reason ?? ""),
        p_actor_cpf: actorCpf,
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "cancellations") {
      const cancelLogs = await getCancellationHistory();
      return res.status(200).json({ cancelLogs });
    }

    return res.status(400).json({ error: "Ação inválida." });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : "Erro ao processar pedidos administrativos.";
    return res.status(400).json({ error: message });
  }
}
