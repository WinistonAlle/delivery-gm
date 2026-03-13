import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  statusLabel,
  DELIVERY_STATUSES,
  getDeliveryMetrics,
} from "@/lib/deliveryEnhancements";
import { Button } from "@/components/ui/button";

type OrderRow = {
  id: string;
  order_number: string | null;
  employee_name: string | null;
  employee_cpf: string | null;
  status: string | null;
  total_value: number | null;
  created_at: string;
};

const DeliveryOps: React.FC = () => {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const metrics = getDeliveryMetrics();

  async function loadOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, employee_name, employee_cpf, status, total_value, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error) setOrders((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function updateStatus(orderId: string, status: string) {
    setSavingId(orderId);
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (!error) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    }
    setSavingId(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Operação Delivery</h1>
          <Button onClick={loadOrders} variant="outline">
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Checkout iniciado</p>
            <p className="text-2xl font-bold">{metrics.startedCheckoutCount}</p>
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Pedido concluído</p>
            <p className="text-2xl font-bold">{metrics.finishedOrderCount}</p>
          </div>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500">Carrinho abandonado</p>
            <p className="text-2xl font-bold">{metrics.abandonedCartCount}</p>
          </div>
        </div>

        {loading ? <p>Carregando pedidos...</p> : null}

        <div className="grid gap-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-semibold">{order.order_number || order.id}</p>
                  <p className="text-sm text-gray-600">{order.employee_name || "Cliente"}</p>
                  <p className="text-xs text-gray-500">{order.employee_cpf || "-"}</p>
                  <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString("pt-BR")}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{statusLabel(order.status || "")}</span>
                  <select
                    value={(order.status || "recebido").toLowerCase()}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    disabled={savingId === order.id}
                    className="border rounded-md px-3 py-2 text-sm"
                  >
                    {DELIVERY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DeliveryOps;
