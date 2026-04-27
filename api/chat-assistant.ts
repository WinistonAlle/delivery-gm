import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertRateLimit, isRateLimitError } from "./_lib/rateLimit";

type ChatProduct = {
  id?: string;
  name?: string;
  category?: string;
  price?: number;
  packageInfo?: string;
  weight?: number;
  inStock?: boolean;
};

type ChatPayload = {
  question?: string;
  localAnswer?: string;
  customer?: {
    firstName?: string | null;
    city?: string | null;
  };
  cart?: {
    itemsCount?: number;
    cartTotal?: number;
    packageCount?: number;
    totalWeight?: number;
    freeShippingRemaining?: number;
    shippingCost?: number | null;
    shippingCity?: string | null;
    meetsMinimumOrder?: boolean;
    items?: Array<{
      name?: string;
      quantity?: number;
      category?: string;
      price?: number;
      packageInfo?: string;
    }>;
  };
  products?: ChatProduct[];
};

function getRequestIp(req: VercelRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw ?? req.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePayload(body: unknown): ChatPayload {
  const input = body && typeof body === "object" ? (body as ChatPayload) : {};
  const question = cleanText(input.question, 500);
  const localAnswer = cleanText(input.localAnswer, 900);

  const products = Array.isArray(input.products)
    ? input.products.slice(0, 36).map((product) => ({
        id: cleanText(product.id, 80),
        name: cleanText(product.name, 120),
        category: cleanText(product.category, 80),
        price: cleanNumber(product.price),
        packageInfo: cleanText(product.packageInfo, 120),
        weight: cleanNumber(product.weight),
        inStock: product.inStock !== false,
      }))
    : [];

  const cartItems = Array.isArray(input.cart?.items)
    ? input.cart.items.slice(0, 20).map((item) => ({
        name: cleanText(item.name, 120),
        quantity: cleanNumber(item.quantity) ?? 0,
        category: cleanText(item.category, 80),
        price: cleanNumber(item.price),
        packageInfo: cleanText(item.packageInfo, 120),
      }))
    : [];

  return {
    question,
    localAnswer,
    customer: {
      firstName: cleanText(input.customer?.firstName, 60) || null,
      city: cleanText(input.customer?.city, 80) || null,
    },
    cart: {
      itemsCount: cleanNumber(input.cart?.itemsCount) ?? 0,
      cartTotal: cleanNumber(input.cart?.cartTotal) ?? 0,
      packageCount: cleanNumber(input.cart?.packageCount) ?? 0,
      totalWeight: cleanNumber(input.cart?.totalWeight) ?? 0,
      freeShippingRemaining: cleanNumber(input.cart?.freeShippingRemaining) ?? 0,
      shippingCost:
        input.cart?.shippingCost === null ? null : cleanNumber(input.cart?.shippingCost) ?? null,
      shippingCity: cleanText(input.cart?.shippingCity, 80) || null,
      meetsMinimumOrder: input.cart?.meetsMinimumOrder === true,
      items: cartItems,
    },
    products,
  };
}

function extractOutputText(response: unknown) {
  const outputText = (response as { output_text?: unknown })?.output_text;
  if (typeof outputText === "string" && outputText.trim()) return outputText.trim();

  const output = (response as { output?: unknown })?.output;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      const content = (item as { content?: unknown })?.content;
      return Array.isArray(content) ? content : [];
    })
    .map((contentItem) => {
      const text = (contentItem as { text?: unknown })?.text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join(" ")
    .trim();
}

function buildDeveloperInstructions() {
  return [
    "Voce e o agente de IA do catalogo delivery da Gostinho Mineiro.",
    "Responda em portugues do Brasil, com tom simples, util e de loja.",
    "Use somente os dados enviados no contexto para falar de produtos, precos, frete, estoque, pedido minimo e carrinho.",
    "Nao invente produtos, precos, cidades atendidas, prazos, cupons ou politicas.",
    "Quando a pergunta envolver valor exato, frete, pedido minimo, preparo ou pagamento, preserve a resposta local enviada como fonte principal.",
    "Quando a pergunta for aberta, ajude a escolher produtos e explique em uma resposta curta.",
    "Se o cliente estiver logado e houver primeiro nome, use o nome naturalmente, sem exagerar.",
    "Nao peca dados sensiveis. Para finalizar compra, oriente a seguir pelo carrinho/checkout.",
    "Responda com no maximo 700 caracteres.",
  ].join(" ");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    assertRateLimit(`chat-ai:${getRequestIp(req)}`, {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
      return res.status(429).json({ error: error.message });
    }
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "AI agent is not configured." });
  }

  const payload = normalizePayload(req.body);
  if (!payload.question) {
    return res.status(400).json({ error: "Pergunta obrigatória." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.2",
        store: false,
        max_output_tokens: 220,
        input: [
          {
            role: "developer",
            content: [{ type: "input_text", text: buildDeveloperInstructions() }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(payload),
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        cleanText((data as { error?: { message?: string } } | null)?.error?.message, 240) ||
        "Erro ao consultar o agente de IA.";
      return res.status(response.status >= 500 ? 502 : response.status).json({ error: message });
    }

    const answer = cleanText(extractOutputText(data), 900);
    if (!answer) {
      return res.status(502).json({ error: "O agente de IA não retornou uma resposta." });
    }

    return res.status(200).json({ answer });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "O agente de IA demorou para responder."
        : "Erro ao consultar o agente de IA.";
    return res.status(502).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
}
