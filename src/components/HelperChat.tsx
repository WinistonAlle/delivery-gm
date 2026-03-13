import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MIN_ORDER_VALUE, MIN_PACKAGES } from "@/data/products";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES } from "@/data/shipping";
import { normalizeText } from "@/utils/stringUtils";

type ChatMessage = {
  id: string;
  role: "bot" | "user";
  content: string;
};

const QUICK_QUESTIONS = [
  "Quantos salgados para 50 pessoas?",
  "Quais salgados vocês sugerem para festa?",
  "Quanto tempo o pão de queijo fica no forno?",
  "Vocês entregam em Taguatinga?",
  "Qual é o pedido mínimo?",
  "Tem frete grátis?",
];

function normalizeQuestion(question: string) {
  return normalizeText(question).replace(/\s+/g, " ").trim();
}

function extractNumber(question: string) {
  const match = question.match(/(\d{1,4})/);
  if (!match) return null;
  return Number(match[1]);
}

function findShippingCity(question: string) {
  const normalized = normalizeQuestion(question);

  return SHIPPING_RATES.find((rate) =>
    normalized.includes(normalizeText(rate.city))
  );
}

function roundUpPackages(quantity: number, packageSize = 50) {
  return Math.ceil(quantity / packageSize);
}

function buildSavorySuggestions(question: string) {
  const normalized = normalizeQuestion(question);

  if (
    normalized.includes("assado") ||
    normalized.includes("forno")
  ) {
    return "Uma boa seleção de assados costuma incluir mini esfirra de carne, enroladinho de salsicha assado e outros salgados assados para variar sabor e textura.";
  }

  if (
    normalized.includes("fritar") ||
    normalized.includes("frito") ||
    normalized.includes("fritura")
  ) {
    return "Para fritura, uma sugestão segura é combinar coxinha, risoles, quibe e bolinha de queijo. Esse mix costuma funcionar bem em festa e dá variedade sem complicar a escolha.";
  }

  return "Para festa, um mix equilibrado costuma funcionar muito bem: coxinha, mini esfirra de carne, enroladinho de salsicha, quibe e bolinha de queijo. Se quiser, eu também posso sugerir uma divisão entre fritos e assados.";
}

function buildPartyAnswer(question: string) {
  const normalized = normalizeQuestion(question);
  const peopleCount = extractNumber(normalized);
  const isCheeseBread =
    normalized.includes("pao de queijo") || normalized.includes("pao queijo");

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

  return `Para ${peopleCount} pessoas, uma boa base é entre ${low} e ${high} salgados, o que dá cerca de ${lowPackages} a ${highPackages} pacotes de 50. Se quiser uma conta equilibrada, use cerca de ${mid} unidades, ou ${midPackages} pacotes. Se a festa tiver outras comidas, fique mais perto de ${lowPackages} pacotes. Se o salgado for a estrela principal, aproxime-se de ${highPackages} pacotes. ${suggestions}`;
}

function buildOvenAnswer(question: string) {
  const normalized = normalizeQuestion(question);
  const isCheeseBread =
    normalized.includes("pao de queijo") || normalized.includes("pao queijo");
  const hasAirFryer =
    normalized.includes("airfryer") || normalized.includes("air fryer");
  const isFrying =
    normalized.includes("fritar") ||
    normalized.includes("fritura") ||
    normalized.includes("oleo");

  if (hasAirFryer && isCheeseBread) {
    return "Para pão de queijo na air fryer, uma boa referência é de 8 a 12 minutos, com o equipamento já aquecido. O ponto ideal é quando ele cresce e fica levemente dourado.";
  }

  if (hasAirFryer) {
    return "Na air fryer, a média costuma ficar entre 8 e 15 minutos, dependendo do tamanho e da potência. O melhor ponto é quando estiver dourado por fora e macio por dentro.";
  }

  if (isFrying) {
    return "Para salgado de fritura, o ideal é óleo quente, em fogo médio, até dourar por fora sem queimar. Em geral, o tempo fica entre 3 e 6 minutos, dependendo do tamanho e do recheio.";
  }

  if (isCheeseBread) {
    return "Para pão de queijo, uma referência prática é entre 25 e 35 minutos em forno preaquecido a 180°C ou 200°C. O ponto ideal é quando crescer e dourar levemente.";
  }

  return "Como média geral, pães e salgados assados costumam ficar entre 20 e 40 minutos em forno preaquecido, variando com tamanho, recheio e temperatura. Se quiser, eu posso responder com uma faixa mais exata para um produto específico.";
}

function buildDeliveryAnswer(question: string) {
  const city = findShippingCity(question);

  if (city) {
    return `Sim, atendemos ${city.city}. No carrinho, o frete dessa região está configurado em R$ ${city.cost.toFixed(2).replace(".", ",")}.`;
  }

  return `Sim, você pode montar o pedido e seguir para o carrinho para consultar entrega e frete. O frete grátis é liberado a partir de R$ ${FREE_SHIPPING_THRESHOLD.toFixed(2).replace(".", ",")}. Se quiser, eu também posso te dizer se atendemos sua região.`;
}

function buildMinimumOrderAnswer() {
  return `Hoje o carrinho trabalha com pedido mínimo de ${MIN_PACKAGES} pacotes ou R$ ${MIN_ORDER_VALUE.toFixed(2).replace(".", ",")}. Conforme você adiciona os itens, o próprio carrinho mostra o que ainda falta para atingir o mínimo.`;
}

function buildStorageAnswer(question: string) {
  const normalized = normalizeQuestion(question);
  const mentionsFreezer =
    normalized.includes("congel") ||
    normalized.includes("freezer") ||
    normalized.includes("armazen");

  if (mentionsFreezer) {
    return "O ideal é manter os produtos congelados até o preparo, preservando a embalagem bem fechada. Depois de descongelar, a recomendação mais segura é preparar sem recongelar.";
  }

  return "Para conservar bem, mantenha o produto congelado até a hora do preparo e evite recongelar depois de descongelado. Se quiser, eu também posso orientar sobre forno, air fryer ou fritura.";
}

function buildPriceAnswer() {
  return "Os preços aparecem diretamente nos cards dos produtos e no carrinho. Se você quiser economizar, eu posso sugerir uma conta base para festa ou para café da tarde.";
}

function buildBestSellerAnswer() {
  return "Entre os itens de maior saída, pão de queijo e salgados de festa costumam ser escolhas fortes para giro rápido. Se você quiser, posso te orientar por ocasião: festa, café da tarde ou revenda.";
}

function buildComboAnswer() {
  return "Sim. O catálogo mostra combos prontos quando eles estiverem disponíveis, e você também pode montar um pedido misto com pão de queijo, assados e fritos para equilibrar variedade e ticket.";
}

function buildGreetingAnswer() {
  return "Oi! Posso ajudar com quantidade para festa, preparo, frete, pedido mínimo, conservação e dúvidas rápidas sobre compra.";
}

function buildHoursAnswer() {
  return "Os horários de atendimento e entrega podem variar. O melhor caminho é seguir para o pedido ou confirmar diretamente pelo canal de atendimento da loja.";
}

function buildPaymentAnswer() {
  return "As formas de pagamento aparecem na finalização do pedido. Se quiser, monte o carrinho que eu te oriento no restante do fluxo.";
}

function buildFallbackAnswer() {
  return "Eu consigo ajudar com perguntas simples sobre quantidade para festa, tempo de preparo, conservação, frete, cidades atendidas, pedido mínimo e frete grátis. Tente algo como: 'vocês entregam em Taguatinga?' ou 'quantos salgados para 80 pessoas?'.";
}

function buildFaqAnswer(question: string) {
  const normalized = normalizeQuestion(question);

  if (
    normalized === "oi" ||
    normalized === "ola" ||
    normalized === "olá" ||
    normalized.includes("bom dia") ||
    normalized.includes("boa tarde") ||
    normalized.includes("boa noite")
  ) {
    return buildGreetingAnswer();
  }

  if (
    normalized.includes("quais salgados") ||
    normalized.includes("sugere salgados") ||
    normalized.includes("sugestao de salgado") ||
    normalized.includes("sugestão de salgado") ||
    normalized.includes("quais voces sugerem") ||
    normalized.includes("quais vocês sugerem")
  ) {
    return buildSavorySuggestions(question);
  }

  if (
    normalized.includes("quantos salgados") ||
    normalized.includes("quantidade de salgado") ||
    normalized.includes("salgados para festa") ||
    normalized.includes("pao de queijo para") ||
    normalized.includes("festa") ||
    normalized.includes("evento") ||
    normalized.includes("aniversario")
  ) {
    return buildPartyAnswer(question);
  }

  if (
    normalized.includes("forno") ||
    normalized.includes("assar") ||
    normalized.includes("tempo do pao") ||
    normalized.includes("quanto tempo") ||
    normalized.includes("air fryer") ||
    normalized.includes("airfryer") ||
    normalized.includes("fritar")
  ) {
    return buildOvenAnswer(question);
  }

  if (
    normalized.includes("entrega") ||
    normalized.includes("entregam") ||
    normalized.includes("frete") ||
    normalized.includes("cidade") ||
    normalized.includes("regiao") ||
    normalized.includes("região")
  ) {
    return buildDeliveryAnswer(question);
  }

  if (
    normalized.includes("pedido minimo") ||
    normalized.includes("pedido mínimo") ||
    normalized.includes("minimo") ||
    normalized.includes("mínimo") ||
    normalized.includes("quantidade minima") ||
    normalized.includes("quantidade mínima")
  ) {
    return buildMinimumOrderAnswer();
  }

  if (
    normalized.includes("conservar") ||
    normalized.includes("congelado") ||
    normalized.includes("freezer") ||
    normalized.includes("armazenar") ||
    normalized.includes("descongel")
  ) {
    return buildStorageAnswer(question);
  }

  if (
    normalized.includes("preco") ||
    normalized.includes("preço") ||
    normalized.includes("valor") ||
    normalized.includes("custa quanto") ||
    normalized.includes("quanto custa")
  ) {
    return buildPriceAnswer();
  }

  if (
    normalized.includes("mais vendido") ||
    normalized.includes("campeao de vendas") ||
    normalized.includes("campeão de vendas") ||
    normalized.includes("mais sai")
  ) {
    return buildBestSellerAnswer();
  }

  if (
    normalized.includes("combo") ||
    normalized.includes("kit") ||
    normalized.includes("pedido misto")
  ) {
    return buildComboAnswer();
  }

  if (
    normalized.includes("horario") ||
    normalized.includes("horário") ||
    normalized.includes("funciona") ||
    normalized.includes("atendimento")
  ) {
    return buildHoursAnswer();
  }

  if (
    normalized.includes("pagamento") ||
    normalized.includes("pix") ||
    normalized.includes("cartao") ||
    normalized.includes("cartão")
  ) {
    return buildPaymentAnswer();
  }

  if (
    normalized.includes("frete gratis") ||
    normalized.includes("frete grátis") ||
    normalized.includes("gratis") ||
    normalized.includes("grátis")
  ) {
    return `O frete grátis é liberado a partir de R$ ${FREE_SHIPPING_THRESHOLD.toFixed(2).replace(".", ",")}. Abaixo disso, o valor varia conforme a região de entrega.`;
  }

  return buildFallbackAnswer();
}

const HelperChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      content:
        "Oi! Eu respondo dúvidas rápidas sobre quantidade para festa, preparo, conservação, frete, cidades atendidas, frete grátis e pedido mínimo.",
    },
  ]);

  const canSend = draft.trim().length > 0;
  const quickQuestions = useMemo(() => QUICK_QUESTIONS, []);

  const pushQuestion = (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;

    const answer = buildFaqAnswer(cleanQuestion);
    const timestamp = Date.now();

    setMessages((current) => [
      ...current,
      {
        id: `${timestamp}-user`,
        role: "user",
        content: cleanQuestion,
      },
      {
        id: `${timestamp}-bot`,
        role: "bot",
        content: answer,
      },
    ]);

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
                  <p className="font-black">Assistente de dúvidas</p>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  Respostas rápidas para dúvidas frequentes do catálogo.
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
                  placeholder="Digite sua pergunta..."
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
          aria-label="Abrir assistente de dúvidas"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 md:ml-2 md:h-12 md:w-12 md:shrink-0 md:bg-slate-100 md:text-slate-700">
            <MessageCircle className="h-4.5 w-4.5 md:h-6 md:w-6" />
          </span>

          <span className="hidden min-w-0 pointer-events-none text-left md:ml-3 md:block">
            <span className="block max-w-0 -translate-x-3 whitespace-nowrap opacity-0 transition-[max-width,opacity,transform] duration-500 ease-out md:group-hover:max-w-[190px] md:group-hover:translate-x-0 md:group-hover:opacity-100">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              <Sparkles className="h-3.5 w-3.5" />
              Assistente
            </span>
            <span className="block text-base font-semibold leading-tight">
              Tire dúvidas rápidas
            </span>
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default HelperChat;
