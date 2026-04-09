import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronRight,
  CreditCard,
  MapPin,
  MessageCircleMore,
  Package2,
  Smartphone,
  Sparkles,
  Truck,
  UserRound,
} from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/useCart";
import { createOrder } from "@/services/orders";
import type { Product } from "@/types/products";
import logo from "../images/logoc.png";
import { incrementMetric } from "@/lib/deliveryEnhancements";
import { loadPlacementRecommendations } from "@/lib/deliveryOffers";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES } from "@/data/shipping";
import { STORE_WHATSAPP } from "@/data/products";
import {
  createAdditionalCustomerAddress,
  type CustomerSession,
  findCustomerByPhone,
  getCustomerSession,
  saveCustomerSession,
} from "@/lib/customerAuth";
import { trackCustomerEvent, trackCustomerEventOnce } from "@/lib/customerInsights";
import { createFullAddress, fetchAddressFromCEP, formatCEP } from "@/utils/formatUtils";

function safeGetSession() {
  return getCustomerSession() as CustomerSession | null;
}

const onlyDigits = (v: string) => v.replace(/\D/g, "");
const PRODUCTS_CACHE_KEY = "gm_catalog_products_v1";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatKg = (value: number) => `${value.toFixed(2)}kg`;

const normalizeMatch = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const inferShippingCityFromAddress = (address: string) => {
  const normalizedAddress = normalizeMatch(address);
  if (!normalizedAddress) return "";

  const match = SHIPPING_RATES.find((rate) => {
    const normalizedCity = normalizeMatch(rate.city);
    return normalizedAddress.includes(`${normalizedCity}/`) || normalizedAddress.includes(`, ${normalizedCity}/`) || normalizedAddress.includes(normalizedCity);
  });

  return match?.city ?? "";
};

const normalizeApiUrl = (path: string) => {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
};

const formatPaymentMethodLabel = (paymentMethod: string) => {
  if (paymentMethod === "card") return "Cartão";
  if (paymentMethod === "pix") return "Pix";
  if (paymentMethod === "cash") return "Dinheiro";
  return paymentMethod || "Não informado";
};

const paymentOptions = [
  {
    value: "pix",
    label: "Pix",
    subtitle: "Pagamento rápido",
    icon: Smartphone,
  },
  {
    value: "card",
    label: "Cartão",
    subtitle: "Crédito ou débito",
    icon: CreditCard,
  },
  {
    value: "cash",
    label: "Dinheiro",
    subtitle: "Pagamento na entrega",
    icon: Truck,
  },
] as const;

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, cartTotal, clearCart, addToCart } = useCart();

  const [session, setSession] = useState<CustomerSession | null>(() => safeGetSession());
  const customerDocumentCpf = session?.document_cpf?.toString?.() ?? "";
  const customerCep = session?.cep?.toString?.() ?? "";
  const customerCity = session?.city?.toString?.() ?? "";
  const customerHowFoundUs = session?.how_found_us?.toString?.() ?? "";
  const customerHowFoundUsDetails = session?.how_found_us_details?.toString?.() ?? "";

  const [customerName, setCustomerName] = useState(session?.full_name ?? session?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(session?.phone ?? session?.cpf ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(session?.address ?? "");
  const [deliveryCep, setDeliveryCep] = useState(customerCep);
  const [selectedCity, setSelectedCity] = useState(customerCity);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(
    session?.saved_addresses?.find((item) => item.is_primary)?.id ??
      session?.saved_addresses?.[0]?.id ??
      ""
  );
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddressCep, setNewAddressCep] = useState("");
  const [newAddressStreet, setNewAddressStreet] = useState("");
  const [newAddressNumber, setNewAddressNumber] = useState("");
  const [newAddressComplement, setNewAddressComplement] = useState("");
  const [newAddressDistrict, setNewAddressDistrict] = useState("");
  const [newAddressLocalCity, setNewAddressLocalCity] = useState("");
  const [newAddressState, setNewAddressState] = useState("");
  const [newAddressRegion, setNewAddressRegion] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isLoadingNewAddressCep, setIsLoadingNewAddressCep] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutSuggestions, setCheckoutSuggestions] = useState<Product[]>([]);
  const lastFetchedNewAddressCepRef = useRef("");
  const shippingCost = useMemo(() => {
    if (!selectedCity) return 0;
    const city = SHIPPING_RATES.find((rate) => rate.city === selectedCity);
    return Number(city?.cost ?? 0);
  }, [selectedCity]);
  const isFreeShipping = cartTotal >= FREE_SHIPPING_THRESHOLD;
  const finalShipping = selectedCity ? (isFreeShipping ? 0 : shippingCost) : 0;
  const finalTotal = cartTotal + finalShipping;
  const newAddressSummary = useMemo(
    () =>
      createFullAddress(
        newAddressStreet.trim(),
        newAddressNumber.trim(),
        newAddressComplement.trim(),
        newAddressDistrict.trim(),
        newAddressLocalCity.trim(),
        newAddressState.trim()
      ),
    [
      newAddressStreet,
      newAddressNumber,
      newAddressComplement,
      newAddressDistrict,
      newAddressLocalCity,
      newAddressState,
    ]
  );

  const canSubmit =
    customerName.trim().length >= 3 &&
    onlyDigits(customerPhone).length >= 10 &&
    deliveryAddress.trim().length >= 6 &&
    selectedCity.trim().length > 0 &&
    paymentMethod.trim().length > 0 &&
    cartItems.length > 0;
  const savedAddresses = useMemo(() => {
    if (session?.saved_addresses?.length) return session.saved_addresses;
    if (!session?.address) return [];
    return [
      {
        id: "fallback-address",
        address: session.address,
        city: customerCity,
        cep: customerCep,
        label: "",
        is_primary: true,
      },
    ];
  }, [customerCep, customerCity, session]);

  useEffect(() => {
    trackCustomerEventOnce("checkout_view", {
      eventName: "checkout_view",
      metadata: {
        itemsCount: cartItems.length,
        cartTotal,
      },
    });
  }, [cartItems.length, cartTotal]);

  useEffect(() => {
    const cleanPhone = onlyDigits(customerPhone || session?.phone || session?.cpf || "");
    if (!cleanPhone) return;

    const savedCustomer = findCustomerByPhone(cleanPhone);
    if (!savedCustomer) return;

    if (!deliveryAddress.trim() && savedCustomer.address?.trim()) {
      setDeliveryAddress(savedCustomer.address.trim());
    }
  }, [customerPhone, deliveryAddress, session]);

  useEffect(() => {
    if (!savedAddresses.length) return;

    const selectedAddress =
      savedAddresses.find((item) => item.id === selectedSavedAddressId) ??
      savedAddresses.find((item) => item.is_primary) ??
      savedAddresses[0];

    if (!selectedAddress) return;

    setSelectedSavedAddressId(selectedAddress.id);
    setDeliveryAddress(selectedAddress.address);
    setDeliveryCep(selectedAddress.cep);
    setSelectedCity(selectedAddress.city);
  }, [savedAddresses, selectedSavedAddressId]);

  useEffect(() => {
    if (selectedSavedAddressId) return;
    if (customerCity.trim()) {
      setSelectedCity(customerCity.trim());
      return;
    }

    if (!deliveryAddress.trim()) return;
    const inferredCity = inferShippingCityFromAddress(deliveryAddress);
    if (inferredCity) {
      setSelectedCity(inferredCity);
    }
  }, [customerCity, deliveryAddress, selectedSavedAddressId]);

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

  const resetNewAddressForm = useCallback(() => {
    setNewAddressCep("");
    setNewAddressStreet("");
    setNewAddressNumber("");
    setNewAddressComplement("");
    setNewAddressDistrict("");
    setNewAddressLocalCity("");
    setNewAddressState("");
    setNewAddressRegion("");
    lastFetchedNewAddressCepRef.current = "";
  }, []);

  const handleCloseNewAddressModal = useCallback(() => {
    setShowNewAddressForm(false);
    resetNewAddressForm();
  }, [resetNewAddressForm]);

  const fetchNewAddressCepAndFill = useCallback(async (rawCep: string) => {
    const normalizedCep = onlyDigits(rawCep);
    if (normalizedCep.length !== 8 || isLoadingNewAddressCep) return;

    setIsLoadingNewAddressCep(true);
    try {
      const data = await fetchAddressFromCEP(normalizedCep);
      if (data?.erro) {
        toast.error("CEP não encontrado", {
          description: "Confira o CEP informado para continuar.",
        });
        return;
      }

      lastFetchedNewAddressCepRef.current = normalizedCep;
      setNewAddressStreet(data.logradouro || "");
      setNewAddressDistrict(data.bairro || "");
      setNewAddressLocalCity(data.localidade || "");
      setNewAddressState((data.uf || "").toUpperCase());
    } catch {
      toast.error("Erro ao consultar CEP", {
        description: "Não foi possível buscar os dados do endereço agora.",
      });
    } finally {
      setIsLoadingNewAddressCep(false);
    }
  }, [isLoadingNewAddressCep]);

  useEffect(() => {
    const normalizedCep = onlyDigits(newAddressCep);
    if (normalizedCep.length !== 8) {
      if (lastFetchedNewAddressCepRef.current !== normalizedCep) {
        lastFetchedNewAddressCepRef.current = "";
      }
      return;
    }

    if (lastFetchedNewAddressCepRef.current === normalizedCep) return;
    void fetchNewAddressCepAndFill(normalizedCep);
  }, [fetchNewAddressCepAndFill, newAddressCep]);

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
      const howFoundLabel = customerHowFoundUsDetails
        ? `${customerHowFoundUs} - ${customerHowFoundUsDetails}`
        : customerHowFoundUs || "Não informado";

      const { orderNumber } = await createOrder({
        customerPhone: cleanPhone,
        customerName: customerName.trim(),
        customerDocumentCpf,
        customerAddress: deliveryAddress.trim(),
        customerCity: selectedCity,
        customerCep: onlyDigits(deliveryCep),
        paymentMethod,
        notes: notes.trim(),
        shippingCost: finalShipping,
        items: cartItems.map((ci) => ({
          product: ci.product,
          quantity: ci.quantity,
        })),
      });

      const updatedSession: CustomerSession = {
        ...(session ?? {}),
        id: `customer-${cleanPhone}`,
        full_name: customerName.trim(),
        name: customerName.trim(),
        cpf: cleanPhone,
        phone: cleanPhone,
        document_cpf: customerDocumentCpf,
        cep: onlyDigits(deliveryCep),
        city: selectedCity,
        address: deliveryAddress.trim(),
        addresses: Array.from(
          new Set([
            deliveryAddress.trim(),
            ...(session?.saved_addresses?.map((item) => item.address) ?? []),
          ].filter(Boolean))
        ),
        saved_addresses:
          session?.saved_addresses?.length
            ? session.saved_addresses
            : [
                {
                  id: "checkout-address",
                  address: deliveryAddress.trim(),
                  city: selectedCity,
                  cep: onlyDigits(deliveryCep),
                  label: "",
                  is_primary: true,
                },
              ],
        role: session?.role ?? "customer",
        is_admin: session?.is_admin ?? false,
        how_found_us: session?.how_found_us ?? "",
        how_found_us_details: session?.how_found_us_details ?? "",
      };
      saveCustomerSession(updatedSession);
      setSession(updatedSession);

      clearCart();
      incrementMetric("finishedOrderCount");

      toast.success("Pedido confirmado", {
        description: `Pedido ${orderNumber} recebido com sucesso.`,
      });

      void trackCustomerEvent({
        eventName: "order_completed",
        customerName: customerName.trim(),
        phone: cleanPhone,
        documentCpf: customerDocumentCpf,
        metadata: {
          selectedCity,
          paymentMethod,
          finalShipping,
          finalTotal,
          itemsCount: cartItems.length,
        },
      });

      const itemsSummary = cartItems
        .map((item) => {
          const unitPrice = Number(item.product.employee_price ?? item.product.price ?? 0);
          const totalWeight = Number(item.product.weight ?? 0) * item.quantity;
          const packageInfo = String(item.product.packageInfo ?? "").trim();
          const code = item.product.old_id ?? item.product.id;
          return `${item.quantity}x ${item.product.name.toUpperCase()} - ${
            packageInfo || "UN"
          } - ${formatCurrency(unitPrice)} - Peso total: ${formatKg(totalWeight)} - ${code}`;
        })
        .join("\n");

      const messageLines = [
        "*Novo Pedido*",
        "",
        "*Produtos:*",
        itemsSummary,
        "",
        `*Entrega para:* ${selectedCity || "Não informada"}`,
        `*Taxa de entrega:* ${finalShipping > 0 ? formatCurrency(finalShipping) : "Grátis"}`,
        `*Forma de pagamento:* ${formatPaymentMethodLabel(paymentMethod)}`,
        "",
        "*Dados do Cliente:*",
        `Nome: ${customerName.trim()}`,
        `CPF: ${customerDocumentCpf || "Não informado"}`,
        `Endereço: ${deliveryAddress.trim()}`,
        `CEP: ${formatCEP(deliveryCep) || "Não informado"}`,
        `Como nos conheceu: ${howFoundLabel}`,
        "",
        `*Total:* ${formatCurrency(finalTotal)}`,
      ];

      if (notes.trim()) {
        messageLines.push("", `Observações: ${notes.trim()}`);
      }

      const msg = encodeURIComponent(messageLines.join("\n"));
      const whatsappUrl = `https://wa.me/${STORE_WHATSAPP}?text=${msg}`;

      if (typeof window !== "undefined") {
        window.location.href = whatsappUrl;
      }

      navigate("/meus-pedidos", { replace: true });
    } catch (err: unknown) {
      toast.error("Erro ao finalizar pedido", {
        description: err instanceof Error ? err.message : "Tente novamente em alguns instantes.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAdditionalAddress = async () => {
    if (
      newAddressStreet.trim().length < 3 ||
      newAddressNumber.trim().length < 1 ||
      newAddressDistrict.trim().length < 2 ||
      newAddressLocalCity.trim().length < 2 ||
      newAddressState.trim().length !== 2 ||
      newAddressRegion.trim().length < 2 ||
      onlyDigits(newAddressCep).length !== 8
    ) {
      toast.error("Endereço incompleto", {
        description: "Preencha o endereço completo, CEP e região de entrega para salvar.",
      });
      return;
    }

    setIsSavingAddress(true);
    try {
      const fullNewAddress = newAddressSummary.trim();
      const updatedSession = await createAdditionalCustomerAddress({
        address: fullNewAddress,
        city: newAddressRegion.trim(),
        cep: onlyDigits(newAddressCep),
        setPrimary: false,
      });

      const createdAddress =
        updatedSession.saved_addresses.find(
          (item) =>
            item.address.trim() === fullNewAddress &&
            item.city.trim() === newAddressRegion.trim() &&
            item.cep === onlyDigits(newAddressCep)
        ) ?? updatedSession.saved_addresses[0];

      saveCustomerSession(updatedSession);
      setSession(updatedSession);
      setSelectedSavedAddressId(createdAddress?.id ?? "");
      setDeliveryAddress(createdAddress?.address ?? fullNewAddress);
      setDeliveryCep(createdAddress?.cep ?? onlyDigits(newAddressCep));
      setSelectedCity(createdAddress?.city ?? newAddressRegion.trim());
      handleCloseNewAddressModal();

      toast.success("Endereço salvo", {
        description: "Novo endereço cadastrado com sucesso.",
      });
    } catch (error) {
      toast.error("Erro ao salvar endereço", {
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
      });
    } finally {
      setIsSavingAddress(false);
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
    <div className="min-h-screen bg-white px-4 py-6 md:px-6 md:py-10">
      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_400px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
            className="space-y-5"
          >
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className="rounded-[30px] border border-white/80 bg-white/88 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-6"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Confirmação</h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Nome</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{customerName || "Não informado"}</p>
                </div>

                <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Telefone</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{customerPhone || "Não informado"}</p>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="rounded-[30px] border border-white/80 bg-white/88 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-6"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Entrega</h2>
                  <p className="text-sm text-slate-500">Confira o endereço cadastrado e a cidade vinculada ao seu cadastro para calcular o frete.</p>
                </div>
              </div>

              {savedAddresses.length > 0 ? (
                <div className="mb-4">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Endereços salvos</span>
                  <div className="grid gap-3">
                    {savedAddresses.map((item) => {
                      const isSelected = item.id === selectedSavedAddressId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedSavedAddressId(item.id);
                            setShowNewAddressForm(false);
                          }}
                          disabled={isSubmitting || isSavingAddress}
                          className={`rounded-[24px] border px-4 py-4 text-left transition ${
                            isSelected
                              ? "border-red-300 bg-red-50 shadow-[0_16px_32px_rgba(239,68,68,0.12)]"
                              : "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                          <div>
                              <p className="text-sm font-bold text-slate-900">
                                {item.label || (item.is_primary ? "Endereço principal" : "Outro endereço")}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">{item.address}</p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                {item.city || "Cidade não informada"}
                              </p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                CEP {formatCEP(item.cep) || "não informado"}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                                Usando
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mb-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-slate-200"
                  onClick={() => setShowNewAddressForm(true)}
                  disabled={isSubmitting || isSavingAddress}
                >
                  Cadastrar outro endereço
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Endereço de entrega</span>
                  <div className="min-h-[112px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900">
                    {deliveryAddress || "Nenhum endereço selecionado"}
                  </div>
                </label>

                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Cidade</span>
                    <div className="flex min-h-[56px] items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[15px] font-medium text-slate-900">
                      {selectedCity || "Cidade não informada no cadastro"}
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">CEP</span>
                    <div className="flex min-h-[56px] items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[15px] font-medium text-slate-900">
                      {formatCEP(deliveryCep) || "CEP não informado"}
                    </div>
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {selectedCity ? (
                      <span>
                        Frete para <strong className="text-slate-900">{selectedCity}</strong>:{" "}
                        <strong className="text-slate-900">{finalShipping > 0 ? formatCurrency(finalShipping) : "Grátis"}</strong>
                      </span>
                    ) : (
                      <span>Seu cadastro precisa ter uma cidade preenchida para liberar a confirmação do pedido.</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.24 }}
              className="rounded-[30px] border border-white/80 bg-white/88 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-6"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Pagamento e observações</h2>
                  <p className="text-sm text-slate-500">
                    Selecione uma forma de pagamento para liberar a confirmação do pedido.
                  </p>
                </div>
              </div>

              {!paymentMethod ? (
                <div className="mb-4 rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  Escolha o método de pagamento antes de confirmar o pedido.
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-3">
                {paymentOptions.map((option) => {
                  const Icon = option.icon;
                  const active = paymentMethod === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPaymentMethod(option.value)}
                      disabled={isSubmitting}
                      className={`rounded-[28px] border px-4 py-4 text-left transition ${
                        active
                          ? "border-red-500 bg-red-600 text-white shadow-[0_18px_36px_rgba(220,38,38,0.28)]"
                          : paymentMethod
                            ? "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50"
                            : "border-red-200 bg-white hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50"
                      }`}
                    >
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${active ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-base font-black">{option.label}</p>
                      <p className={`mt-1 text-sm ${active ? "text-red-50" : "text-slate-500"}`}>{option.subtitle}</p>
                    </button>
                  );
                })}
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Observações</span>
                <textarea
                  className="min-h-[112px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                />
              </label>
            </motion.section>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: "easeOut" }}
            className="space-y-5 xl:sticky xl:top-6 xl:self-start"
          >
            <section className="overflow-hidden rounded-[32px] border border-white/80 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
              <div className="bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.45),transparent_45%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Resumo</p>
                    <h2 className="mt-1 text-2xl font-black">Seu pedido</h2>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <Package2 className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {cartItems.map((item, index) => {
                    const unitPrice = Number(item.product.employee_price ?? 0);
                    const subtotal = unitPrice * item.quantity;
                    return (
                      <motion.div
                        key={item.product.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: 0.04 * index }}
                        className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-bold text-white">{item.product.name}</p>
                            <p className="mt-1 text-xs text-white/60">
                              {item.quantity} x {formatCurrency(unitPrice)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-black text-white">{formatCurrency(subtotal)}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="mt-5 space-y-3 rounded-[26px] border border-white/10 bg-white/6 p-4">
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Subtotal</span>
                    <span className="font-semibold text-white">{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Frete</span>
                    <span className="font-semibold text-white">{finalShipping > 0 ? formatCurrency(finalShipping) : "Grátis"}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white/80">Total final</span>
                    <span className="text-2xl font-black text-white">{formatCurrency(finalTotal)}</span>
                  </div>
                </div>

                <div className="mt-4 rounded-[26px] border border-amber-200/20 bg-amber-300/10 p-4 text-sm text-amber-50">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-200/20">
                      <MessageCircleMore className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="font-black text-white">Importante</p>
                      <p className="mt-1 leading-6 text-white/80">
                        Depois de confirmar o pedido, o WhatsApp vai abrir com a mensagem pronta. Confira e toque em enviar para concluir.
                      </p>
                    </div>
                  </div>
                </div>

                {(selectedCity || paymentMethod) ? (
                  <div className="mt-4 grid gap-2 text-sm text-white/70">
                    {selectedCity ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Cidade
                        </span>
                        <span className="font-semibold text-white">{selectedCity}</span>
                      </div>
                    ) : null}
                    {paymentMethod ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Pagamento
                        </span>
                        <span className="font-semibold text-white">{formatPaymentMethodLabel(paymentMethod)}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3">
                  <Button
                    variant="outline"
                    className="h-[52px] rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => navigate("/catalogo")}
                    disabled={isSubmitting}
                  >
                    Voltar para o catálogo
                  </Button>
                  <Button
                    className="h-[56px] rounded-2xl bg-red-600 text-base font-bold shadow-[0_18px_36px_rgba(220,38,38,0.35)] hover:bg-red-700"
                    onClick={handleConfirm}
                    disabled={isSubmitting || !canSubmit}
                  >
                    {isSubmitting
                      ? "Preparando WhatsApp..."
                      : !paymentMethod
                        ? "Selecione o pagamento"
                        : "Confirmar pedido"}
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            </section>

            {checkoutSuggestions.length > 0 ? (
              <section className="rounded-[30px] border border-white/80 bg-white/88 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Sugestoes</p>
                    <h2 className="text-lg font-black text-slate-950">Talvez voce queira adicionar</h2>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {checkoutSuggestions.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: 0.08 * index }}
                      className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={product.images?.[0] || product.image_path || "/placeholder.png"}
                          alt={product.name}
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-bold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.category}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => addToCart(product)}
                      >
                        + {formatCurrency(Number(product.employee_price ?? product.price ?? 0))}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </section>
            ) : null}

          </motion.aside>
        </div>
      </div>

      {showNewAddressForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-white/70 bg-white p-5 shadow-[0_30px_100px_rgba(15,23,42,0.3)] md:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-950">Novo endereço</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-slate-200"
                onClick={handleCloseNewAddressModal}
                disabled={isSavingAddress}
              >
                Fechar
              </Button>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">CEP</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-900 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
                    value={formatCEP(newAddressCep)}
                    onChange={(e) => setNewAddressCep(e.target.value)}
                    disabled={isSubmitting || isSavingAddress}
                    placeholder="00000-000"
                  />
                  {isLoadingNewAddressCep ? (
                    <span className="mt-2 block text-xs text-slate-500">Buscando endereço pelo CEP...</span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Região de entrega</span>
                  <select
                    className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-900 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
                    value={newAddressRegion}
                    onChange={(e) => setNewAddressRegion(e.target.value)}
                    disabled={isSubmitting || isSavingAddress}
                  >
                    <option value="">Selecione a região</option>
                    {SHIPPING_RATES.map((rate) => (
                      <option key={rate.city} value={rate.city}>
                        {rate.city}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Rua / logradouro</span>
                <input
                  type="text"
                  className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
                  value={newAddressStreet}
                  onChange={(e) => setNewAddressStreet(e.target.value)}
                  disabled={isSubmitting || isSavingAddress}
                  placeholder="Rua / logradouro"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Número</span>
                  <input
                    type="text"
                    className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
                    value={newAddressNumber}
                    onChange={(e) => setNewAddressNumber(e.target.value)}
                    disabled={isSubmitting || isSavingAddress}
                    placeholder="Número"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Complemento</span>
                  <input
                    type="text"
                    className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
                    value={newAddressComplement}
                    onChange={(e) => setNewAddressComplement(e.target.value)}
                    disabled={isSubmitting || isSavingAddress}
                    placeholder="Complemento"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Bairro</span>
                <input
                  type="text"
                  className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
                  value={newAddressDistrict}
                  onChange={(e) => setNewAddressDistrict(e.target.value)}
                  disabled={isSubmitting || isSavingAddress}
                  placeholder="Bairro"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Cidade</span>
                  <input
                    type="text"
                    className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
                    value={newAddressLocalCity}
                    onChange={(e) => setNewAddressLocalCity(e.target.value)}
                    disabled={isSubmitting || isSavingAddress}
                    placeholder="Cidade do endereço"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">UF</span>
                  <input
                    type="text"
                    maxLength={2}
                    className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
                    value={newAddressState}
                    onChange={(e) =>
                      setNewAddressState(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))
                    }
                    disabled={isSubmitting || isSavingAddress}
                    placeholder="UF"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Resumo do endereço</span>
                <textarea
                  className="min-h-[112px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 outline-none"
                  value={newAddressSummary}
                  readOnly
                  placeholder="O endereço completo aparece aqui."
                />
              </label>

              <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-slate-200"
                  onClick={handleCloseNewAddressModal}
                  disabled={isSavingAddress}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl bg-red-600 text-base font-bold hover:bg-red-700"
                  onClick={handleSaveAdditionalAddress}
                  disabled={isSubmitting || isSavingAddress}
                >
                  {isSavingAddress ? "Salvando endereço..." : "Salvar endereço"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Checkout;
