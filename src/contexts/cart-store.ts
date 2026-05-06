import { createContext } from "react";
import type { Product, CartItem } from "@/types/products";
import type { PriceTable } from "../../shared/productPricing";

export type AppliedCoupon = {
  code: string;
  type: "percent" | "free_shipping";
  value: number;
  label: string;
};

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
  retailSubtotal: number;
  activePriceTable: PriceTable;
  wholesaleRemaining: number;
  itemsCount: number;
  freeShippingRemaining: number;
  totalWeight: number;
  packageCount: number;
  meetsMinimumOrder: boolean;
  addMultipleToCart: (products: { product: Product; quantity: number }[]) => void;
  animateCartIcon: number;
  showFreeShippingAnimation: boolean;
  appliedCoupon: AppliedCoupon | null;
  discountAmount: number;
  applyCoupon: (coupon: AppliedCoupon) => void;
  clearCoupon: () => void;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);
