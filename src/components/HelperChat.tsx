import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MIN_ORDER_VALUE,
  MIN_PACKAGES,
  PRODUCTS,
  TOP_SELLING_PRODUCTS,
} from "@/data/products";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES } from "@/data/shipping";
import { normalizeText } from "@/utils/stringUtils";
import type { Product } from "@/types/products";

type ChatMessage = {
  id: string;
  role: "bot" | "user";
  content: string;
};

const QUICK_QUESTIONS = [
  "Quais pães de queijo vocês têm?",
  "Qual pão de queijo é mais vendido?",
  "Quantos salgados para 50 pessoas?",
  "Vocês entregam em Taguatinga?",
  "Qual é o pedido mínimo?",
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
  const value = Number(product.employee_price ?? product.price ?? 0);
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
        Number(a.employee_price ?? a.price ?? 0) -
          Number(b.employee_price ?? b.price ?? 0)
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

function buildDeliveryAnswer(question: string) {
  const city = findShippingCity(question);

  if (city) {
    return `Sim, atendemos ${city.city}. No carrinho, o frete dessa região está configurado em ${formatCurrency(city.cost)}.`;
  }

  return `Você pode montar o pedido e seguir para o carrinho para consultar entrega e frete. O frete grátis é liberado a partir de ${formatCurrency(FREE_SHIPPING_THRESHOLD)}.`;
}

function buildMinimumOrderAnswer() {
  return `Hoje o carrinho trabalha com pedido mínimo de ${MIN_PACKAGES} pacotes ou ${formatCurrency(MIN_ORDER_VALUE)}. Conforme você adiciona os itens, o próprio carrinho mostra o que ainda falta para atingir o mínimo.`;
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

function buildRecommendationAnswer(question: string) {
  if (questionHasAny(question, ["cafe", "cafe da tarde", "lanche"])) {
    const recommendations = [
      ...getCategoryProducts("Pão de Queijo", 2),
      ...getCategoryProducts("Pães e Massas Doces", 2),
    ].slice(0, 4);

    if (recommendations.length) {
      return `Para café da tarde, eu sugiro ${recommendations
        .map((product) => `${product.name} (${getProductPrice(product)})`)
        .join("; ")}.`;
    }
  }

  if (questionHasAny(question, ["festa", "evento", "aniversario"])) {
    return buildSavorySuggestions(question);
  }

  const general = [
    ...getCategoryProducts("Pão de Queijo", 2),
    ...getCategoryProducts("Salgados Assados", 1),
    ...getCategoryProducts("Salgados P/ Fritar", 1),
  ].slice(0, 4);

  if (general.length) {
    return `Se você quer começar pelos itens mais fáceis de vender ou servir, eu olharia estes: ${general
      .map((product) => `${product.name} (${getProductPrice(product)})`)
      .join("; ")}.`;
  }

  return "Posso te indicar opções para festa, café da tarde, revenda ou pão de queijo. Se quiser, me diga a ocasião.";
}

function buildGreetingAnswer() {
  return "Oi! Agora eu consigo ajudar com dúvidas do catálogo, preço de produtos, sugestões para festa, preparo, frete, pedido mínimo e cidades atendidas.";
}

function buildHoursAnswer() {
  return "Os horários de atendimento e entrega podem variar. O melhor caminho é seguir para o pedido ou confirmar diretamente pelo canal de atendimento da loja.";
}

function buildPaymentAnswer() {
  return "As formas de pagamento aparecem na finalização do pedido. Se quiser, monte o carrinho que eu te oriento no restante do fluxo.";
}

function buildFallbackAnswer(question: string) {
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

  return "Eu consigo ajudar com catálogo, preço, sugestão de produtos, quantidade para festa, preparo, frete, cidades atendidas, pedido mínimo e frete grátis. Tente algo como: 'quais pães de queijo vocês têm?', 'qual o preço do pão de queijo GG?' ou 'quantos salgados para 80 pessoas?'.";
}

function buildFaqAnswer(question: string) {
  if (questionHasAny(question, ["oi", "ola", "bom dia", "boa tarde", "boa noite"])) {
    return buildGreetingAnswer();
  }

  if (
    questionHasAny(question, [
      "quais salgados",
      "sugere",
      "sugestao",
      "indique",
      "recomenda",
      "melhor para festa",
      "melhor para cafe",
    ])
  ) {
    return buildRecommendationAnswer(question);
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
    return buildDeliveryAnswer(question);
  }

  if (questionHasAny(question, ["pedido minimo", "minimo", "quantidade minima"])) {
    return buildMinimumOrderAnswer();
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
    return buildPaymentAnswer();
  }

  if (questionHasAny(question, ["frete gratis", "gratis"])) {
    return `O frete grátis é liberado a partir de ${formatCurrency(FREE_SHIPPING_THRESHOLD)}. Abaixo disso, o valor varia conforme a região de entrega.`;
  }

  const catalogAnswer = buildCatalogAnswer(question);
  if (catalogAnswer) return catalogAnswer;

  return buildFallbackAnswer(question);
}

const HelperChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      content:
        "Oi! Eu consigo responder dúvidas do catálogo, encontrar produtos, sugerir itens para festa e informar preço, preparo, frete e pedido mínimo.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const replyTimeoutRef = useRef<number | null>(null);

  const canSend = draft.trim().length > 0;
  const quickQuestions = useMemo(() => QUICK_QUESTIONS, []);

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

    const answer = buildFaqAnswer(cleanQuestion);
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
    <div className="fixed left-3 right-3 bottom-[156px] z-40 md:left-6 md:right-auto md:bottom-6">
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="mb-3 w-full max-w-[390px] overflow-hidden rounded-[28px] border border-white/20 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-white">
                  <Bot className="h-5 w-5 text-white" />
                  <p className="font-black">Assistente inteligente</p>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  Respostas com base no catálogo, frete e dúvidas frequentes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
                aria-label="Fechar assistente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ScrollArea className="h-[340px] bg-slate-100 px-4 py-4">
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
                            ? "border border-slate-200 bg-white text-slate-700"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  );
                })}
                {isTyping ? (
                  <div className="flex justify-start">
                    <div className="max-w-[88%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-500 shadow-sm">
                      <span className="flex items-center gap-1.5" aria-label="Assistente digitando">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                      </span>
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>
            </ScrollArea>

            <div className="border-t border-slate-200 bg-white/90 px-4 py-3">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {quickQuestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => pushQuestion(item)}
                    className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
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
                  className="h-11 flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-slate-500"
                />

                <button
                  type="submit"
                  disabled={!canSend}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.28)] disabled:opacity-50"
                  aria-label="Enviar pergunta"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="flex justify-start md:justify-start">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="group inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/80 bg-white/88 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.14)] backdrop-blur transition-[width,box-shadow,background-color] duration-500 ease-out md:h-16 md:w-16 md:justify-start md:overflow-hidden md:hover:w-[280px] md:hover:bg-white md:hover:shadow-[0_22px_42px_rgba(15,23,42,0.20)]"
          aria-expanded={isOpen}
          aria-label="Abrir assistente inteligente"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 md:ml-2 md:h-12 md:w-12 md:shrink-0 md:bg-slate-100 md:text-slate-700">
            <MessageCircle className="h-4.5 w-4.5 md:h-6 md:w-6" />
          </span>

          <span className="hidden min-w-0 pointer-events-none text-left md:ml-3 md:block">
            <span className="block max-w-0 -translate-x-3 whitespace-nowrap opacity-0 transition-[max-width,opacity,transform] duration-500 ease-out md:group-hover:max-w-[190px] md:group-hover:translate-x-0 md:group-hover:opacity-100">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
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
