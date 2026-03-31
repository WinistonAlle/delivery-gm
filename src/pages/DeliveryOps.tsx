import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Clock3,
  MapPin,
  Package2,
  Phone,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  DELIVERY_STATUSES,
  getDeliveryMetrics,
  statusLabel,
} from "@/lib/deliveryEnhancements";
import { Button } from "@/components/ui/button";

type OrderItemRow = {
  id: string | number;
  product_name: string | null;
  quantity: number | null;
  subtotal: number | null;
};

type OrderRow = {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  employee_name?: string | null;
  customer_phone: string | null;
  employee_cpf?: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_cep: string | null;
  payment_method: string | null;
  notes: string | null;
  status: string | null;
  total_items: number | null;
  total_value: number | null;
  shipping_cost: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  order_items?: OrderItemRow[];
};

type StageLead = {
  visitorId: string;
  stageKey: string;
  stageLabel: string;
  customerName: string | null;
  phone: string | null;
  documentCpf: string | null;
  lastPath: string | null;
  lastSeenAt: string;
};

type StageBreakdown = {
  stageKey: string;
  stageLabel: string;
  count: number;
  contactableCount: number;
  visitors: StageLead[];
};

type DeliveryOpsPayload = {
  days: number;
  orders: OrderRow[];
  stageBreakdown: StageBreakdown[];
};

const formatCurrency = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function minutesSince(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

function relativeAgeLabel(value: string) {
  const mins = minutesSince(value);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem ? `${hours}h ${rem}min atrás` : `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function normalizeStatus(status: string | null | undefined) {
  const s = (status || "recebido").toLowerCase();
  if (s === "aguardando_separacao") return "recebido";
  if (s === "em_separacao") return "em_preparo";
  if (s === "pronto_para_retirada") return "saiu_para_entrega";
  return s;
}

function getStatusClasses(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  if (normalized === "entregue") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (normalized === "cancelado") return "bg-rose-50 text-rose-700 border-rose-200";
  if (normalized === "saiu_para_entrega") return "bg-sky-50 text-sky-700 border-sky-200";
  if (normalized === "em_preparo") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-orange-50 text-orange-700 border-orange-200";
}

function extractShipping(order: OrderRow) {
  const metadataShipping = Number(order.metadata?.shipping_cost ?? 0);
  return Number(order.shipping_cost ?? metadataShipping ?? 0);
}

function extractItemsTotal(order: OrderRow) {
  const metadataItemsTotal = Number(order.metadata?.items_total ?? 0);
  const fallback = Number(order.total_value ?? 0) - extractShipping(order);
  return metadataItemsTotal > 0 ? metadataItemsTotal : Math.max(0, fallback);
}

function paymentLabel(value: string | null) {
  if (!value) return "Nao informado";
  const clean = value.replace(/[_-]/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

async function getOpsData(days: number): Promise<DeliveryOpsPayload> {
  const baseUrl =
    typeof window === "undefined"
      ? `/api/delivery-ops?days=${days}`
      : new URL(`/api/delivery-ops?days=${days}`, window.location.origin).toString();

  const response = await fetch(baseUrl);
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      "A rota /api/delivery-ops não está disponível neste ambiente. Rode com backend ativo ou faça um novo deploy."
    );
  }

  const body = (await response.json().catch(() => null)) as
    | (DeliveryOpsPayload & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(body?.error || "Erro ao carregar operação delivery.");
  }

  if (!body || !Array.isArray(body.orders) || !Array.isArray(body.stageBreakdown)) {
    throw new Error("A API da operação delivery retornou um formato inválido.");
  }

  return {
    days: Number(body.days ?? days),
    orders: body.orders,
    stageBreakdown: body.stageBreakdown,
  };
}

const DeliveryOps: React.FC = () => {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stageBreakdown, setStageBreakdown] = useState<StageBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [daysFilter, setDaysFilter] = useState(14);
  const [error, setError] = useState<string | null>(null);
  const metrics = getDeliveryMetrics();

  const loadData = useCallback(async (days = daysFilter) => {
    setLoading(true);
    setError(null);

    try {
      const payload = await getOpsData(days);
      setOrders(payload.orders ?? []);
      setStageBreakdown(payload.stageBreakdown ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
      setOrders([]);
      setStageBreakdown([]);
    } finally {
      setLoading(false);
    }
  }, [daysFilter]);

  useEffect(() => {
    void loadData(daysFilter);
  }, [daysFilter, loadData]);

  async function updateStatus(orderId: string, status: string) {
    setSavingId(orderId);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (!updateError) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    }

    setSavingId(null);
  }

  const filteredOrders = useMemo(() => {
    const term = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "todos" || normalizeStatus(order.status) === statusFilter;
      if (!matchesStatus) return false;
      if (!term) return true;

      const itemNames = (order.order_items ?? [])
        .map((item) => item.product_name || "")
        .join(" ")
        .toLowerCase();

      return [
        order.order_number,
        order.customer_name,
        order.customer_phone,
        order.customer_address,
        order.customer_city,
        order.payment_method,
        order.notes,
        itemNames,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [orders, query, statusFilter]);

  const summary = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const openOrders = filteredOrders.filter((order) => {
      const status = normalizeStatus(order.status);
      return status !== "entregue" && status !== "cancelado";
    }).length;
    const lateOrders = filteredOrders.filter((order) => {
      const status = normalizeStatus(order.status);
      return status !== "entregue" && status !== "cancelado" && minutesSince(order.created_at) >= 45;
    }).length;
    const totalRevenue = filteredOrders.reduce(
      (sum, order) => sum + Number(order.total_value ?? 0),
      0
    );
    const avgTicket = totalOrders ? totalRevenue / totalOrders : 0;
    const totalItems = filteredOrders.reduce(
      (sum, order) => sum + Number(order.total_items ?? 0),
      0
    );

    const byStatus = DELIVERY_STATUSES.reduce<Record<string, number>>((acc, status) => {
      acc[status] = filteredOrders.filter(
        (order) => normalizeStatus(order.status) === status
      ).length;
      return acc;
    }, {});

    const totalDropoffs = stageBreakdown.reduce((sum, stage) => sum + stage.count, 0);
    const contactableDropoffs = stageBreakdown.reduce(
      (sum, stage) => sum + stage.contactableCount,
      0
    );

    return {
      totalOrders,
      openOrders,
      lateOrders,
      totalRevenue,
      avgTicket,
      totalItems,
      byStatus,
      totalDropoffs,
      contactableDropoffs,
    };
  }, [filteredOrders, stageBreakdown]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8f6_0%,#f8fafc_100%)] p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        <section className="rounded-[24px] border border-red-100 bg-white/90 p-4 shadow-[0_24px_60px_rgba(127,29,29,0.08)] backdrop-blur sm:p-5 md:rounded-[28px] md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-700 sm:text-xs">
                <Truck className="h-3.5 w-3.5" />
                Operação Delivery
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                  Painel operacional detalhado
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  Visualize pedidos ativos, usuários que pararam em cada etapa e
                  oportunidades de contato para recuperar conversão.
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <select
                value={String(daysFilter)}
                onChange={(e) => setDaysFilter(Number(e.target.value))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100"
              >
                <option value="7">Últimos 7 dias</option>
                <option value="14">Últimos 14 dias</option>
                <option value="30">Últimos 30 dias</option>
              </select>

              <Button
                onClick={() => void loadData(daysFilter)}
                variant="outline"
                className="h-11 gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300 sm:text-xs">
                Pedidos visíveis
              </p>
              <p className="mt-3 text-3xl font-black">{summary.totalOrders}</p>
              <p className="mt-2 text-sm text-slate-300">
                {summary.openOrders} em andamento e {summary.lateOrders} com atenção imediata.
              </p>
            </div>

            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-red-700 sm:text-xs">
                Receita
              </p>
              <p className="mt-3 text-3xl font-black text-slate-900">
                {formatCurrency(summary.totalRevenue)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Ticket médio de {formatCurrency(summary.avgTicket)}.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-amber-700 sm:text-xs">
                Funil local
              </p>
              <p className="mt-3 text-3xl font-black text-slate-900">
                {metrics.finishedOrderCount}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {metrics.startedCheckoutCount} checkouts iniciados e {metrics.abandonedCartCount} abandonos.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-700 sm:text-xs">
                Itens
              </p>
              <p className="mt-3 text-3xl font-black text-slate-900">{summary.totalItems}</p>
              <p className="mt-2 text-sm text-slate-600">
                Volume total dos pedidos carregados.
              </p>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-sky-700 sm:text-xs">
                Saídas com contato
              </p>
              <p className="mt-3 text-3xl font-black text-slate-900">
                {summary.contactableDropoffs}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {summary.totalDropoffs} saídas no período com foco em recuperação.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 sm:text-xl">
                  Usuários que saíram em cada etapa
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Priorizamos quem deixou telefone ou CPF para facilitar contato rápido.
                </p>
              </div>
              <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:block">
                Últimos {daysFilter} dias
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {stageBreakdown.map((stage) => (
                <div
                  key={stage.stageKey}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-bold text-slate-900">{stage.stageLabel}</p>
                      <p className="text-sm text-slate-600">
                        {stage.count} saída(s), {stage.contactableCount} com contato disponível.
                      </p>
                    </div>
                    <div className="inline-flex w-fit items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {stage.contactableCount > 0 ? "Contato prioritário" : "Sem contato"}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {stage.visitors.length ? (
                      stage.visitors.map((lead) => (
                        <div
                          key={lead.visitorId}
                          className="grid gap-2 rounded-2xl border border-white bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {lead.customerName || "Usuário sem nome identificado"}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 sm:text-sm">
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {lead.phone || "Sem telefone"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3.5 w-3.5" />
                                {lead.documentCpf || "Sem CPF"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" />
                                {relativeAgeLabel(lead.lastSeenAt)}
                              </span>
                            </div>
                            <p className="truncate text-xs text-slate-500 sm:text-sm">
                              Última rota: {lead.lastPath || "não informada"}
                            </p>
                          </div>

                          <div className="flex items-center sm:justify-end">
                            {lead.phone ? (
                              <a
                                href={`https://wa.me/55${lead.phone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:w-auto"
                              >
                                <Smartphone className="h-4 w-4" />
                                Chamar no WhatsApp
                              </a>
                            ) : (
                              <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                                Sem contato direto
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl bg-white p-3 text-sm text-slate-500">
                        Nenhum usuário identificado nessa etapa no período selecionado.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className="text-lg font-black text-slate-900 sm:text-xl">
                Fila por status
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {DELIVERY_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(statusFilter === status ? "todos" : status)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      statusFilter === status
                        ? "border-red-300 bg-red-50 shadow-[0_12px_28px_rgba(185,28,28,0.12)]"
                        : "border-slate-200 bg-slate-50 hover:border-red-200"
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Status</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">{statusLabel(status)}</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">
                      {summary.byStatus[status] ?? 0}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className="text-lg font-black text-slate-900 sm:text-xl">
                Filtros de operação
              </h2>

              <div className="mt-4 grid gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar pedido, cliente, telefone, endereço ou item"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-red-300 focus:bg-white focus:ring-4 focus:ring-red-100"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100"
                >
                  <option value="todos">Todos os status</option>
                  {DELIVERY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
            Carregando pedidos e saídas do funil...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {!loading && !error && filteredOrders.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold text-slate-900">Nenhum pedido encontrado</p>
            <p className="mt-2 text-sm text-slate-600">
              Ajuste a busca ou o filtro para visualizar outro recorte da operação.
            </p>
          </div>
        ) : null}

        <section className="space-y-4">
          {!loading && !error ? (
            filteredOrders.map((order) => {
              const ageMinutes = minutesSince(order.created_at);
              const shipping = extractShipping(order);
              const itemsTotal = extractItemsTotal(order);
              const isLate =
                normalizeStatus(order.status) !== "entregue" &&
                normalizeStatus(order.status) !== "cancelado" &&
                ageMinutes >= 45;

              return (
                <article
                  key={order.id}
                  className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-5"
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-xl font-black text-slate-900">
                              {order.order_number || order.id}
                            </span>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                                order.status
                              )}`}
                            >
                              {statusLabel(order.status || "")}
                            </span>
                            {isLate ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Prioridade alta
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            Criado em {formatDateTime(order.created_at)} • {relativeAgeLabel(order.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Cliente</p>
                          <p className="mt-2 font-bold text-slate-900">
                            {order.customer_name || order.employee_name || "Cliente não informado"}
                          </p>
                          <p className="mt-1 inline-flex items-center gap-1 break-all text-sm text-slate-600">
                            <Phone className="h-4 w-4 shrink-0" />
                            {order.customer_phone || order.employee_cpf || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Pagamento</p>
                          <p className="mt-2 inline-flex items-center gap-1 font-bold text-slate-900">
                            <Wallet className="h-4 w-4" />
                            {paymentLabel(order.payment_method)}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {Number(order.total_items ?? 0)} item(ns)
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Endereço</p>
                          <p className="mt-2 inline-flex items-start gap-1 text-sm font-medium text-slate-900">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <span className="line-clamp-2">
                              {order.customer_address || "Endereço não informado"}
                            </span>
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {[order.customer_city, order.customer_cep].filter(Boolean).join(" • ") || "Cidade e CEP não informados"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-950 p-3 text-white">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Total</p>
                          <p className="mt-2 text-2xl font-black">
                            {formatCurrency(Number(order.total_value ?? 0))}
                          </p>
                          <p className="mt-1 text-sm text-slate-300">
                            Itens {formatCurrency(itemsTotal)} + frete {formatCurrency(shipping)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <Package2 className="h-4 w-4 text-red-600" />
                            <p className="text-sm font-bold text-slate-900">Itens do pedido</p>
                          </div>

                          <div className="space-y-2">
                            {(order.order_items ?? []).length ? (
                              order.order_items!.slice(0, 6).map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">
                                      {item.product_name || "Item"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      Quantidade: {Number(item.quantity ?? 0)}
                                    </p>
                                  </div>
                                  <p className="whitespace-nowrap text-sm font-semibold text-slate-700">
                                    {formatCurrency(Number(item.subtotal ?? 0))}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                Nenhum item detalhado disponível para este pedido.
                              </div>
                            )}

                            {(order.order_items ?? []).length > 6 ? (
                              <p className="text-xs text-slate-500">
                                + {(order.order_items ?? []).length - 6} item(ns) adicionais
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-red-600" />
                            <p className="text-sm font-bold text-slate-900">Resumo operacional</p>
                          </div>

                          <div className="space-y-3 text-sm text-slate-600">
                            <div className="rounded-2xl bg-slate-50 p-3">
                              <p className="font-semibold text-slate-900">Fila</p>
                              <p className="mt-1 leading-6">
                                Pedido com <span className="font-semibold">{ageMinutes} min</span> em fluxo e status atual{" "}
                                <span className="font-semibold">{statusLabel(order.status || "")}</span>.
                              </p>
                            </div>

                            <div className="rounded-2xl bg-slate-50 p-3">
                              <p className="font-semibold text-slate-900">Observações</p>
                              <p className="mt-1 leading-6">
                                {order.notes || "Nenhuma observação registrada no pedido."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-red-600" />
                        <p className="text-sm font-bold text-slate-900">Ações</p>
                      </div>

                      <p className="mt-3 inline-flex items-center gap-1 text-sm text-slate-600">
                        <Clock3 className="h-4 w-4" />
                        Tempo em fila: <span className="font-semibold text-slate-900">{ageMinutes} min</span>
                      </p>

                      <select
                        value={normalizeStatus(order.status)}
                        onChange={(e) => void updateStatus(order.id, e.target.value)}
                        disabled={savingId === order.id}
                        className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100"
                      >
                        {DELIVERY_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ))}
                      </select>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Ticket</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {formatCurrency(Number(order.total_value ?? 0))}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Itens</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {order.total_items ?? 0}
                          </p>
                        </div>
                      </div>

                      {order.customer_phone ? (
                        <a
                          href={`https://wa.me/55${String(order.customer_phone).replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          <Smartphone className="h-4 w-4" />
                          Falar com cliente
                        </a>
                      ) : null}
                    </aside>
                  </div>
                </article>
              );
            })
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default DeliveryOps;
