import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import { Button } from "@/components/ui/button";

type Slot = {
  id: string;
  label: string;
  type: "percent" | "free_shipping";
  value: number;
  weight: number;
  is_active: boolean;
  created_at: string;
};

type UserCoupon = {
  id: string;
  customer_phone: string;
  code: string;
  label: string;
  type: string;
  value: number;
  used: boolean;
  expires_at: string;
  created_at: string;
};

const API = (path: string) => new URL(path, window.location.origin).toString();

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: "same-origin", ...options });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Erro na requisição");
  return data as T;
}

export default function AdminCoupons() {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingCoupons, setLoadingCoupons] = useState(true);

  // Form para novo slot
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"percent" | "free_shipping">("percent");
  const [newValue, setNewValue] = useState(5);
  const [newWeight, setNewWeight] = useState(2);
  const [saving, setSaving] = useState(false);

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const data = await fetchJSON<{ slots: Slot[] }>(API("/api/coupon-slots"));
      setSlots(data.slots ?? []);
    } catch (e) {
      toast.error("Erro ao carregar slots", { description: e instanceof Error ? e.message : "" });
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const loadCoupons = useCallback(async () => {
    setLoadingCoupons(true);
    try {
      const data = await fetchJSON<{ coupons: UserCoupon[] }>(API("/api/admin-coupons"));
      setCoupons(data.coupons ?? []);
    } catch {
      setCoupons([]);
    } finally {
      setLoadingCoupons(false);
    }
  }, []);

  useEffect(() => {
    void loadSlots();
    void loadCoupons();
  }, [loadSlots, loadCoupons]);

  const handleCreateSlot = async () => {
    if (!newLabel.trim()) {
      toast.error("Informe o nome do prêmio.");
      return;
    }
    if (newType === "percent" && (newValue < 1 || newValue > 100)) {
      toast.error("O percentual deve ser entre 1 e 100.");
      return;
    }
    setSaving(true);
    try {
      await fetchJSON(API("/api/admin-coupons"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_slot",
          label: newLabel.trim(),
          type: newType,
          value: newType === "free_shipping" ? 0 : newValue,
          weight: newWeight,
        }),
      });
      toast.success("Prêmio criado!");
      setNewLabel("");
      setNewType("percent");
      setNewValue(5);
      setNewWeight(2);
      await loadSlots();
    } catch (e) {
      toast.error("Erro ao criar prêmio", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSlot = async (slot: Slot) => {
    try {
      await fetchJSON(API("/api/admin-coupons"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_slot", id: slot.id, is_active: !slot.is_active }),
      });
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, is_active: !s.is_active } : s)));
    } catch (e) {
      toast.error("Erro ao atualizar", { description: e instanceof Error ? e.message : "" });
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm("Excluir este prêmio?")) return;
    try {
      await fetchJSON(API("/api/admin-coupons"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_slot", id }),
      });
      toast.success("Prêmio excluído.");
      setSlots((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      toast.error("Erro ao excluir", { description: e instanceof Error ? e.message : "" });
    }
  };

  const now = new Date();
  const activeCoupons = coupons.filter((c) => !c.used && new Date(c.expires_at) > now);
  const usedCoupons = coupons.filter((c) => c.used);
  const expiredCoupons = coupons.filter((c) => !c.used && new Date(c.expires_at) <= now);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="rounded-2xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Roleta de Cupons</h1>
            <p className="text-sm text-slate-500">Gerencie os prêmios e os cupons gerados</p>
          </div>
        </div>

        {/* Criar novo slot */}
        <section className="rounded-[24px] border border-white/80 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-900">Novo prêmio</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Nome do prêmio</span>
              <input
                type="text"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                placeholder="Ex: 5% de desconto"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-red-300"
                value={newType}
                onChange={(e) => setNewType(e.target.value as "percent" | "free_shipping")}
              >
                <option value="percent">Percentual de desconto</option>
                <option value="free_shipping">Frete grátis</option>
              </select>
            </label>

            {newType === "percent" && (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Percentual (%)</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-red-300"
                  value={newValue}
                  onChange={(e) => setNewValue(Number(e.target.value))}
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Peso (probabilidade — maior = mais frequente)
              </span>
              <input
                type="number"
                min={1}
                max={100}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-red-300"
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleCreateSlot}
              disabled={saving}
              className="rounded-2xl bg-red-600 hover:bg-red-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Criar prêmio"}
            </Button>
          </div>
        </section>

        {/* Lista de slots */}
        <section className="rounded-[24px] border border-white/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Prêmios cadastrados</h2>
            <Button variant="ghost" size="sm" onClick={loadSlots} className="rounded-xl">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {loadingSlots ? (
            <div className="py-8 text-center text-sm text-slate-400">Carregando...</div>
          ) : slots.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Nenhum prêmio cadastrado.</div>
          ) : (
            <div className="space-y-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                    slot.is_active ? "border-green-200 bg-green-50" : "border-slate-200 bg-slate-50 opacity-60"
                  }`}
                >
                  <div>
                    <p className="font-bold text-slate-900">{slot.label}</p>
                    <p className="text-xs text-slate-500">
                      Tipo: {slot.type === "free_shipping" ? "Frete grátis" : `${slot.value}% off`} · Peso: {slot.weight}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleSlot(slot)}
                      className="text-slate-500 hover:text-slate-900"
                      title={slot.is_active ? "Desativar" : "Ativar"}
                    >
                      {slot.is_active ? (
                        <ToggleRight className="h-6 w-6 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-6 w-6" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cupons emitidos */}
        <section className="rounded-[24px] border border-white/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">
              Cupons emitidos
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-600">
                {coupons.length}
              </span>
            </h2>
            <div className="flex gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                {activeCoupons.length} ativos
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">
                {usedCoupons.length} usados
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {expiredCoupons.length} expirados
              </span>
            </div>
          </div>
          {loadingCoupons ? (
            <div className="py-8 text-center text-sm text-slate-400">Carregando...</div>
          ) : coupons.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Nenhum cupom emitido ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="pb-2 pr-4 font-semibold">Código</th>
                    <th className="pb-2 pr-4 font-semibold">Telefone</th>
                    <th className="pb-2 pr-4 font-semibold">Prêmio</th>
                    <th className="pb-2 pr-4 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Validade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {coupons.slice(0, 50).map((c) => {
                    const expired = new Date(c.expires_at) <= now;
                    const status = c.used ? "Usado" : expired ? "Expirado" : "Ativo";
                    const statusColor = c.used
                      ? "text-blue-600 bg-blue-50"
                      : expired
                      ? "text-slate-400 bg-slate-50"
                      : "text-green-700 bg-green-50";
                    return (
                      <tr key={c.id} className="text-slate-700">
                        <td className="py-2 pr-4 font-mono font-bold">{c.code}</td>
                        <td className="py-2 pr-4 text-slate-500">{c.customer_phone}</td>
                        <td className="py-2 pr-4">{c.label}</td>
                        <td className="py-2 pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusColor}`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-slate-400">
                          {new Date(c.expires_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {coupons.length > 50 && (
                <p className="mt-3 text-center text-xs text-slate-400">
                  Exibindo 50 de {coupons.length} cupons.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
