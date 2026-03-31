import type { Product } from "@/types/products";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CreateOrderParams {
  customerPhone: string;
  customerName: string;
  customerDocumentCpf?: string;
  customerAddress?: string;
  customerCity?: string;
  customerCep?: string;
  paymentMethod?: string;
  notes?: string;
  shippingCost?: number;
  items: CartItem[];
}

interface CreateOrderResponse {
  orderId: string;
  orderNumber: string;
  total: number;
}

function buildApiUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResponse> {
  const response = await fetch(buildApiUrl("/api/orders"), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (response.ok) {
    return (await response.json()) as CreateOrderResponse;
  }
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(payload?.error || "Nao foi possivel registrar o pedido.");
}
