import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { createOrder } from "@/services/orders";
import type { Product } from "@/types/products";
import logo from "../images/logoc.png";
import { fetchAddressFromCEP, formatCEP } from "@/utils/formatUtils";
import { incrementMetric } from "@/lib/deliveryEnhancements";
import { loadPlacementRecommendations } from "@/lib/deliveryOffers";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES } from "@/data/shipping";
import { findCustomerByPhone } from "@/lib/customerAuth";

function safeGetSession() {
  try {
    const raw = localStorage.getItem("employee_session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const onlyDigits = (v: string) => v.replace(/\D/g, "");
const PRODUCTS_CACHE_KEY = "gm_catalog_products_v1";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatPaymentMethodLabel = (paymentMethod: string) => {
  if (paymentMethod === "card") return "Cartão";
  if (paymentMethod === "pix") return "Pix";
  if (paymentMethod === "cash") return "Dinheiro";
  return paymentMethod || "Não informado";
};

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, cartTotal, clearCart, addToCart } = useCart();

  const session = useMemo(() => safeGetSession() ?? {}, []);
  const customerDocumentCpf = (session as any)?.document_cpf?.toString?.() ?? "";

  const [customerName, setCustomerName] = useState(session?.full_name ?? session?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(session?.phone ?? session?.cpf ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(session?.address ?? "");
  const [deliveryCep, setDeliveryCep] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [addressOptions, setAddressOptions] = useState<string[]>(
    Array.isArray((session as any)?.addresses) ? (session as any).addresses : []
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutSuggestions, setCheckoutSuggestions] = useState<Product[]>([]);
  const shippingCost = useMemo(() => {
    if (!selectedCity) return 0;
    const city = SHIPPING_RATES.find((rate) => rate.city === selectedCity);
    return Number(city?.cost ?? 0);
  }, [selectedCity]);
  const isFreeShipping = cartTotal >= FREE_SHIPPING_THRESHOLD;
  const finalShipping = selectedCity ? (isFreeShipping ? 0 : shippingCost) : 0;
  const finalTotal = cartTotal + finalShipping;

  const canSubmit =
    customerName.trim().length >= 3 &&
    onlyDigits(customerPhone).length >= 10 &&
    deliveryAddress.trim().length >= 6 &&
    selectedCity.trim().length > 0 &&
    paymentMethod.trim().length > 0 &&
    cartItems.length > 0;

  useEffect(() => {
    const cleanPhone = onlyDigits(customerPhone || session?.phone || session?.cpf || "");
    if (!cleanPhone) return;

    const savedCustomer = findCustomerByPhone(cleanPhone);
    if (!savedCustomer) return;

    if (!deliveryAddress.trim() && savedCustomer.address?.trim()) {
      setDeliveryAddress(savedCustomer.address.trim());
    }

    if (addressOptions.length === 0) {
      const savedAddresses = Array.isArray(savedCustomer.addresses)
        ? savedCustomer.addresses.map((address) => String(address).trim()).filter(Boolean)
        : [savedCustomer.address].map((address) => String(address).trim()).filter(Boolean);

      if (savedAddresses.length > 0) {
        setAddressOptions(Array.from(new Set(savedAddresses)));
      }
    }
  }, [customerPhone, deliveryAddress, addressOptions.length, session]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
        if (!raw) return;
        const catalog = JSON.parse(raw) as Product[];
        if (!Array.isArray(catalog) || !catalog.length) return;

        const suggested = await loadPlacementRecommendations("checkout", catalog);
        if (!mounted) return;

        const cartIds = new Set(cartItems.map((item) => String(item.product.id)));
        setCheckoutSuggestions(
          suggested
            .filter((product) => product.inStock !== false && !cartIds.has(String(product.id)))
            .slice(0, 3)
        );
      } catch {
        if (!mounted) return;
        setCheckoutSuggestions([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [cartItems]);

  const handleConfirm = async () => {
    if (!canSubmit) {
      toast.error("Dados incompletos", {
        description: "Preencha nome, telefone, endereço, cidade e pagamento para confirmar o pedido.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanPhone = onlyDigits(customerPhone);

      const { orderNumber } = await createOrder({
        employeeCpf: cleanPhone,
        employeeName: `${customerName.trim()} | Tel: ${cleanPhone} | End: ${deliveryAddress.trim()}${
          selectedCity ? ` | Cidade: ${selectedCity}` : ""
        }${paymentMethod ? ` | Pgto: ${paymentMethod}` : ""}${
          finalShipping > 0 ? ` | Frete: R$ ${finalShipping.toFixed(2)}` : " | Frete: Grátis"
        }${notes.trim() ? ` | Obs: ${notes.trim()}` : ""}`,
        items: cartItems.map((ci) => ({
          product: ci.product,
          quantity: ci.quantity,
        })),
      });

      localStorage.setItem(
        "employee_session",
        JSON.stringify({
          ...(session ?? {}),
          id: `customer-${cleanPhone}`,
          full_name: customerName.trim(),
          name: customerName.trim(),
          cpf: cleanPhone,
          phone: cleanPhone,
          address: deliveryAddress.trim(),
          addresses: Array.from(
            new Set(
              [...addressOptions, deliveryAddress.trim()]
                .map((a) => (a || "").trim())
                .filter(Boolean)
            )
          ),
          role: (session as any)?.role ?? "customer",
        })
      );

      clearCart();
      incrementMetric("finishedOrderCount");

      toast.success("Pedido confirmado", {
        description: `Pedido ${orderNumber} recebido com sucesso.`,
      });

      const itemsSummary = cartItems
        .map((item, index) => {
          const unitPrice = Number(item.product.employee_price ?? item.product.price ?? 0);
          const subtotal = unitPrice * item.quantity;
          return `${index + 1}. ${item.product.name}\nQtd: ${item.quantity}\nValor unitário: ${formatCurrency(
            unitPrice
          )}\nSubtotal: ${formatCurrency(subtotal)}`;
        })
        .join("\n\n");

      const messageLines = [
        "NOVO PEDIDO DELIVERY",
        "",
        "DADOS DO CLIENTE",
        `Nome: ${customerName.trim()}`,
        `Telefone: ${cleanPhone}`,
        `CPF: ${customerDocumentCpf || "Não informado"}`,
        "",
        "ENTREGA",
        `Endereço: ${deliveryAddress.trim()}`,
        `Cidade: ${selectedCity || "Não informada"}`,
        "",
        "PAGAMENTO",
        `Forma: ${formatPaymentMethodLabel(paymentMethod)}`,
        `Frete: ${finalShipping > 0 ? formatCurrency(finalShipping) : "Grátis"}`,
        `Total: ${formatCurrency(finalTotal)}`,
        "",
        "ITENS DO PEDIDO",
        itemsSummary,
      ];

      if (notes.trim()) {
        messageLines.push("", "OBSERVAÇÕES", notes.trim());
      }

      const msg = encodeURIComponent(messageLines.join("\n"));
      window.open(`https://wa.me/5561985941557?text=${msg}`, "_blank", "noopener,noreferrer");

      navigate("/meus-pedidos", { replace: true });
    } catch (err: any) {
      toast.error("Erro ao finalizar pedido", {
        description: err?.message || "Tente novamente em alguns instantes.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-6 text-center">
          <img src={logo} alt="Logo" className="mx-auto mb-4 h-16 w-auto select-none" />
          <h1 className="text-xl font-semibold mb-2">Seu carrinho está vazio</h1>
          <p className="text-sm text-gray-600 mb-6">Adicione produtos no catálogo para continuar.</p>
          <Button onClick={() => navigate("/catalogo")}>Voltar para o catálogo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 flex justify-center">
      <div className="w-full max-w-3xl bg-white border rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex justify-center mb-4">
          <img src={logo} alt="Logo" className="h-20 w-auto select-none" />
        </div>

        <h1 className="text-2xl font-bold mb-1">Finalizar pedido delivery</h1>
        <p className="text-sm text-gray-600 mb-6">Confirme seus dados e revise os itens.</p>

        <div className="grid gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Telefone</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Endereço de entrega</label>
            {addressOptions.length > 0 ? (
              <select
                className="w-full rounded-lg border px-3 py-2 mb-2"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) setDeliveryAddress(e.target.value);
                }}
                disabled={isSubmitting}
              >
                <option value="">Usar endereço salvo</option>
                {addressOptions.map((addr) => (
                  <option key={addr} value={addr}>
                    {addr}
                  </option>
                ))}
              </select>
            ) : null}
            <textarea
              className="w-full rounded-lg border px-3 py-2 min-h-20"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">CEP (opcional)</label>
            <div className="flex gap-2">
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={formatCEP(deliveryCep)}
                onChange={(e) => setDeliveryCep(e.target.value)}
                disabled={isSubmitting}
                placeholder="00000-000"
              />
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    const data = await fetchAddressFromCEP(deliveryCep);
                    if (data?.erro) {
                      toast.error("CEP não encontrado.");
                      return;
                    }
                    const suffix = `${data.logradouro || ""} ${data.bairro || ""} ${
                      data.localidade || ""
                    }/${data.uf || ""}`.trim();
                    if (!suffix) return;
                    setDeliveryAddress((prev) => (prev ? prev : suffix));
                  } catch {
                    toast.error("Não foi possível validar o CEP.");
                  }
                }}
              >
                Validar
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cidade de entrega</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Selecione sua cidade</option>
              {SHIPPING_RATES.map((rate) => (
                <option key={rate.city} value={rate.city}>
                  {rate.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Forma de pagamento</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Selecione uma forma de pagamento</option>
              <option value="card">Cartão de crédito/débito</option>
              <option value="pix">Pix</option>
              <option value="cash">Dinheiro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observações (opcional)</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2 min-h-20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ex.: sem cebola, ponto de referência..."
            />
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {cartItems.map((item) => (
            <div key={item.product.id} className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="font-medium text-sm md:text-base">{item.product.name}</p>
                <p className="text-xs md:text-sm text-gray-600">
                  {item.quantity} x {Number(item.product.employee_price ?? 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>

              <p className="font-semibold text-sm md:text-base">
                {(Number(item.product.employee_price ?? 0) * item.quantity).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mb-6">
          <span className="text-lg font-semibold">Total:</span>
          <span className="text-xl font-bold">
            {finalTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>

        {checkoutSuggestions.length > 0 ? (
          <div className="mb-6 rounded-2xl themed-panel-soft p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Talvez você queira adicionar
            </p>
            <div className="mt-2 space-y-2">
              {checkoutSuggestions.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-2 rounded-xl themed-panel p-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <img
                      src={product.images?.[0] || product.image_path || "/placeholder.png"}
                      alt={product.name}
                      className="h-9 w-9 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.category}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => addToCart(product)}
                  >
                    +{" "}
                    {Number(product.employee_price ?? product.price ?? 0).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(selectedCity || paymentMethod || shippingCost > 0) ? (
          <div className="mb-6 rounded-lg bg-gray-50 border p-3 text-sm space-y-1">
            {selectedCity ? (
              <p>
                <span className="font-medium">Cidade:</span> {selectedCity}
              </p>
            ) : null}
            {paymentMethod ? (
              <p>
                <span className="font-medium">Pagamento:</span> {formatPaymentMethodLabel(paymentMethod)}
              </p>
            ) : null}
            <p>
              <span className="font-medium">Frete:</span>{" "}
              {finalShipping > 0
                ? finalShipping.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                : "Grátis"}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col md:flex-row gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/catalogo")} disabled={isSubmitting}>
            Voltar para o catálogo
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? "Enviando..." : "Confirmar pedido"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
