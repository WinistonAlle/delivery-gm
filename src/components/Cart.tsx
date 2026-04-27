import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDisplayProductPrice } from "../../shared/productPricing";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Clock,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { FREE_SHIPPING_THRESHOLD } from "@/data/shipping";
import { MIN_PACKAGES, MIN_WEIGHT_KG } from "@/data/products";
import {
  captureAbandonmentIfNeeded,
  incrementMetric,
  markCartDraft,
} from "@/lib/deliveryEnhancements";
import { trackCustomerEvent } from "@/lib/customerInsights";
import {
  CUSTOMER_SESSION_EVENT,
  getCustomerSession,
} from "@/lib/customerAuth";
import { COUPONS_ENABLED } from "@/lib/featureFlags";

function useCouponCountdown(active: boolean) {
  const expiresRef = useRef<number | null>(null);
  const [display, setDisplay] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!active) { expiresRef.current = null; return; }
    if (!expiresRef.current) {
      expiresRef.current = Date.now() + 24 * 60 * 60 * 1000;
    }
    const tick = () => {
      const rem = Math.max(0, (expiresRef.current ?? 0) - Date.now());
      const total = Math.floor(rem / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      setDisplay(`${pad(h)}:${pad(m)}:${pad(s)}`);
      setUrgent(total < 3600);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  return { display, urgent };
}

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const {
    cartItems,
    cartTotal,
    isCartOpen,
    closeCart,
    addToCart,
    decreaseQuantity,
    removeFromCart,
    updateQuantity,
    itemsCount,
    packageCount,
    totalWeight,
    meetsMinimumOrder,
    appliedCoupon,
    discountAmount,
    clearCoupon,
  } = useCart();

  const couponCountdown = useCouponCountdown(!!appliedCoupon);
  const [attemptedNext, setAttemptedNext] = useState(false);
  const [hasCustomerSession, setHasCustomerSession] = useState(() => {
    const session = getCustomerSession();
    return !!(session?.id || session?.phone || session?.cpf);
  });

  const safeCartTotal = Number.isFinite(cartTotal) ? cartTotal : 0;
  const missingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - safeCartTotal);
  const hasFreeShipping = cartItems.length > 0 && missingForFreeShipping <= 0;
  const safeTotalWeight = Number.isFinite(totalWeight) ? totalWeight : 0;
  const missingForMinimumWeight = Math.max(0, MIN_WEIGHT_KG - safeTotalWeight);

  useEffect(() => {
    const syncSession = () => {
      const session = getCustomerSession();
      setHasCustomerSession(!!(session?.id || session?.phone || session?.cpf));
    };

    syncSession();
    window.addEventListener(CUSTOMER_SESSION_EVENT, syncSession);
    window.addEventListener("storage", syncSession);

    return () => {
      window.removeEventListener(CUSTOMER_SESSION_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  useEffect(() => {
    markCartDraft(cartItems.length > 0);
  }, [cartItems.length]);

  useEffect(() => {
    if (!isCartOpen) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [isCartOpen]);

  useEffect(() => {
    captureAbandonmentIfNeeded();
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (cartItems.length > 0) {
        incrementMetric("abandonedCartCount");
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [cartItems.length]);

  const handleQuantityChange = (productId: string, value: string) => {
    const quantity = parseInt(value, 10) || 0;
    updateQuantity(productId, quantity);
  };

  const handleClose = () => {
    closeCart();
    setAttemptedNext(false);
  };

  const handleNext = () => {
    setAttemptedNext(true);

    if (!meetsMinimumOrder) return;
    if (cartItems.length === 0) return;
    if (!hasCustomerSession) {
      navigate("/login", {
        state: {
          redirectTo: "/checkout",
        },
      });
      closeCart();
      return;
    }

    incrementMetric("startedCheckoutCount");
    void trackCustomerEvent({
      eventName: "checkout_started",
      metadata: {
        itemsCount,
        packageCount,
        totalWeight,
        cartTotal: safeCartTotal,
      },
    });
    navigate("/checkout");
    closeCart();
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="fixed right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] md:hidden bg-white rounded-full shadow-md"
            aria-label="Fechar carrinho"
          >
            <X className="h-5 w-5" />
          </Button>

          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          <motion.aside
            className="fixed inset-y-0 right-0 z-50 h-[100dvh] max-h-[100dvh] w-full sm:w-96 bg-white shadow-xl flex flex-col overflow-hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
          >
            <div className="shrink-0 bg-red-600 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="text-white hover:bg-white/10"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-xl font-bold flex items-center">
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  {`Carrinho (${itemsCount})`}
                </h2>
              </div>

              <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hidden md:inline-flex">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
              <div className="space-y-3 p-4 pb-6">
                {cartItems.length === 0 ? (
                  <div className="text-center text-gray-500 py-10">
                    <ShoppingCart className="h-14 w-14 mx-auto mb-3 opacity-20" />
                    <p>Seu carrinho está vazio.</p>
                  </div>
                ) : (
                  cartItems.map((item) => {
                    const images = Array.isArray(item.product.images) ? item.product.images : [];
                    const thumb = images[0] || item.product.image_path || "/placeholder.svg";
                    const price = getDisplayProductPrice(item.product);
                    const subtotal = price * item.quantity;

                    return (
                      <div key={item.product.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-200">
                              <img src={thumb} alt={item.product.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="text-sm font-medium line-clamp-2">{item.product.name}</p>
                              <p className="text-sm text-red-600 font-semibold">
                                {price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </p>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-gray-500 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center mt-2">
                          <Button
                            onClick={() => decreaseQuantity(item.product.id)}
                            variant="outline"
                            size="icon"
                            className="rounded-full h-[34.56px] w-[34.56px] md:h-8 md:w-8"
                          >
                            <Minus className="h-[17.28px] w-[17.28px] md:h-4 md:w-4" />
                          </Button>

                          <Input
                            value={String(item.quantity)}
                            onChange={(e) => handleQuantityChange(item.product.id, e.target.value)}
                            className="mx-2 h-[34.56px] w-[51.84px] text-center text-sm md:h-8 md:w-12"
                          />

                          <Button
                            onClick={() => addToCart(item.product)}
                            variant="outline"
                            size="icon"
                            className="rounded-full h-[34.56px] w-[34.56px] md:h-8 md:w-8"
                          >
                            <Plus className="h-[17.28px] w-[17.28px] md:h-4 md:w-4" />
                          </Button>

                          <span className="ml-auto font-semibold text-sm">
                            {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-4 py-2 bg-gray-50 border-t">
                {cartItems.length > 0 ? (
                  <>
                    {missingForFreeShipping > 0 ? (
                      <p className="text-sm mb-1">
                        Faltam <span className="font-bold text-red-600">R$ {missingForFreeShipping.toFixed(2)}</span> para frete grátis.
                      </p>
                    ) : (
                      <Card className="mb-3 border-green-200 bg-green-50 shadow-none">
                        <CardContent className="flex items-center gap-3 p-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                            <BadgeCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-green-800">
                              Parabéns, você atingiu frete grátis!
                            </p>
                            <p className="text-xs text-green-700">
                              Seu pedido já está elegível para entrega sem custo.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    <Progress
                      value={Math.max(0, Math.min(100, (1 - missingForFreeShipping / FREE_SHIPPING_THRESHOLD) * 100))}
                      className="h-2 bg-gray-200"
                    />
                  </>
                ) : null}
              </div>

              <div className="cart-checkout-panel sticky bottom-0 space-y-3 border-t bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-[0_-12px_28px_rgba(15,23,42,0.08)]">
                <div className="text-xs flex items-center gap-3 text-gray-600 bg-gray-50 rounded-md p-2">
                  <span className={packageCount >= MIN_PACKAGES ? "text-green-600 font-bold" : ""}>
                    Pacotes: {packageCount}/{MIN_PACKAGES}
                  </span>
                  <span className={safeTotalWeight >= MIN_WEIGHT_KG ? "text-green-600 font-bold" : ""}>
                    Peso: {safeTotalWeight.toFixed(1)}kg/{MIN_WEIGHT_KG}kg
                  </span>
                </div>

                {!meetsMinimumOrder ? (
                  <p className="text-xs font-medium bg-amber-50 p-2 rounded-md text-amber-700">
                    ⚠️ Pedido mínimo: {MIN_PACKAGES} pacotes diversos ou {MIN_WEIGHT_KG} kg no total.
                  </p>
                ) : null}

                {!meetsMinimumOrder && missingForMinimumWeight > 0 ? (
                  <p className="text-xs text-gray-500">
                    Faltam {missingForMinimumWeight.toFixed(1)} kg para liberar por peso mínimo.
                  </p>
                ) : null}

                <div className="flex justify-between text-sm">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-bold">R$ {safeCartTotal.toFixed(2)}</span>
                </div>

                {COUPONS_ENABLED && appliedCoupon && (
                  <div className={`rounded-xl border px-3 py-2 ${couponCountdown.urgent ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-xs font-bold ${couponCountdown.urgent ? "text-red-800" : "text-green-800"}`}>
                          {appliedCoupon.type === "free_shipping"
                            ? "🚚 Frete grátis aplicado"
                            : `🎉 ${appliedCoupon.value}% de desconto`}
                        </p>
                        <p className={`text-[11px] ${couponCountdown.urgent ? "text-red-600" : "text-green-600"}`}>
                          Cupom: {appliedCoupon.code}
                        </p>
                        {couponCountdown.display && (
                          <div className="mt-1 flex items-center gap-1">
                            <Clock className={`h-3 w-3 ${couponCountdown.urgent ? "text-red-500" : "text-amber-500"}`} />
                            <span className={`font-mono text-[11px] font-bold tabular-nums ${couponCountdown.urgent ? "text-red-600" : "text-amber-700"}`}>
                              {couponCountdown.display}
                            </span>
                            {couponCountdown.urgent && (
                              <span className="text-[10px] font-semibold text-red-500">— corre!</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {discountAmount > 0 && (
                          <p className="text-sm font-bold text-green-700">
                            -{discountAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        )}
                        <button
                          onClick={clearCoupon}
                          className="text-[10px] text-slate-400 hover:text-red-500 underline"
                        >
                          remover
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {meetsMinimumOrder && missingForFreeShipping > 0 ? (
                  <Card className="border-amber-200 bg-amber-50 shadow-none">
                    <CardContent className="p-3">
                      <p className="text-sm font-semibold text-amber-900">
                        Você tem certeza que quer continuar?
                      </p>
                      <p className="text-xs text-amber-800">
                        Falta R$ {missingForFreeShipping.toFixed(2)} pra você ganhar o frete grátis!
                      </p>
                    </CardContent>
                  </Card>
                ) : null}

                <Button
                  className="w-full bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 disabled:text-white/80"
                  size="lg"
                  onClick={handleNext}
                  disabled={!meetsMinimumOrder || cartItems.length === 0}
                >
                  <span>Ir para checkout</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                {attemptedNext && cartItems.length === 0 ? (
                  <p className="text-red-500 text-xs">⚠️ Adicione itens ao carrinho para continuar</p>
                ) : null}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default Cart;
