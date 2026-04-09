import React, { useState, useEffect } from "react";
import { Product, CartItem } from "../types/products";
import { FREE_SHIPPING_THRESHOLD } from "../data/shipping";
import { deriveIsPackage, deriveWeightKg } from "@/utils/productMetrics";
import { trackCustomerEventOnce } from "@/lib/customerInsights";
import { CUSTOMER_SESSION_EVENT, getCustomerSession } from "@/lib/customerAuth";
import { meetsMinimumOrder as satisfiesMinimumOrder } from "../../shared/orderRules";
import { getDisplayProductPrice } from "../../shared/productPricing";
import { CartContext, type CartContextType } from "@/contexts/cart-store";

// Gera uma assinatura do cliente atual pra separar os carrinhos.
function getCustomerSignature(): string {
  try {
    const session = getCustomerSession();
    if (!session) return "anon";

    const signature = session.phone || session.cpf || session.id || session.full_name;
    if (typeof signature === "string" && signature.trim().length > 0) {
      return signature.trim();
    }

    return JSON.stringify(session);
  } catch {
    return "anon";
  }
}

function normalizeProductForMetrics(product: Product): Product {
  return {
    ...product,
    weight: deriveWeightKg(product),
    isPackage: deriveIsPackage(product),
  };
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [animateCartIcon, setAnimateCartIcon] = useState(0);

  // ✅ Pop-up/animação de frete grátis REMOVIDOS
  const showFreeShippingAnimation = false;

  // 🧾 Assinatura do usuário atual (se mudar, a gente troca de carrinho)
  const [customerSignature, setCustomerSignature] = useState<string>(() => {
    if (typeof window === "undefined") return "anon";
    return getCustomerSignature();
  });
  // Chave final usada no localStorage
  const cartStorageKey = `cart_${customerSignature}`;

  // Observa mudanças na sessão do cliente na mesma aba.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncSignature = () => {
      const current = getCustomerSignature();
      setCustomerSignature((previous) => {
        if (current !== previous) console.log("[CartContext] customer_session mudou, trocando carrinho...");
        return current;
      });
    };

    const onSessionChange = () => {
      syncSignature();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "customer_session" && event.key !== "employee_session") return;
      syncSignature();
    };

    setCustomerSignature(getCustomerSignature());
    window.addEventListener(CUSTOMER_SESSION_EVENT, onSessionChange);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(CUSTOMER_SESSION_EVENT, onSessionChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // 📥 Carrega o carrinho sempre que o "dono" (assinatura) mudar
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedCart = localStorage.getItem(cartStorageKey);
      if (storedCart) {
        setCartItems(JSON.parse(storedCart));
      } else if (customerSignature !== "anon") {
        const anonCart = localStorage.getItem("cart_anon");
        if (anonCart) {
          const parsed = JSON.parse(anonCart);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCartItems(parsed);
            localStorage.setItem(cartStorageKey, JSON.stringify(parsed));
            localStorage.removeItem("cart_anon");
          } else {
            setCartItems([]);
          }
        } else {
          setCartItems([]);
        }
      } else {
        setCartItems([]);
      }

      console.log("[CartContext] Carrinho carregado para", cartStorageKey);
    } catch (e) {
      console.error("Error parsing stored cart for key", cartStorageKey, e);
      setCartItems([]);
    }
  }, [cartStorageKey, customerSignature]);

  // 💰 Total do carrinho
  const cartTotal = cartItems.reduce(
    (total, item) => total + getDisplayProductPrice(item.product) * item.quantity,
    0
  );

  // Quanto falta pro frete grátis (se você exibe isso em algum lugar)
  const freeShippingRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD - cartTotal);

  // 💾 Salva o carrinho SEMPRE vinculado ao usuário atual
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
    } catch (e) {
      console.error("Error saving cart for key", cartStorageKey, e);
    }
  }, [cartItems, cartStorageKey]);

  const addToCart = (product: Product, quantity: number = 1) => {
    console.log(
      "CartContext - addToCart called with product:",
      product.name,
      "quantity:",
      quantity
    );
    trackCustomerEventOnce("cart_started", {
      eventName: "cart_started",
      metadata: {
        firstProductId: String(product.id),
        firstProductName: product.name,
      },
    });
    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        return prevItems.map((item) =>
          item.product.id === product.id
              ? {
                  ...item,
                  product: normalizeProductForMetrics(item.product),
                  quantity: item.quantity + quantity,
                }
              : item
        );
      } else {
        return [...prevItems, { product: normalizeProductForMetrics(product), quantity }];
      }
    });

    setAnimateCartIcon((prev) => prev + 1);
  };

  const addMultipleToCart = (
    products: { product: Product; quantity: number }[]
  ) => {
    console.log(
      "CartContext - addMultipleToCart called with products:",
      products.map((p) => p.product.name)
    );
    setCartItems((prevItems) => {
      const newItems = [...prevItems];

      products.forEach(({ product, quantity }) => {
        const existingItemIndex = newItems.findIndex(
          (item) => item.product.id === product.id
        );

        if (existingItemIndex >= 0) {
          newItems[existingItemIndex].product = normalizeProductForMetrics(
            newItems[existingItemIndex].product
          );
          newItems[existingItemIndex].quantity += quantity;
        } else {
          newItems.push({ product: normalizeProductForMetrics(product), quantity });
        }
      });

      return newItems;
    });

    setAnimateCartIcon((prev) => prev + 1);
  };

  const decreaseQuantity = (productId: string) => {
    console.log("CartContext - decreaseQuantity called for productId:", productId);
    setCartItems((prevItems) => {
      return prevItems
        .map((item) => {
          if (item.product.id === productId) {
            const newQuantity = Math.max(0, item.quantity - 1);
            return newQuantity === 0 ? null : { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    console.log("CartContext - removeFromCart called for productId:", productId);
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.product.id !== productId)
    );
  };

  const updateQuantity = (productId: string, quantity: number) => {
    console.log("CartContext - updateQuantity called:", productId, quantity);

    if (quantity <= 0) {
      console.log("CartContext - removing item because quantity <= 0");
      removeFromCart(productId);
      return;
    }

    setCartItems((prevItems) => {
      console.log("CartContext - current cart items:", prevItems);
      const existingItemIndex = prevItems.findIndex(
        (item) => item.product.id === productId
      );

      if (existingItemIndex === -1) {
        console.log("CartContext - item not found in cart, can't update");
        return prevItems;
      }

      const newItems = prevItems.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      );
      console.log("CartContext - updated cart items:", newItems);
      return newItems;
    });
  };

  const clearCart = () => {
    console.log("CartContext - clearCart called");
    setCartItems([]);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(cartStorageKey);
      }
    } catch (e) {
      console.error("Error clearing cart for key", cartStorageKey, e);
    }
  };

  const toggleCart = () => setIsCartOpen((prev) => !prev);
  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const itemsCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const totalWeight = cartItems.reduce((total, item) => {
    const w = deriveWeightKg(item.product);
    return total + w * item.quantity;
  }, 0);

  const packageCount = cartItems.reduce((count, item) => {
    const isPkg = deriveIsPackage(item.product);
    return isPkg ? count + item.quantity : count;
  }, 0);

  const meetsMinimumOrder = satisfiesMinimumOrder({
    packageCount,
    orderValue: cartTotal,
  });

  const value: CartContextType = {
    cartItems,
    addToCart,
    decreaseQuantity,
    removeFromCart,
    updateQuantity,
    clearCart,
    isCartOpen,
    toggleCart,
    openCart,
    closeCart,
    cartTotal,
    itemsCount,
    freeShippingRemaining,
    totalWeight,
    packageCount,
    meetsMinimumOrder,
    addMultipleToCart,
    animateCartIcon,
    showFreeShippingAnimation,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
