import { createContext } from "react";
import type { Product, CartItem } from "@/types/products";

export interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  decreaseQuantity: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  cartTotal: number;
  itemsCount: number;
  freeShippingRemaining: number;
  totalWeight: number;
  packageCount: number;
  meetsMinimumOrder: boolean;
  addMultipleToCart: (products: { product: Product; quantity: number }[]) => void;
  animateCartIcon: number;
  showFreeShippingAnimation: boolean;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);
