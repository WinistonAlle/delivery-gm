import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, MapPin, MessageCircle, Package2, Send, ShoppingCart, Sparkles, X } from "lucide-react";
import {
  MIN_PACKAGES,
  MIN_WEIGHT_KG,
  PRODUCTS,
  TOP_SELLING_PRODUCTS,
} from "@/data/products";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES } from "@/data/shipping";
import { normalizeText } from "@/utils/stringUtils";
import type { CartItem, Product } from "@/types/products";
import { useCart } from "@/contexts/useCart";
import {
  CUSTOMER_SESSION_EVENT,
  getCustomerSession,
  type CustomerSession,
} from "@/lib/customerAuth";
import { getShippingCostForCity } from "../../shared/orderRules";
import { getDisplayProductPrice } from "../../shared/productPricing";
import { PREPARATION_VIDEOS, type PreparationVideo } from "@/data/preparationVideos";

type ChatMessage = {
  id: string;
  role: "bot" | "user";
  content: string;
};

type AssistantContext = {
  session: CustomerSession | null;
  cartItems: CartItem[];
  itemsCount: number;
  cartTotal: number;
  packageCount: number;
  totalWeight: number;
  meetsMinimumOrder: boolean;
  freeShippingRemaining: number;
  shippingCost: number | null;
  shippingCity: string | null;
};

const QUICK_QUESTIONS = [
  "Quais pães de queijo vocês têm?",
  "Me indique produtos para começar",
  "Quantos salgados para 50 pessoas?",
  "Qual é o frete para minha região?",
  "Quanto é 12 x 7?",
  "Me indique produtos para festa",
];

const CATEGORY_ALIASES = [
  { category: "Pão de Queijo", aliases: ["pao de queijo", "paes de queijo", "pdq"] },
  { category: "Salgados Assados", aliases: ["assado", "assados", "forno"] },
  { category: "Salgados P/ Fritar", aliases: ["fritar", "fritos", "fritura"] },
  { category: "Pães e Massas Doces", aliases: ["doce", "doces", "massa doce"] },
  { category: "Biscoito de Queijo", aliases: ["biscoito de queijo", "biscoito"] },
  { category: "Salgados Grandes", aliases: ["salgado grande", "salgados grandes"] },
  { category: "Kits e Combos", aliases: ["combo", "combos", "kit", "kits"] },
  { category: "Alho em creme", aliases: ["alho em creme", "alho"] },
];

function normalizeQuestion(question: string) {
  return normalizeText(question).replace(/\s+/g, " ").trim();
}

function tokenizeQuestion(question: string) {
  return normalizeQuestion(question)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4))).replace(".", ",");
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function isApproxWordMatch(source: string, target: string) {
  if (source === target) return true;
  if (!source || !target) return false;

  const maxLength = Math.max(source.length, target.length);
  const distance = levenshteinDistance(source, target);

  if (maxLength <= 4) return distance <= 1;
  if (maxLength <= 7) return distance <= 2;
  return distance <= 3;
}

function hasApproxPhrase(question: string, phrase: string) {
  const normalizedQuestion = normalizeQuestion(question);
  const normalizedPhrase = normalizeQuestion(phrase);

  if (normalizedQuestion.includes(normalizedPhrase)) return true;

  const questionTokens = tokenizeQuestion(question);
  const rawPhraseTokens = normalizedPhrase
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
  const phraseTokens = rawPhraseTokens.filter(
    (token) => token.length >= 3 || rawPhraseTokens.length === 1
  );

  if (!phraseTokens.length) return false;

  return phraseTokens.every((phraseToken) =>
    questionTokens.some((questionToken) => isApproxWordMatch(questionToken, phraseToken))
  );
}

function questionHasAny(question: string, variants: string[]) {
  return variants.some((variant) => hasApproxPhrase(question, variant));
}

function extractNumber(question: string) {
  const match = question.match(/(\d{1,4})/);
  if (!match) return null;
  return Number(match[1]);
}

function findShippingCity(question: string) {
  return SHIPPING_RATES.find((rate) => hasApproxPhrase(question, rate.city));
}

function roundUpPackages(quantity: number, packageSize = 50) {
  return Math.ceil(quantity / packageSize);
}

function getProductPrice(product: Product) {
  const value = getDisplayProductPrice(product);
  return formatCurrency(value);
}

function inferCategory(question: string) {
  const match = CATEGORY_ALIASES.find(({ aliases }) => questionHasAny(question, aliases));
  return match?.category ?? null;
}

function getCategoryProducts(category: string, limit = 4) {
  return PRODUCTS.filter(
    (product) => product.category === category && product.inStock !== false
  )
    .sort(
      (a, b) =>
        Number(b.featured ?? false) - Number(a.featured ?? false) ||
        getDisplayProductPrice(a) - getDisplayProductPrice(b)
    )
    .slice(0, limit);
}

function scoreProductMatch(question: string, product: Product) {
  const normalizedQuestion = normalizeQuestion(question);
  const questionTokens = tokenizeQuestion(question);
  const productTokens = tokenizeQuestion(product.name);
  let score = 0;

  if (normalizedQuestion.includes(normalizeQuestion(product.name))) score += 10;
  if (normalizedQuestion.includes(normalizeQuestion(product.category))) score += 4;
  if (normalizedQuestion.includes(normalizeQuestion(product.packageInfo))) score += 2;

  for (const questionToken of questionTokens) {
    if (questionToken.length < 2) continue;

    if (productTokens.some((productToken) => productToken === questionToken)) {
      score += 3;
      continue;
    }

    if (productTokens.some((productToken) => isApproxWordMatch(productToken, questionToken))) {
      score += 1;
    }
  }

  return score;
}

function findProductMatches(question: string, limit = 3) {
  return PRODUCTS.filter((product) => product.inStock !== false)
    .map((product) => ({ product, score: scoreProductMatch(question, product) }))
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product }) => product);
}

function buildSavorySuggestions(question: string) {
  if (questionHasAny(question, ["assado", "forno"])) {
    const options = getCategoryProducts("Salgados Assados", 3);
    if (options.length) {
      return `Para assados, uma boa seleção é ${options
        .map((item) => item.name)
        .join(", ")}.`;
    }
  }

  if (questionHasAny(question, ["fritar", "frito", "fritura"])) {
    const options = getCategoryProducts("Salgados P/ Fritar", 4);
    if (options.length) {
      return `Para fritura, um mix seguro é ${options
        .map((item) => item.name)
        .join(", ")}.`;
    }
  }

  const partyMix = [
    ...getCategoryProducts("Salgados P/ Fritar", 2),
    ...getCategoryProducts("Salgados Assados", 2),
  ].slice(0, 4);

  if (partyMix.length) {
    return `Para festa, eu sugeriria um mix com ${partyMix
      .map((item) => item.name)
      .join(", ")}.`;
  }

  return "Para festa, um mix equilibrado entre fritos e assados costuma funcionar melhor.";
}

function findPreparationVideo(question: string) {
  const normalizedQuestion = normalizeQuestion(question);
  const wantsTutorial = questionHasAny(question, [
    "video",
    "vídeo",
    "tutorial",
    "short",
    "shorts",
    "modo de preparo",
    "modos de preparo",
    "como fazer",
    "como faz",
    "como prepara",
    "como preparar",
    "como preparar",
    "como fritar",
    "como assar",
    "fazer",
    "faz",
    "preparar",
  ]);

  if (
    !wantsTutorial &&
    !questionHasAny(question, ["preparo", "assar", "fritar", "fazer", "faz"])
  ) {
    return null;
  }

  const scored = PREPARATION_VIDEOS.map((video) => {
    let score = 0;

    for (const keyword of video.keywords) {
      if (hasApproxPhrase(question, keyword)) score += 8;
      else if (normalizedQuestion.includes(normalizeQuestion(keyword))) score += 5;

      const keywordTokens = tokenizeQuestion(keyword);
      const questionTokens = tokenizeQuestion(question);
      const tokenMatches = keywordTokens.filter((keywordToken) =>
        questionTokens.some((questionToken) => isApproxWordMatch(questionToken, keywordToken))
      ).length;

      score += tokenMatches * 2;
    }

    if (questionHasAny(question, [video.category])) score += 2;
    if (questionHasAny(question, [video.title])) score += 6;
    return { video, score };
  })
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.video ?? null;
}

function buildPreparationVideoAnswer(question: string) {
  const video = findPreparationVideo(question);

  if (video) {
    return `Tenho um vídeo para isso: ${video.title}. ${video.videoUrl}`;
  }

  if (
    questionHasAny(question, [
      "video",
      "vídeo",
      "tutorial",
      "short",
      "shorts",
      "modo de preparo",
      "modos de preparo",
    ])
  ) {
    return "Os tutoriais estão na página Modos de preparo, no menu. Se você me disser o produto, eu também posso te mandar o vídeo certo.";
  }

  return "";
}

function evaluateMathExpression(rawExpression: string) {
  const expression = rawExpression
    .replace(/,/g, ".")
    .replace(/[xX×]/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");

  if (!/^[\d+\-*/().%]+$/.test(expression)) return null;
  if (!/\d/.test(expression) || !/[+\-*/%]/.test(expression)) return null;
  if (expression.length > 80) return null;

  try {
    const value = Function(`"use strict"; return (${expression});`)();
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function buildMathAnswer(question: string) {
  const normalized = normalizeQuestion(question);
  const percentMatch = normalized.match(/(\d+(?:[,.]\d+)?)\s*%?\s*(?:por cento|%)?\s*(?:de|sobre)\s*(\d+(?:[,.]\d+)?)/);

  if (percentMatch && questionHasAny(question, ["%", "por cento", "calcula", "quanto"])) {
    const percent = Number(percentMatch[1].replace(",", "."));
    const base = Number(percentMatch[2].replace(",", "."));
    if (Number.isFinite(percent) && Number.isFinite(base)) {
      const result = (percent / 100) * base;
      return `Calculadora secreta ativada: ${formatNumber(percent)}% de ${formatNumber(base)} dá ${formatNumber(result)}. Prometo não contar para o pão de queijo que eu também sei matemática.`;
    }
  }

  const expressionMatch = question.match(/(?:quanto\s+(?:e|é)|calcula(?:r)?|conta|resultado(?: de)?|faz)\s*([0-9xX×÷+\-*/().,%\s]+)/i);
  const looseExpressionMatch = question.match(/^\s*([0-9xX×÷+\-*/().,%\s]{3,})\s*$/);
  const expression = expressionMatch?.[1] ?? looseExpressionMatch?.[1] ?? "";
  const result = evaluateMathExpression(expression);

  if (result === null) return "";

  return `Calculadora secreta ativada: ${expression.trim()} = ${formatNumber(result)}. Eu vim falar de delivery, mas uma continha honesta eu encaro.`;
}

function renderMessageContent(content: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex).filter(Boolean);

  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-red-600 underline underline-offset-4"
        >
          {part}
        </a>
      );
    }

    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
}

function buildPartyAnswer(question: string) {
  const peopleCount = extractNumber(question);
  const isCheeseBread = questionHasAny(question, ["pao de queijo", "pao queijo"]);

  if (!peopleCount) {
    if (isCheeseBread) {
      return "Para pão de queijo em festa, uma conta prática é entre 8 e 12 unidades por pessoa quando há outros itens, ou 12 a 15 quando ele é o destaque principal. Se você me disser quantas pessoas vão, eu calculo em unidades e em pacotes.";
    }

    return "Para festa, a conta mais comum é entre 12 e 18 salgados por pessoa. Se você me disser quantas pessoas vão, eu calculo em unidades e em pacotes de 50.";
  }

  if (isCheeseBread) {
    const low = peopleCount * 8;
    const mid = peopleCount * 10;
    const high = peopleCount * 12;
    const lowPackages = roundUpPackages(low);
    const midPackages = roundUpPackages(mid);
    const highPackages = roundUpPackages(high);
    return `Para ${peopleCount} pessoas, uma boa base de pão de queijo fica entre ${low} e ${high} unidades, o que dá cerca de ${lowPackages} a ${highPackages} pacotes de 50. Se quiser uma conta equilibrada, use cerca de ${mid} unidades, ou ${midPackages} pacotes.`;
  }

  const low = peopleCount * 12;
  const mid = peopleCount * 15;
  const high = peopleCount * 18;
  const lowPackages = roundUpPackages(low);
  const midPackages = roundUpPackages(mid);
  const highPackages = roundUpPackages(high);
  const suggestions = buildSavorySuggestions(question);

  return `Para ${peopleCount} pessoas, uma boa base é entre ${low} e ${high} salgados, o que dá cerca de ${lowPackages} a ${highPackages} pacotes de 50. Se quiser uma conta equilibrada, use cerca de ${mid} unidades, ou ${midPackages} pacotes. ${suggestions}`;
}

function buildOvenAnswer(question: string) {
  const tutorialAnswer = buildPreparationVideoAnswer(question);
  if (tutorialAnswer) return tutorialAnswer;

  const isCheeseBread = questionHasAny(question, ["pao de queijo", "pao queijo"]);
  const hasAirFryer = questionHasAny(question, ["airfryer", "air fryer"]);
  const isFrying = questionHasAny(question, ["fritar", "fritura", "oleo"]);

  if (hasAirFryer && isCheeseBread) {
    return "Para pão de queijo na air fryer, uma boa referência é de 8 a 12 minutos, com o equipamento já aquecido. O ponto ideal é quando ele cresce e fica levemente dourado.";
  }

  if (hasAirFryer) {
    return "Na air fryer, a média costuma ficar entre 8 e 15 minutos, dependendo do tamanho e da potência. O melhor ponto é quando estiver dourado por fora e macio por dentro.";
  }

  if (isFrying) {
    return "Para salgado de fritura, o ideal é óleo quente em fogo médio até dourar por fora sem queimar. Em geral, o tempo fica entre 3 e 6 minutos, dependendo do tamanho e do recheio.";
  }

  if (isCheeseBread) {
    return "Para pão de queijo, uma referência prática é entre 25 e 35 minutos em forno preaquecido a 180°C ou 200°C. O ponto ideal é quando crescer e dourar levemente.";
  }

  return "Como média geral, pães e salgados assados costumam ficar entre 20 e 40 minutos em forno preaquecido, variando com tamanho, recheio e temperatura.";
}

function formatShortName(session: CustomerSession | null) {
  const raw = session?.full_name || session?.name || "";
  const firstName = raw.trim().split(/\s+/)[0];
  return firstName || null;
}

function getSessionCity(session: CustomerSession | null) {
  const city = String(session?.city ?? "").trim();
  return city || null;
}

function getCartCategories(cartItems: CartItem[]) {
  return Array.from(new Set(cartItems.map((item) => item.product.category).filter(Boolean)));
}

function getComplementarySuggestions(cartItems: CartItem[], limit = 4) {
  const cartProductIds = new Set(cartItems.map((item) => String(item.product.id)));
  const categories = getCartCategories(cartItems);

  const preferredCategories = new Set<string>();

  if (categories.includes("Pão de Queijo")) {
    preferredCategories.add("Salgados Assados");
    preferredCategories.add("Pães e Massas Doces");
  }

  if (categories.includes("Salgados P/ Fritar")) {
    preferredCategories.add("Salgados Assados");
    preferredCategories.add("Pão de Queijo");
  }

  if (categories.includes("Salgados Assados")) {
    preferredCategories.add("Pão de Queijo");
    preferredCategories.add("Pães e Massas Doces");
  }

  if (preferredCategories.size === 0) {
    preferredCategories.add("Pão de Queijo");
    preferredCategories.add("Salgados Assados");
    preferredCategories.add("Salgados P/ Fritar");
  }

  return PRODUCTS.filter((product) => {
    if (product.inStock === false) return false;
    if (cartProductIds.has(String(product.id))) return false;
    return preferredCategories.has(product.category);
  })
    .sort(
      (a, b) =>
        Number(b.featured ?? false) - Number(a.featured ?? false) ||
        getDisplayProductPrice(a) - getDisplayProductPrice(b)
    )
    .slice(0, limit);
}

function describeProducts(products: Product[]) {
  return products
    .map((product) => `${product.name} (${getProductPrice(product)}, ${product.packageInfo})`)
    .join("; ");
}

function getRecommendationSet(question: string, context: AssistantContext) {
  if (context.itemsCount > 0 && questionHasAny(question, ["meu carrinho", "completar pedido", "combina", "fechar pedido"])) {
    return {
      intro: "Pelo que já está no seu carrinho, eu completaria com",
      products: getComplementarySuggestions(context.cartItems, 4),
    };
  }

  if (questionHasAny(question, ["revenda", "vender", "mercearia", "padaria", "lanchonete"])) {
    return {
      intro: "Para revenda, eu começaria por itens de giro fácil",
      products: [
        ...getCategoryProducts("Pão de Queijo", 2),
        ...getCategoryProducts("Salgados P/ Fritar", 1),
        ...getCategoryProducts("Salgados Assados", 1),
      ].slice(0, 4),
    };
  }

  if (questionHasAny(question, ["crianca", "criança", "infantil", "escola", "lancheira"])) {
    return {
      intro: "Para crianças ou lanche mais simples, eu iria em opções fáceis de servir",
      products: [
        ...getCategoryProducts("Pão de Queijo", 2),
        ...getCategoryProducts("Salgados Assados", 2),
      ].slice(0, 4),
    };
  }

  if (questionHasAny(question, ["cafe", "cafe da tarde", "lanche", "manha"])) {
    return {
      intro: "Para café da tarde, eu sugiro",
      products: [
        ...getCategoryProducts("Pão de Queijo", 2),
        ...getCategoryProducts("Pães e Massas Doces", 2),
      ].slice(0, 4),
    };
  }

  if (questionHasAny(question, ["festa", "evento", "aniversario", "reuniao", "confraternizacao"])) {
    return {
      intro: "Para festa, eu montaria um mix com",
      products: [
        ...getCategoryProducts("Salgados P/ Fritar", 2),
        ...getCategoryProducts("Salgados Assados", 1),
        ...getCategoryProducts("Pão de Queijo", 1),
      ].slice(0, 4),
    };
  }

  const category = inferCategory(question);
  if (category) {
    return {
      intro: `Dentro de ${category}, eu olharia primeiro`,
      products: getCategoryProducts(category, 4),
    };
  }

  return {
    intro: "Para começar bem no catálogo, eu olharia estes itens",
    products: [
      ...getCategoryProducts("Pão de Queijo", 2),
      ...getCategoryProducts("Salgados Assados", 1),
      ...getCategoryProducts("Salgados P/ Fritar", 1),
    ].slice(0, 4),
  };
}

function buildCartSnapshotAnswer(context: AssistantContext) {
  if (!context.itemsCount) {
    return "Seu carrinho ainda está vazio. Se quiser, eu posso te indicar itens para começar ou te dizer o que mais sai no catálogo.";
  }

  const minimumHint = context.meetsMinimumOrder
    ? "Seu pedido já bate o mínimo."
    : `Seu pedido ainda não bate o mínimo de ${MIN_PACKAGES} pacotes ou ${MIN_WEIGHT_KG} kg.`;

  const shippingHint =
    context.shippingCity && context.shippingCost !== null
      ? context.shippingCost === 0
        ? `Para ${context.shippingCity}, o frete já está grátis.`
        : `Para ${context.shippingCity}, o frete atual está em ${formatCurrency(context.shippingCost)}.`
      : context.freeShippingRemaining > 0
        ? `Faltam ${formatCurrency(context.freeShippingRemaining)} para liberar frete grátis.`
        : "Seu carrinho já liberou frete grátis.";

  return `Hoje seu carrinho está com ${context.itemsCount} item(ns), ${context.packageCount} pacote(s), ${context.totalWeight.toFixed(1)} kg e total de ${formatCurrency(context.cartTotal)}. ${minimumHint} ${shippingHint}`;
}

function buildMinimumOrderAnswer(context: AssistantContext) {
  if (!context.itemsCount) {
    return `Hoje o carrinho trabalha com pedido mínimo de ${MIN_PACKAGES} pacotes ou ${MIN_WEIGHT_KG} kg. Quando você adicionar itens, eu consigo te dizer exatamente o que ainda falta para bater o mínimo.`;
  }

  if (context.meetsMinimumOrder) {
    return `Seu carrinho já atingiu o mínimo. No momento você está com ${context.packageCount} pacote(s), ${context.totalWeight.toFixed(1)} kg e ${formatCurrency(context.cartTotal)} em itens, então já pode seguir para o checkout.`;
  }

  const missingPackages = Math.max(0, MIN_PACKAGES - context.packageCount);
  const missingWeight = Math.max(0, MIN_WEIGHT_KG - context.totalWeight);
  const parts: string[] = [];

  if (missingPackages > 0) {
    parts.push(`${missingPackages} pacote(s)`);
  }

  if (missingWeight > 0) {
    parts.push(`${missingWeight.toFixed(1)} kg`);
  }

  return `Seu carrinho está com ${context.packageCount} pacote(s), ${context.totalWeight.toFixed(1)} kg e ${formatCurrency(context.cartTotal)} em itens. Para atingir o mínimo, ainda faltam ${parts.join(" ou ")}. Se quiser, eu posso te sugerir itens para completar o pedido.`;
}

function buildStorageAnswer(question: string) {
  const mentionsFreezer = questionHasAny(question, ["congelado", "freezer", "armazenar"]);

  if (mentionsFreezer) {
    return "O ideal é manter os produtos congelados até o preparo, preservando a embalagem bem fechada. Depois de descongelar, a recomendação mais segura é preparar sem recongelar.";
  }

  return "Para conservar bem, mantenha o produto congelado até a hora do preparo e evite recongelar depois de descongelado.";
}

function buildCatalogAnswer(question: string) {
  const category = inferCategory(question);
  const matches = findProductMatches(question, 4);

  if (matches.length > 0) {
    return `Encontrei estes itens no catálogo: ${matches
      .map(
        (product) =>
          `${product.name} (${getProductPrice(product)}, ${product.packageInfo})`
      )
      .join("; ")}.`;
  }

  if (category) {
    const products = getCategoryProducts(category, 4);
    if (products.length) {
      return `Na categoria ${category}, eu encontrei: ${products
        .map((product) => `${product.name} (${getProductPrice(product)})`)
        .join("; ")}.`;
    }
  }

  return "";
}

function buildPriceAnswer(question: string) {
  const matches = findProductMatches(question, 3);

  if (matches.length > 0) {
    return `Os preços mais próximos do que você pediu são: ${matches
      .map(
        (product) =>
          `${product.name}: ${getProductPrice(product)} (${product.packageInfo})`
      )
      .join("; ")}.`;
  }

  const category = inferCategory(question);
  if (category) {
    const products = getCategoryProducts(category, 4);
    if (products.length) {
      return `Na categoria ${category}, os itens que mais fazem sentido para você olhar agora são: ${products
        .map((product) => `${product.name}: ${getProductPrice(product)}`)
        .join("; ")}.`;
    }
  }

  return "Os preços aparecem nos cards dos produtos e no carrinho. Se você me disser o nome do item, eu tento localizar o valor exato aqui no catálogo.";
}

function buildBestSellerAnswer(question: string) {
  const topProducts = TOP_SELLING_PRODUCTS.map((name) =>
    PRODUCTS.find((product) => normalizeQuestion(product.name) === normalizeQuestion(name))
  ).filter(Boolean) as Product[];

  if (questionHasAny(question, ["pao de queijo", "pao queijo"])) {
    const cheeseBread = topProducts.filter((product) => product.category === "Pão de Queijo");
    if (cheeseBread.length > 0) {
      return `Entre os pães de queijo com maior saída, eu destacaria ${cheeseBread
        .slice(0, 3)
        .map((product) => `${product.name} (${getProductPrice(product)})`)
        .join("; ")}.`;
    }
  }

  if (topProducts.length > 0) {
    return `Os campeões de venda do catálogo incluem ${topProducts
      .slice(0, 4)
      .map((product) => `${product.name} (${getProductPrice(product)})`)
      .join("; ")}.`;
  }

  return "Entre os itens de maior saída, pão de queijo e salgados de festa costumam ser escolhas fortes.";
}

function buildRecommendationAnswer(question: string, context: AssistantContext) {
  const { intro, products } = getRecommendationSet(question, context);

  if (products.length) {
    const followUp = context.itemsCount > 0
      ? "Eles ajudam a completar o pedido sem repetir o que já está no carrinho."
      : "Se você me disser se é festa, café, revenda ou lanche, eu afino melhor.";

    return `${intro}: ${describeProducts(products)}. ${followUp}`;
  }

  return "Posso te indicar opções para festa, café da tarde, revenda, crianças ou pão de queijo. Se você me disser a ocasião, eu monto uma lista mais certeira.";
}

function buildGreetingAnswer(context: AssistantContext) {
  const firstName = formatShortName(context.session);
  const greetingLead = firstName ? `Oi, ${firstName}!` : "Oi!";

  if (context.itemsCount > 0) {
    return `${greetingLead} Já vi que você está com ${context.itemsCount} item(ns) no carrinho. Posso te ajudar a completar o pedido, conferir frete para ${context.shippingCity ?? "sua região"} ou dizer se o mínimo já foi atingido.`;
  }

  if (context.shippingCity) {
    return `${greetingLead} Posso te ajudar com catálogo, preço, preparo, frete para ${context.shippingCity} e sugestões para montar o pedido.`;
  }

  return `${greetingLead} Posso te ajudar com dúvidas do catálogo, preço de produtos, sugestões para festa, preparo, frete, pedido mínimo e cidades atendidas.`;
}

function buildWelcomeMessage(session: CustomerSession | null) {
  const firstName = formatShortName(session);
  const lead = firstName ? `Oi, ${firstName}!` : "Oi!";
  return `${lead} Eu consigo responder dúvidas do catálogo, indicar produtos, sugerir itens para festa e também analisar seu carrinho, frete e pedido mínimo.`;
}

function buildHoursAnswer() {
  return "Os horários de atendimento e entrega podem variar. O melhor caminho é seguir para o pedido ou confirmar diretamente pelo canal de atendimento da loja.";
}

function buildPaymentAnswer(context: AssistantContext) {
  if (context.itemsCount > 0) {
    return "As formas de pagamento aparecem na finalização do pedido. Como seu carrinho já está montado, o próximo passo é abrir o carrinho e seguir para o checkout para escolher a forma de pagamento.";
  }

  return "As formas de pagamento aparecem na finalização do pedido. Se quiser, monte o carrinho que eu te oriento no restante do fluxo.";
}

function personalizeAnswer(answer: string, context: AssistantContext) {
  const firstName = formatShortName(context.session);
  if (!firstName) return answer;

  const normalizedAnswer = normalizeQuestion(answer);
  const normalizedName = normalizeQuestion(firstName);

  if (normalizedAnswer.startsWith(`oi ${normalizedName}`) || normalizedAnswer.startsWith(normalizedName)) {
    return answer;
  }

  return `${firstName}, ${answer.charAt(0).toLowerCase()}${answer.slice(1)}`;
}

function buildFallbackAnswer(question: string, context: AssistantContext) {
  const category = inferCategory(question);
  const matches = findProductMatches(question, 3);

  if (matches.length > 0) {
    return `Não achei uma resposta pronta para isso, mas encontrei itens relacionados: ${matches
      .map((product) => product.name)
      .join(", ")}. Você pode me perguntar preço, preparo ou qual deles combina melhor com sua ocasião.`;
  }

  if (category) {
    return `Posso te ajudar melhor dentro da categoria ${category}. Por exemplo: "qual o preço desse item?", "quais vocês indicam?" ou "tem entrega para minha região?".`;
  }

  if (context.itemsCount > 0) {
    return "Eu consigo te ajudar com o seu carrinho atual, preço, sugestão de produtos, quantidade para festa, preparo, frete, pedido mínimo e frete grátis. Tente algo como: 'meu carrinho já bate o mínimo?', 'quanto falta para o frete grátis?' ou 'o que combina com meu carrinho?'.";
  }

  return "Eu consigo ajudar com catálogo, preço, sugestão de produtos, quantidade para festa, preparo, frete, cidades atendidas, pedido mínimo e frete grátis. Tente algo como: 'quais pães de queijo vocês têm?', 'qual o preço do pão de queijo GG?' ou 'quantos salgados para 80 pessoas?'.";
}

function buildDeliveryAnswer(question: string, context: AssistantContext) {
  const explicitCity = findShippingCity(question);
  const cityName =
    explicitCity?.city ??
    (questionHasAny(question, ["minha regiao", "minha cidade", "meu frete", "minha entrega"])
      ? context.shippingCity
      : null);

  if (cityName) {
    const cost =
      explicitCity?.cost ?? (context.shippingCity === cityName ? context.shippingCost : getShippingCostForCity(cityName, context.cartTotal));

    if (cost === null) {
      return `Eu vi a cidade ${cityName}, mas não encontrei uma tarifa configurada para ela no frete atual.`;
    }

    if (cost === 0) {
      return `Sim, atendemos ${cityName}. Com o valor atual do seu pedido, o frete para essa região já está grátis.`;
    }

    const freeShippingHint =
      context.freeShippingRemaining > 0
        ? `Se quiser liberar frete grátis, faltam ${formatCurrency(context.freeShippingRemaining)} em itens.`
        : "";

    return `Sim, atendemos ${cityName}. No cenário atual, o frete dessa região fica em ${formatCurrency(cost)}. ${freeShippingHint}`.trim();
  }

  return `Você pode montar o pedido e seguir para o carrinho para consultar entrega e frete. O frete grátis é liberado a partir de ${formatCurrency(FREE_SHIPPING_THRESHOLD)}.`;
}

function buildCartAwareAnswer(question: string, context: AssistantContext) {
  if (
    questionHasAny(question, [
      "meu carrinho",
      "como esta meu carrinho",
      "resumo do carrinho",
      "pedido atual",
    ])
  ) {
    return buildCartSnapshotAnswer(context);
  }

  if (
    questionHasAny(question, [
      "quanto falta para o frete gratis",
      "falta pro frete gratis",
      "frete gratis",
      "meu frete",
    ])
  ) {
    return buildDeliveryAnswer(question, context);
  }

  if (
    questionHasAny(question, [
      "bate o minimo",
      "pedido minimo",
      "minimo do pedido",
      "quanto falta",
      "o que falta",
    ])
  ) {
    return buildMinimumOrderAnswer(context);
  }

  if (
    questionHasAny(question, [
      "o que combina com meu carrinho",
      "mais um item",
      "completar pedido",
      "fechar pedido",
    ])
  ) {
    return buildRecommendationAnswer(question, context);
  }

  return "";
}

function buildFaqAnswer(question: string, context: AssistantContext) {
  if (questionHasAny(question, ["oi", "ola", "bom dia", "boa tarde", "boa noite"])) {
    return buildGreetingAnswer(context);
  }

  const mathAnswer = buildMathAnswer(question);
  if (mathAnswer) {
    return mathAnswer;
  }

  const tutorialAnswer = buildPreparationVideoAnswer(question);
  if (tutorialAnswer) {
    return tutorialAnswer;
  }

  const cartAwareAnswer = buildCartAwareAnswer(question, context);
  if (cartAwareAnswer) {
    return cartAwareAnswer;
  }

  if (
    questionHasAny(question, [
      "quais salgados",
      "sugere",
      "sugestao",
      "indique",
      "indica",
      "indicar",
      "me indique produtos",
      "indique produtos",
      "produto para",
      "recomenda",
      "recomendacao",
      "melhor para festa",
      "melhor para cafe",
      "o que comprar",
      "o que levar",
    ])
  ) {
    return buildRecommendationAnswer(question, context);
  }

  if (
    questionHasAny(question, [
      "quantos salgados",
      "quantidade de salgado",
      "salgados para festa",
      "pao de queijo para",
      "festa",
      "evento",
      "aniversario",
    ])
  ) {
    return buildPartyAnswer(question);
  }

  if (
    questionHasAny(question, [
      "forno",
      "assar",
      "tempo do pao",
      "quanto tempo",
      "air fryer",
      "airfryer",
      "fritar",
    ])
  ) {
    return buildOvenAnswer(question);
  }

  if (
    questionHasAny(question, [
      "entrega",
      "entregam",
      "frete",
      "cidade",
      "regiao",
    ])
  ) {
    return buildDeliveryAnswer(question, context);
  }

  if (questionHasAny(question, ["pedido minimo", "minimo", "quantidade minima"])) {
    return buildMinimumOrderAnswer(context);
  }

  if (
    questionHasAny(question, [
      "conservar",
      "congelado",
      "freezer",
      "armazenar",
      "descongelado",
    ])
  ) {
    return buildStorageAnswer(question);
  }

  if (
    questionHasAny(question, [
      "preco",
      "valor",
      "custa quanto",
      "quanto custa",
    ])
  ) {
    return buildPriceAnswer(question);
  }

  if (questionHasAny(question, ["mais vendido", "campeao de vendas", "mais sai"])) {
    return buildBestSellerAnswer(question);
  }

  if (questionHasAny(question, ["combo", "kit", "pedido misto"])) {
    const categoryAnswer = buildCatalogAnswer(question);
    return (
      categoryAnswer ||
      "O catálogo mostra combos prontos quando eles estiverem disponíveis, e você também pode montar um pedido misto com pão de queijo, assados e fritos."
    );
  }

  if (questionHasAny(question, ["horario", "funciona", "atendimento"])) {
    return buildHoursAnswer();
  }

  if (questionHasAny(question, ["pagamento", "pix", "cartao"])) {
    return buildPaymentAnswer(context);
  }

  if (questionHasAny(question, ["frete gratis", "gratis"])) {
    return `O frete grátis é liberado a partir de ${formatCurrency(FREE_SHIPPING_THRESHOLD)}. Abaixo disso, o valor varia conforme a região de entrega.`;
  }

  const catalogAnswer = buildCatalogAnswer(question);
  if (catalogAnswer) return catalogAnswer;

  return buildFallbackAnswer(question, context);
}

const HelperChat: React.FC = () => {
  const {
    cartItems,
    itemsCount,
    cartTotal,
    packageCount,
    totalWeight,
    meetsMinimumOrder,
    freeShippingRemaining,
    openCart,
  } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [session, setSession] = useState<CustomerSession | null>(() => getCustomerSession());
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      content: buildWelcomeMessage(session),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const replyTimeoutRef = useRef<number | null>(null);

  const canSend = draft.trim().length > 0;
  const shippingCity = getSessionCity(session);
  const shippingCost = shippingCity ? getShippingCostForCity(shippingCity, cartTotal) : null;

  const assistantContext = useMemo<AssistantContext>(
    () => ({
      session,
      cartItems,
      itemsCount,
      cartTotal,
      packageCount,
      totalWeight,
      meetsMinimumOrder,
      freeShippingRemaining,
      shippingCost,
      shippingCity,
    }),
    [
      session,
      cartItems,
      itemsCount,
      cartTotal,
      packageCount,
      totalWeight,
      meetsMinimumOrder,
      freeShippingRemaining,
      shippingCost,
      shippingCity,
    ]
  );

  const quickQuestions = useMemo(() => {
    const baseQuestions = [...QUICK_QUESTIONS];

    if (assistantContext.shippingCity) {
      baseQuestions[3] = `Qual é o frete para ${assistantContext.shippingCity}?`;
    }

    if (assistantContext.itemsCount > 0) {
      return [
        "Meu carrinho já bate o mínimo?",
        "Quanto falta para o frete grátis?",
        "O que combina com meu carrinho?",
        "Qual é o frete para minha região?",
        "Me indique itens para completar o pedido",
        "Qual é o pedido mínimo?",
      ];
    }

    return baseQuestions;
  }, [assistantContext.itemsCount, assistantContext.shippingCity]);

  const helperSubtitle = useMemo(() => {
    if (assistantContext.itemsCount > 0) {
      return "Respostas com base no seu carrinho, frete e catálogo.";
    }

    if (assistantContext.shippingCity) {
      return `Catálogo, frete e dúvidas para ${assistantContext.shippingCity}.`;
    }

    return "Respostas com base no catálogo, frete e dúvidas frequentes.";
  }, [assistantContext.itemsCount, assistantContext.shippingCity]);

  const statusChips = useMemo(() => {
    const chips: string[] = [];
    const firstName = formatShortName(assistantContext.session);

    if (firstName) chips.push(firstName);
    if (assistantContext.shippingCity) chips.push(assistantContext.shippingCity);
    if (assistantContext.itemsCount > 0) chips.push(`${assistantContext.itemsCount} itens`);

    if (assistantContext.itemsCount > 0) {
      if (assistantContext.shippingCost === 0) {
        chips.push("Frete grátis");
      } else if (assistantContext.freeShippingRemaining > 0) {
        chips.push(`Faltam ${formatCurrency(assistantContext.freeShippingRemaining)}`);
      }
    }

    return chips.slice(0, 4);
  }, [assistantContext]);

  useEffect(() => {
    const syncSession = () => {
      const nextSession = getCustomerSession();
      setSession(nextSession);
      setMessages((current) => {
        if (current.length !== 1 || current[0]?.id !== "welcome") return current;
        return [{ ...current[0], content: buildWelcomeMessage(nextSession) }];
      });
    };
    window.addEventListener(CUSTOMER_SESSION_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener(CUSTOMER_SESSION_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    if (!mediaQuery.matches) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    };

    scrollToBottom();
    const frameId = window.requestAnimationFrame(scrollToBottom);

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen, messages]);

  useEffect(() => {
    return () => {
      if (replyTimeoutRef.current !== null) {
        window.clearTimeout(replyTimeoutRef.current);
      }
    };
  }, []);

  const pushQuestion = (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;

    const answer = personalizeAnswer(buildFaqAnswer(cleanQuestion, assistantContext), assistantContext);
    const timestamp = Date.now();

    if (replyTimeoutRef.current !== null) {
      window.clearTimeout(replyTimeoutRef.current);
    }

    setMessages((current) => [
      ...current,
      {
        id: `${timestamp}-user`,
        role: "user",
        content: cleanQuestion,
      },
    ]);

    setIsTyping(true);

    replyTimeoutRef.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: `${timestamp}-bot`,
          role: "bot",
          content: answer,
        },
      ]);
      setIsTyping(false);
      replyTimeoutRef.current = null;
    }, 450);

    setDraft("");
    setIsOpen(true);
  };

  return (
    <div className={`pointer-events-none fixed inset-x-0 bottom-0 md:left-6 md:right-auto md:bottom-6 md:w-[390px] ${isOpen ? "z-[70]" : "z-40"}`}>
      <AnimatePresence initial={false}>
        {isOpen && (
          <>
            <motion.button
              type="button"
              className="pointer-events-auto fixed inset-0 z-0 bg-slate-950/35 backdrop-blur-[2px] md:hidden"
              aria-label="Fechar assistente"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="Assistente inteligente"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="helper-chat-panel pointer-events-auto fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/20 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.24)] backdrop-blur-xl md:static md:mb-3 md:h-auto md:max-h-[min(720px,calc(100vh-7rem))] md:w-full md:rounded-[28px]"
            >
            <div className="helper-chat-header shrink-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-white">
                  <Bot className="h-5 w-5 text-white" />
                  <p className="font-black">Assistente inteligente</p>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {helperSubtitle}
                </p>
                {statusChips.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {statusChips.map((chip) => (
                      <span
                        key={chip}
                        className="helper-chat-status-chip rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="helper-chat-close flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm md:h-9 md:w-9"
                aria-label="Fechar assistente"
              >
                <X className="h-5 w-5 md:h-4 md:w-4" />
              </button>
            </div>

            <div className="helper-chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-100 px-4 py-4 [-webkit-overflow-scrolling:touch] md:h-[340px] md:flex-none">
              <div className="space-y-3">
                {messages.map((message) => {
                  const isBot = message.role === "bot";

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isBot ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          isBot
                            ? "helper-chat-bubble helper-chat-bubble-bot border border-slate-200 bg-white text-slate-700"
                            : "helper-chat-bubble helper-chat-bubble-user bg-slate-900 text-white"
                        }`}
                      >
                        {renderMessageContent(message.content)}
                      </div>
                    </div>
                  );
                })}
                {isTyping ? (
                  <div className="flex justify-start">
                    <div className="helper-chat-bubble helper-chat-bubble-bot max-w-[88%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-500 shadow-sm">
                      <span className="flex items-center gap-1.5" aria-label="Assistente digitando">
                        <span className="helper-chat-typing-dot h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                        <span className="helper-chat-typing-dot h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                        <span className="helper-chat-typing-dot h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                      </span>
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>
            </div>

            <div className="helper-chat-footer shrink-0 border-t border-slate-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 md:bg-white/90 md:pb-3">
              {assistantContext.itemsCount > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      openCart();
                    }}
                    className="helper-chat-action-btn inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Ver carrinho
                  </button>

                  <button
                    type="button"
                    onClick={() => pushQuestion("Meu carrinho já bate o mínimo?")}
                    className="helper-chat-action-btn inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <Package2 className="h-3.5 w-3.5" />
                    Analisar pedido
                  </button>

                  <button
                    type="button"
                    onClick={() => pushQuestion("Qual é o frete para minha região?")}
                    className="helper-chat-action-btn inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Ver frete
                  </button>
                </div>
              ) : null}

              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {quickQuestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => pushQuestion(item)}
                    className="helper-chat-quick-btn shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    {item}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  pushQuestion(draft);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Pergunte sobre produtos, preço, preparo ou frete..."
                  className="helper-chat-input h-11 flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-500"
                />

                <button
                  type="submit"
                  disabled={!canSend}
                  className="helper-chat-send flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.28)] disabled:opacity-50"
                  aria-label="Enviar pergunta"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>

      <div className="pointer-events-none flex justify-start px-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:px-0 md:pb-0">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="helper-chat-trigger pointer-events-auto group inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/80 bg-white/88 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.14)] backdrop-blur transition-[width,box-shadow,background-color] duration-500 ease-out md:h-16 md:w-16 md:justify-start md:overflow-hidden md:hover:w-[280px] md:hover:bg-white md:hover:shadow-[0_22px_42px_rgba(15,23,42,0.20)]"
          aria-expanded={isOpen}
          aria-label="Abrir assistente inteligente"
        >
          <span className="helper-chat-trigger-icon flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 md:ml-2 md:h-12 md:w-12 md:shrink-0 md:bg-slate-100 md:text-slate-700">
            <MessageCircle className="h-4.5 w-4.5 md:h-6 md:w-6" />
          </span>

          <span className="helper-chat-trigger-copy hidden min-w-0 pointer-events-none text-left md:ml-3 md:block">
            <span className="block max-w-0 -translate-x-3 whitespace-nowrap opacity-0 transition-[max-width,opacity,transform] duration-500 ease-out md:group-hover:max-w-[190px] md:group-hover:translate-x-0 md:group-hover:opacity-100">
              <span className="helper-chat-trigger-kicker flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                <Sparkles className="h-3.5 w-3.5" />
                IA do catálogo
              </span>
              <span className="block text-base font-semibold leading-tight">
                Tire dúvidas com contexto
              </span>
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default HelperChat;
