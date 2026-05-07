import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Lightbulb,
  Phone,
  RefreshCw,
  Smartphone,
  Target,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";

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
  orders: unknown[];
  stageBreakdown: StageBreakdown[];
};

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
    throw new Error(body?.error || "Erro ao carregar análise do delivery.");
  }

  if (!body || !Array.isArray(body.stageBreakdown)) {
    throw new Error("A API da operação delivery retornou um formato inválido.");
  }

  return {
    days: Number(body.days ?? days),
    orders: body.orders ?? [],
    stageBreakdown: body.stageBreakdown,
  };
}

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32 },
};

const STAGE_COLORS = ["#dc2626", "#f59e0b", "#0f766e", "#2563eb", "#7c3aed", "#475569"];

const DeliveryOps: React.FC = () => {
  const [stageBreakdown, setStageBreakdown] = useState<StageBreakdown[]>([]);
  const [completedOrdersCount, setCompletedOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState(14);
  const [selectedStage, setSelectedStage] = useState("todos");
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (days = daysFilter) => {
    setLoading(true);
    setError(null);

    try {
      const payload = await getOpsData(days);
      setStageBreakdown(payload.stageBreakdown ?? []);
      setCompletedOrdersCount(Array.isArray(payload.orders) ? payload.orders.length : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
      setStageBreakdown([]);
      setCompletedOrdersCount(0);
    } finally {
      setLoading(false);
    }
  }, [daysFilter]);

  useEffect(() => {
    void loadData(daysFilter);
  }, [daysFilter, loadData]);

  const analytics = useMemo(() => {
    const totalDropoffs = stageBreakdown.reduce((sum, stage) => sum + stage.count, 0);
    const totalFunnelEvents = totalDropoffs + completedOrdersCount;
    const contactableDropoffs = stageBreakdown.reduce(
      (sum, stage) => sum + stage.contactableCount,
      0
    );
    const totalListedLeads = stageBreakdown.reduce(
      (sum, stage) => sum + stage.visitors.length,
      0
    );
    const contactRate = totalDropoffs ? (contactableDropoffs / totalDropoffs) * 100 : 0;
    const completionRate = totalFunnelEvents ? (completedOrdersCount / totalFunnelEvents) * 100 : 0;
    const hottestStage = stageBreakdown.reduce<StageBreakdown | null>(
      (best, stage) => (!best || stage.count > best.count ? stage : best),
      null
    );
    const stageAnalytics = stageBreakdown.map((stage) => ({
      ...stage,
      shortLabel: stage.stageLabel.replace("Saiu ", ""),
      dropoffShare: totalDropoffs ? (stage.count / totalDropoffs) * 100 : 0,
      funnelShare: totalFunnelEvents ? (stage.count / totalFunnelEvents) * 100 : 0,
      contactRate: stage.count ? (stage.contactableCount / stage.count) * 100 : 0,
    }));
    const stageChartData = [
      ...stageAnalytics.map((stage) => ({
        name: stage.shortLabel,
        count: stage.count,
        contactable: stage.contactableCount,
        percent: Number(stage.funnelShare.toFixed(1)),
      })),
      {
        name: "Finaliza pedido",
        count: completedOrdersCount,
        contactable: 0,
        percent: Number(completionRate.toFixed(1)),
      },
    ];
    const contactChartData = [
      { name: "Com contato", value: contactableDropoffs },
      { name: "Sem contato", value: Math.max(0, totalDropoffs - contactableDropoffs) },
    ];
    const cartStage = stageAnalytics.find((stage) => stage.stageKey === "carrinho");
    const checkoutStage = stageAnalytics.find((stage) => stage.stageKey === "checkout");
    const visibleLeadStages =
      selectedStage === "todos"
        ? stageBreakdown
        : stageBreakdown.filter((stage) => stage.stageKey === selectedStage);
    const totalVisibleLeads = visibleLeadStages.reduce(
      (sum, stage) => sum + stage.visitors.length,
      0
    );

    return {
      totalDropoffs,
      totalFunnelEvents,
      completedOrdersCount,
      contactableDropoffs,
      totalListedLeads,
      contactRate,
      completionRate,
      hottestStage,
      stageAnalytics,
      stageChartData,
      contactChartData,
      cartStage,
      checkoutStage,
      visibleLeadStages,
      totalVisibleLeads,
    };
  }, [stageBreakdown, selectedStage, completedOrdersCount]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7f2_0%,#f8fafc_42%,#ffffff_100%)] p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-red-100 bg-white shadow-[0_24px_70px_rgba(127,29,29,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-5 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-red-700">
                    <Target className="h-3.5 w-3.5" />
                    Operação Delivery
                  </div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-4xl">
                      Recuperação de clientes no funil
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                      Página focada em entender onde o cliente saiu antes de comprar
                      e quais contatos podem ser retomados pela equipe.
                    </p>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  <select
                    value={String(daysFilter)}
                    onChange={(e) => setDaysFilter(Number(e.target.value))}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
                  >
                    <option value="7">Últimos 7 dias</option>
                    <option value="14">Últimos 14 dias</option>
                    <option value="30">Últimos 30 dias</option>
                  </select>

                  <Button
                    onClick={() => void loadData(daysFilter)}
                    variant="outline"
                    className="h-11 gap-2 rounded-2xl"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Finaliza pedido",
                    value: `${analytics.completionRate.toFixed(1)}%`,
                    helper: `${analytics.completedOrdersCount} conclusão(ões) no período`,
                    icon: CheckCircle2,
                    tone: "bg-slate-950 text-white",
                  },
                  {
                    label: "Sai no carrinho",
                    value: `${(analytics.cartStage?.funnelShare ?? 0).toFixed(1)}%`,
                    helper: `${analytics.cartStage?.count ?? 0} visitante(s) pararam no carrinho`,
                    icon: Activity,
                    tone: "bg-red-50 text-slate-950 border-red-100",
                  },
                  {
                    label: "Sai no checkout",
                    value: `${(analytics.checkoutStage?.funnelShare ?? 0).toFixed(1)}%`,
                    helper: `${analytics.checkoutStage?.count ?? 0} visitante(s) quase finalizaram`,
                    icon: Target,
                    tone: "bg-amber-50 text-slate-950 border-amber-100",
                  },
                  {
                    label: "Contato recuperável",
                    value: `${analytics.contactRate.toFixed(1)}%`,
                    helper: `${analytics.contactableDropoffs} com telefone ou CPF`,
                    icon: Phone,
                    tone: "bg-emerald-50 text-slate-950 border-emerald-100",
                  },
                ].map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <motion.div
                      key={card.label}
                      {...cardMotion}
                      transition={{ duration: 0.32, delay: index * 0.05 }}
                      className={`rounded-2xl border p-4 ${card.tone}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">
                          {card.label}
                        </p>
                        <Icon className="h-4 w-4 opacity-80" />
                      </div>
                      <p className="mt-3 text-3xl font-black tracking-tight">{card.value}</p>
                      <p className="mt-2 line-clamp-2 text-sm opacity-70">{card.helper}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-red-100 bg-[radial-gradient(circle_at_20%_20%,rgba(220,38,38,0.12),transparent_34%),linear-gradient(135deg,#fff,#fff7ed)] p-5 sm:p-6 lg:border-l lg:border-t-0 lg:p-7">
              <h2 className="text-lg font-black text-slate-950">Funil de saída</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Use esse mapa para escolher qual etapa atacar primeiro.
              </p>

              <div className="mt-5 space-y-3">
                {analytics.stageAnalytics.map((stage, index) => {
                  const width = Math.max(8, stage.funnelShare);
                  return (
                    <div key={stage.stageKey} className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-black text-slate-950">
                          {stage.stageLabel.replace("Saiu ", "")}
                        </span>
                        <span className="font-black text-red-700">
                          {stage.funnelShare.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.55, delay: index * 0.06 }}
                          className="h-2 rounded-full bg-red-600"
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {stage.count} saída(s), {stage.contactableCount} com contato identificado
                      </p>
                    </div>
                  );
                })}
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-black text-slate-950">Finaliza pedido</span>
                    <span className="font-black text-emerald-700">
                      {analytics.completionRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(8, analytics.completionRate)}%` }}
                      transition={{ duration: 0.55, delay: 0.36 }}
                      className="h-2 rounded-full bg-emerald-600"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {analytics.completedOrdersCount} pedido(s) concluído(s) no período
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
            Carregando funil do delivery...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <motion.section
            {...cardMotion}
            className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]"
          >
            <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-4 text-white shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Diagnóstico do funil</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Leitura rápida para saber onde agir primeiro.
                  </p>
                </div>
                <Lightbulb className="h-5 w-5 text-amber-300" />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.08] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Universo analisado
                  </p>
                  <p className="mt-3 text-3xl font-black">{analytics.totalFunnelEvents}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Saídas do funil + pedidos concluídos no período.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.08] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Etapa com maior perda
                  </p>
                  <p className="mt-3 line-clamp-1 text-xl font-black">
                    {analytics.hottestStage?.stageLabel.replace("Saiu ", "") || "-"}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {analytics.hottestStage?.count ?? 0} saída(s) registradas.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.08] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Quase compra
                  </p>
                  <p className="mt-3 text-3xl font-black">
                    {(analytics.checkoutStage?.funnelShare ?? 0).toFixed(1)}%
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Saíram no checkout. Prioridade alta para contato.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.08] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Recuperáveis
                  </p>
                  <p className="mt-3 text-3xl font-black">{analytics.contactableDropoffs}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Pessoas com telefone ou CPF identificado.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Percentual por etapa</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Cada linha compara a etapa contra todo o universo analisado.
                  </p>
                </div>
                <BarChart3 className="h-5 w-5 text-red-600" />
              </div>

              <div className="mt-5 space-y-3">
                {analytics.stageAnalytics.map((stage, index) => (
                  <button
                    key={stage.stageKey}
                    type="button"
                    onClick={() => setSelectedStage(stage.stageKey)}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-red-200 hover:bg-red-50"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black text-slate-950">
                          {stage.stageLabel.replace("Saiu ", "")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {stage.count} saída(s) · {stage.contactRate.toFixed(1)}% com contato
                        </p>
                      </div>
                      <p className="text-2xl font-black text-red-700">
                        {stage.funnelShare.toFixed(1)}%
                      </p>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(8, stage.funnelShare)}%` }}
                        transition={{ duration: 0.48, delay: index * 0.04 }}
                        className="h-2 rounded-full bg-red-600"
                      />
                    </div>
                  </button>
                ))}

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-slate-950">Finaliza pedido</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {analytics.completedOrdersCount} conclusão(ões) no período
                      </p>
                    </div>
                    <p className="text-2xl font-black text-emerald-700">
                      {analytics.completionRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(8, analytics.completionRate)}%` }}
                      transition={{ duration: 0.48, delay: 0.18 }}
                      className="h-2 rounded-full bg-emerald-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        ) : null}

        {!loading && !error ? (
          <motion.section
            {...cardMotion}
            className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"
          >
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Gráfico do funil</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Volume absoluto por etapa, incluindo finalizações.
                  </p>
                </div>
                <BarChart3 className="h-5 w-5 text-red-600" />
              </div>

              <div className="mt-5 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.stageChartData} margin={{ left: 4, right: 18, top: 12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: number, name) => [
                        name === "count" ? `${Number(value)} pessoa(s)` : value,
                        name === "count" ? "Volume" : String(name),
                      ]}
                      contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0" }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={34}>
                      {analytics.stageChartData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === "Finaliza pedido" ? "#16a34a" : STAGE_COLORS[index % STAGE_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Contato recuperável</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Proporção dos abandonos com telefone ou CPF.
                  </p>
                </div>
                <Phone className="h-5 w-5 text-red-600" />
              </div>

              <div className="mt-5 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.contactChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={4}
                    >
                      <Cell fill="#16a34a" />
                      <Cell fill="#e2e8f0" />
                    </Pie>
                    <Tooltip formatter={(value: number) => `${Number(value)} pessoa(s)`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {analytics.contactChartData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 font-bold text-slate-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: index === 0 ? "#16a34a" : "#cbd5e1" }}
                      />
                      {item.name}
                    </span>
                    <span className="font-black text-slate-950">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        ) : null}

        {!loading && !error ? (
          <motion.section
            {...cardMotion}
            className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">Tabela de etapas</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Comparativo operacional para priorizar recuperação.
                </p>
              </div>
              <UsersRound className="h-5 w-5 text-red-600" />
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-black">Etapa</th>
                    <th className="px-4 py-3 text-right font-black">Saídas</th>
                    <th className="px-4 py-3 text-right font-black">% do funil</th>
                    <th className="px-4 py-3 text-right font-black">% das saídas</th>
                    <th className="px-4 py-3 text-right font-black">Com contato</th>
                    <th className="px-4 py-3 text-right font-black">Taxa contato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.stageAnalytics.map((stage) => (
                    <tr
                      key={stage.stageKey}
                      className="cursor-pointer transition hover:bg-red-50/60"
                      onClick={() => setSelectedStage(stage.stageKey)}
                    >
                      <td className="px-4 py-3 font-black text-slate-950">{stage.shortLabel}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">{stage.count}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700">
                        {stage.funnelShare.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {stage.dropoffShare.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {stage.contactableCount}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {stage.contactRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50">
                    <td className="px-4 py-3 font-black text-slate-950">Finaliza pedido</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">
                      {analytics.completedOrdersCount}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {analytics.completionRate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">-</td>
                    <td className="px-4 py-3 text-right text-slate-500">-</td>
                    <td className="px-4 py-3 text-right text-slate-500">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.section>
        ) : null}

        {!loading && !error ? (
          <motion.section
            {...cardMotion}
            className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Clientes para contato por etapa
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Lista de visitantes que saíram antes de concluir o pedido, separada
                  pela última etapa identificada no funil.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStage("todos")}
                  className={`rounded-2xl px-3 py-2 text-xs font-bold transition ${
                    selectedStage === "todos"
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Todos
                </button>
                {stageBreakdown.map((stage) => (
                  <button
                    key={stage.stageKey}
                    type="button"
                    onClick={() => setSelectedStage(stage.stageKey)}
                    className={`rounded-2xl px-3 py-2 text-xs font-bold transition ${
                      selectedStage === stage.stageKey
                        ? "bg-red-600 text-white"
                        : "bg-red-50 text-red-700 hover:bg-red-100"
                    }`}
                  >
                    {stage.stageLabel.replace("Saiu ", "")} ({stage.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Recorte selecionado
                </p>
                <p className="mt-3 text-3xl font-black text-slate-950">
                  {analytics.totalVisibleLeads}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Contatos exibidos nas etapas selecionadas. Use telefone e CPF como
                  referência para retomar a conversa com o cliente.
                </p>
              </div>

              <div className="space-y-3">
                {analytics.visibleLeadStages.map((stage) => (
                  <div
                    key={stage.stageKey}
                    className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black text-slate-950">{stage.stageLabel}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {stage.count} saída(s), {stage.contactableCount} com telefone ou CPF.
                        </p>
                      </div>
                      <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        Últimos {daysFilter} dias
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {stage.visitors.length ? (
                        stage.visitors.map((lead) => {
                          const phoneDigits = String(lead.phone || "").replace(/\D/g, "");
                          return (
                            <div
                              key={lead.visitorId}
                              className="grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-950">
                                  {lead.customerName || "Cliente sem nome identificado"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 sm:text-sm">
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
                                <p className="mt-1 truncate text-xs text-slate-500 sm:text-sm">
                                  Última rota: {lead.lastPath || "não informada"}
                                </p>
                              </div>

                              {phoneDigits ? (
                                <a
                                  href={`https://wa.me/55${phoneDigits}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                                >
                                  <Smartphone className="h-4 w-4" />
                                  WhatsApp
                                </a>
                              ) : (
                                <span className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-3 text-xs font-bold text-slate-500">
                                  Sem telefone
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                          Nenhum cliente identificado nessa etapa para o período selecionado.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        ) : null}
      </div>
    </div>
  );
};

export default DeliveryOps;
