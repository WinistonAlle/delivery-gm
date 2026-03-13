import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
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
  } = useCart();

  const [attemptedNext, setAttemptedNext] = useState(false);

  const safeCartTotal = Number.isFinite(cartTotal) ? cartTotal : 0;
  const missingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - safeCartTotal);
  const hasCustomerSession = useMemo(() => {
    try {
      const raw = localStorage.getItem("employee_session");
      if (!raw) return false;
      const session = JSON.parse(raw);
      return !!(session?.id || session?.phone || session?.cpf);
    } catch {
      return false;
    }
  }, [isCartOpen]);

  useEffect(() => {
    markCartDraft(cartItems.length > 0);
  }, [cartItems.length]);

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
            className="fixed top-4 right-4 z-50 md:hidden bg-white rounded-full shadow-md"
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
            className="fixed top-0 right-0 z-50 h-screen w-full sm:w-96 bg-white shadow-xl flex flex-col overflow-hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
          >
            <div className="p-4 bg-red-600 text-white flex justify-between items-center">
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

            <>
              <ScrollArea className="flex-grow overflow-y-auto">
                <div className="p-4 space-y-3">
                  {cartItems.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">
                      <ShoppingCart className="h-14 w-14 mx-auto mb-3 opacity-20" />
                      <p>Seu carrinho está vazio.</p>
                    </div>
                  ) : (
                    cartItems.map((item) => {
                      const images = Array.isArray(item.product.images) ? item.product.images : [];
                      const thumb = images[0] || item.product.image_path || "/placeholder.svg";
                      const price = Number(item.product.employee_price ?? item.product.price ?? 0);
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
              </ScrollArea>

              <div className="px-4 py-2 bg-gray-50 border-t">
                {cartItems.length > 0 ? (
                  <>
                    {missingForFreeShipping > 0 ? (
                      <p className="text-sm mb-1">
                        Faltam <span className="font-bold text-red-600">R$ {missingForFreeShipping.toFixed(2)}</span> para frete grátis.
                      </p>
                    ) : (
                      <p className="text-sm mb-1 text-green-700 font-semibold">Frete grátis liberado.</p>
                    )}
                    <Progress
                      value={Math.max(0, Math.min(100, (1 - missingForFreeShipping / FREE_SHIPPING_THRESHOLD) * 100))}
                      className="h-2 bg-gray-200"
                    />
                  </>
                ) : null}
              </div>

              <div className="p-4 border-t bg-white space-y-3">
                <div className="text-xs flex items-center gap-3 text-gray-600 bg-gray-50 rounded-md p-2">
                  <span className={packageCount >= MIN_PACKAGES ? "text-green-600 font-bold" : ""}>
                    Pacotes: {packageCount}/{MIN_PACKAGES}
                  </span>
                  <span className={totalWeight >= MIN_WEIGHT_KG ? "text-green-600 font-bold" : ""}>
                    Peso: {totalWeight.toFixed(1)}/{MIN_WEIGHT_KG}kg
                  </span>
                </div>

                {!meetsMinimumOrder ? (
                  <p className="text-xs font-medium bg-amber-50 p-2 rounded-md text-amber-700">
                    ⚠️ Pedido mínimo: {MIN_PACKAGES} pacotes diversos ou {MIN_WEIGHT_KG}kg no total.
                  </p>
                ) : null}

                <div className="flex justify-between text-sm">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-bold">R$ {safeCartTotal.toFixed(2)}</span>
                </div>

                <Button className="w-full bg-red-600 hover:bg-red-700 text-white" size="lg" onClick={handleNext}>
                  <span>Ir para checkout</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                {attemptedNext && cartItems.length === 0 ? (
                  <p className="text-red-500 text-xs">⚠️ Adicione itens ao carrinho para continuar</p>
                ) : null}
              </div>
            </>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default Cart;
