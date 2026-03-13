import React, { useEffect, useState } from "react";
import { ShoppingCart, Package, Weight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { MIN_ORDER_VALUE, MIN_PACKAGES } from "@/data/products";

const CartToggle: React.FC = () => {
  const {
    openCart,
    itemsCount,
    cartTotal,
    packageCount,
    totalWeight,
    freeShippingRemaining,
    animateCartIcon,
  } = useCart();

  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!animateCartIcon) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [animateCartIcon]);

  return (
    <div className="fixed left-3 right-3 bottom-[72px] md:left-auto md:right-6 md:bottom-6 z-40">
      <div className="flex flex-col gap-2 md:items-end">
        <div className="md:hidden rounded-2xl border border-white/80 bg-white/78 backdrop-blur-2xl px-3 py-2 shadow-[0_16px_36px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between text-[11px] text-slate-700">
            <span className={packageCount >= MIN_PACKAGES ? "font-bold text-green-700" : ""}>
              <Package className="inline h-3.5 w-3.5 mr-1" />
              {packageCount}/{MIN_PACKAGES}
            </span>
            <span className={cartTotal >= MIN_ORDER_VALUE ? "font-bold text-green-700" : ""}>
              <Weight className="inline h-3.5 w-3.5 mr-1" />
              R$ {cartTotal.toFixed(2)}/R$ {MIN_ORDER_VALUE.toFixed(2)}
            </span>
            <span className={freeShippingRemaining <= 0 ? "font-bold text-green-700" : "font-semibold"}>
              {freeShippingRemaining <= 0 ? "Frete grátis" : `Faltam R$ ${freeShippingRemaining.toFixed(2)}`}
            </span>
          </div>
        </div>

        <Button
          onClick={openCart}
          className={`relative w-full md:w-auto bg-red-600 hover:bg-red-700 text-white px-[5.4vw] py-[3.78vw] md:px-4 md:py-3 rounded-2xl md:rounded-full shadow-[0_18px_36px_rgba(220,38,38,0.35)] flex items-center justify-between md:justify-start gap-2 ${
            pulse ? "animate-[pulse_0.6s_ease-in-out_1]" : ""
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingCart className={`h-[21.6px] w-[21.6px] md:h-5 md:w-5 ${pulse ? "text-yellow-300" : ""}`} />
            <span className="text-[15px] font-semibold md:hidden">Abrir carrinho</span>
          </span>

          <span className="font-bold text-[17px] md:text-sm">
            {cartTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>

          {itemsCount > 0 ? (
            <span className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-bold rounded-full h-[25.92px] w-[25.92px] md:h-6 md:w-6 flex items-center justify-center border-2 border-red-600">
              {itemsCount}
            </span>
          ) : null}
        </Button>
      </div>
    </div>
  );
};

export default CartToggle;
