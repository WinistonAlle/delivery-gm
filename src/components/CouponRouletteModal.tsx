import React, { useEffect, useRef, useState } from "react";
import { X, Copy, CheckCircle, Clock } from "lucide-react";
import type { AppliedCoupon } from "@/contexts/cart-store";

// ─── Countdown hook ────────────────────────────────────────────────────────
function useCountdown(expiresAt: number | null) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRemaining(Math.max(0, expiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const s = Math.floor(remaining / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    display: `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`,
    urgent: s < 3600,
    expired: s <= 0,
  };
}

// ─── 6 segmentos visuais fixos (2 de cada prêmio) ─────────────────────────
const SEGMENTS = [
  { prizeKey: "5%",    line1: "5%",    line2: "OFF",    fill: "#dc2626", glow: "#ef4444" },
  { prizeKey: "10%",   line1: "10%",   line2: "OFF",    fill: "#d97706", glow: "#fbbf24" },
  { prizeKey: "frete", line1: "FRETE", line2: "GRÁTIS", fill: "#0f172a", glow: "#475569" },
  { prizeKey: "5%",    line1: "5%",    line2: "OFF",    fill: "#dc2626", glow: "#ef4444" },
  { prizeKey: "10%",   line1: "10%",   line2: "OFF",    fill: "#d97706", glow: "#fbbf24" },
  { prizeKey: "frete", line1: "FRETE", line2: "GRÁTIS", fill: "#0f172a", glow: "#475569" },
];

// slotIndex do servidor (0=5%, 1=10%, 2=frete) → dois segmentos visuais
const SLOT_TO_VISUAL: Record<number, number[]> = { 0: [0, 3], 1: [1, 4], 2: [2, 5] };

// ─── SVG helpers ───────────────────────────────────────────────────────────
const toRad = (d: number) => (d * Math.PI) / 180;

function slicePath(start: number, end: number, r: number, cx: number, cy: number) {
  const x1 = cx + r * Math.sin(toRad(start));
  const y1 = cy - r * Math.cos(toRad(start));
  const x2 = cx + r * Math.sin(toRad(end));
  const y2 = cy - r * Math.cos(toRad(end));
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

// ─── Roda SVG ──────────────────────────────────────────────────────────────
function PrizeWheel({ rotation, spinning }: { rotation: number; spinning: boolean }) {
  const CX = 160, CY = 160, R = 132, RIM = 148, TEXT_R = 84;
  const N = SEGMENTS.length;
  const SEG = 360 / N;

  return (
    <div className="relative mx-auto" style={{ width: 320, height: 320 }}>
      {/* Ponteiro fixo */}
      <div className="absolute left-1/2 z-10 -translate-x-1/2" style={{ top: -2 }}>
        <svg width="32" height="36" viewBox="0 0 32 36">
          <defs>
            <linearGradient id="ptr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <polygon points="16,32 2,4 30,4" fill="url(#ptr)" stroke="#92400e" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="16" cy="34" r="3" fill="#fbbf24" stroke="#92400e" strokeWidth="1" />
        </svg>
      </div>

      {/* Roda giratória */}
      <div
        style={{
          width: 320, height: 320,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "50% 50%",
          transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
          willChange: "transform",
        }}
      >
        <svg viewBox="0 0 320 320" width="320" height="320">
          <defs>
            {/* Sombra na roda */}
            <filter id="wheel-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.35" />
            </filter>
            {/* Brilho do aro dourado */}
            <linearGradient id="rim-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="40%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
            {/* Gradiente do hub central */}
            <radialGradient id="hub-grad" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </radialGradient>
          </defs>

          <g filter="url(#wheel-shadow)">
            {/* Aro exterior dourado */}
            <circle cx={CX} cy={CY} r={RIM} fill="url(#rim-grad)" />

            {/* Segmentos */}
            {SEGMENTS.map((seg, i) => {
              const start = i * SEG;
              const end = (i + 1) * SEG;
              const mid = start + SEG / 2;
              return (
                <g key={i}>
                  <path
                    d={slicePath(start, end, R, CX, CY)}
                    fill={seg.fill}
                    stroke="white"
                    strokeWidth="3"
                  />

                  {/* Reflexo claro na borda externa */}
                  <path
                    d={slicePath(start + 1, end - 1, R, CX, CY)}
                    fill="none"
                    stroke={seg.glow}
                    strokeWidth="6"
                    opacity="0.4"
                  />

                  {/* Texto do segmento — rotacionado para ficar legível no topo */}
                  <g transform={`rotate(${mid}, ${CX}, ${CY})`}>
                    {/* Linha 1 — percentual / FRETE */}
                    <text
                      x={CX}
                      y={CY - TEXT_R}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="18"
                      fontWeight="900"
                      fontFamily="system-ui, sans-serif"
                      letterSpacing="-0.5"
                      style={{ userSelect: "none" }}
                    >
                      {seg.line1}
                    </text>
                    {/* Linha 2 — OFF / GRÁTIS */}
                    <text
                      x={CX}
                      y={CY - TEXT_R + 20}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="rgba(255,255,255,0.80)"
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="system-ui, sans-serif"
                      letterSpacing="1.5"
                      style={{ userSelect: "none" }}
                    >
                      {seg.line2}
                    </text>
                    {/* Ponto decorativo próximo ao aro */}
                    <circle cx={CX} cy={CY - R + 12} r="3.5" fill="white" opacity="0.6" />
                  </g>
                </g>
              );
            })}

            {/* Marcações no aro (tick marks) */}
            {Array.from({ length: 24 }).map((_, i) => {
              const a = (i / 24) * 360;
              const r1 = R + 2, r2 = RIM - 4;
              const x1 = CX + r1 * Math.sin(toRad(a)), y1 = CY - r1 * Math.cos(toRad(a));
              const x2 = CX + r2 * Math.sin(toRad(a)), y2 = CY - r2 * Math.cos(toRad(a));
              return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="rgba(255,255,255,0.55)" strokeWidth={i % 4 === 0 ? "2" : "1"} />;
            })}

            {/* Hub central */}
            <circle cx={CX} cy={CY} r={26} fill="url(#rim-grad)" />
            <circle cx={CX} cy={CY} r={21} fill="url(#hub-grad)" />
            <circle cx={CX} cy={CY} r={8}  fill="#d97706" />
            <circle cx={CX} cy={CY} r={4}  fill="white" />
          </g>
        </svg>
      </div>
    </div>
  );
}

// ─── Confete na tela de resultado ─────────────────────────────────────────
const CONFETTI_DOTS = [
  { x: "10%", y: "15%", c: "#dc2626", s: 8  },
  { x: "85%", y: "12%", c: "#f59e0b", s: 10 },
  { x: "5%",  y: "60%", c: "#fbbf24", s: 6  },
  { x: "92%", y: "55%", c: "#dc2626", s: 8  },
  { x: "20%", y: "88%", c: "#f59e0b", s: 7  },
  { x: "75%", y: "85%", c: "#dc2626", s: 9  },
  { x: "50%", y: "5%",  c: "#fbbf24", s: 6  },
];

// ─── Modal principal ───────────────────────────────────────────────────────
type Props = { onClose: () => void; onCouponApplied: (coupon: AppliedCoupon) => void };

export const CouponRouletteModal: React.FC<Props> = ({ onClose, onCouponApplied }) => {
  const [spinning, setSpinning]       = useState(false);
  const [rotation, setRotation]       = useState(0);
  const [result, setResult]           = useState<AppliedCoupon | null>(null);
  const [expiresAt, setExpiresAt]     = useState<number | null>(null);
  const [copied, setCopied]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const currentRotation               = useRef(0);
  const countdown                     = useCountdown(expiresAt);

  const handleSpin = async () => {
    if (spinning) return;
    setError(null);
    setSpinning(true);

    try {
      const resp = await fetch("/api/spin-roulette", { method: "POST", credentials: "same-origin" });
      const data = await resp.json() as {
        code: string; type: "percent" | "free_shipping"; value: number; label: string;
        slotIndex: number; error?: string;
      };

      if (!resp.ok) throw new Error(data.error ?? "Erro ao sortear.");

      // Escolhe aleatoriamente entre os dois segmentos visuais do prêmio
      const candidates = SLOT_TO_VISUAL[data.slotIndex] ?? [0];
      const visualIdx  = candidates[Math.floor(Math.random() * candidates.length)];
      const segSize    = 360 / SEGMENTS.length;
      const midAngle   = (visualIdx + 0.5) * segSize;

      // Rotação total: traz midAngle para o topo (ponteiro) + 8 voltas
      const extra    = ((360 - midAngle) % 360 + 360) % 360;
      const totalRot = currentRotation.current + extra + 8 * 360;
      currentRotation.current = totalRot % 360;
      setRotation(totalRot);

      setTimeout(() => {
        setResult({ code: data.code, type: data.type, value: data.value, label: data.label });
        setExpiresAt(Date.now() + 24 * 60 * 60 * 1000);
        setSpinning(false);
      }, 4200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sortear.");
      setSpinning(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const prizeColor =
    result?.type === "free_shipping" ? "#0f172a"
    : (result?.value ?? 0) >= 10    ? "#d97706"
    : "#dc2626";

  const prizeLabel =
    result?.type === "free_shipping" ? "Frete Grátis"
    : `${result?.value}% de desconto`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full overflow-hidden rounded-[32px] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
        style={{ maxWidth: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        >
          <X className="h-4 w-4" />
        </button>

        {!result ? (
          <>
            {/* ── Header dark ─────────────────────────────────────── */}
            <div
              className="relative overflow-hidden px-6 pb-5 pt-7 text-center"
              style={{ background: "linear-gradient(160deg, #1a0505 0%, #3b0a0a 50%, #1c0d00 100%)" }}
            >
              {/* Bolas decorativas de fundo */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-6 -top-6 h-28 w-28 rounded-full bg-red-600 opacity-20 blur-2xl" />
                <div className="absolute -right-4 top-2 h-20 w-20 rounded-full bg-amber-500 opacity-25 blur-xl" />
                <div className="absolute bottom-0 left-1/2 h-12 w-40 -translate-x-1/2 rounded-full bg-yellow-400 opacity-10 blur-2xl" />
              </div>

              {/* Estrelinhas decorativas */}
              {[
                { t: "18%", l: "12%", s: "1.1" }, { t: "30%", l: "82%", s: "0.85" },
                { t: "65%", l: "90%", s: "0.7"  }, { t: "70%", l: "6%",  s: "0.9"  },
              ].map((star, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute text-yellow-400 opacity-60"
                  style={{ top: star.t, left: star.l, fontSize: 14, transform: `scale(${star.s})` }}
                >
                  ✦
                </span>
              ))}

              <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
                sorteio exclusivo
              </p>
              <h2 className="relative mt-1 text-2xl font-black text-white">
                🎰 Gire e Ganhe!
              </h2>
              <p className="relative mt-1 text-sm text-white/50">
                Um prêmio especial em cada rodada
              </p>
            </div>

            {/* ── Roda ──────────────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-5 bg-slate-50 px-4 pb-7 pt-6">
              <PrizeWheel rotation={rotation} spinning={spinning} />

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-2 text-center text-sm text-red-600">
                  {error}
                </p>
              )}

              {/* Botão girar */}
              <button
                onClick={handleSpin}
                disabled={spinning}
                className="relative h-14 w-full overflow-hidden rounded-2xl text-base font-black text-white shadow-[0_8px_24px_rgba(220,38,38,0.45)] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #d97706 100%)" }}
              >
                {/* Brilho interno */}
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white opacity-30" />
                {spinning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Girando...
                  </span>
                ) : (
                  "🎰 Girar a roleta!"
                )}
              </button>

              <p className="text-center text-xs text-slate-400">
                Cupom válido por <strong className="text-slate-600">24 horas</strong> após o sorteio
              </p>
            </div>
          </>
        ) : (
          <>
            {/* ── Tela de resultado ─────────────────────────────────── */}
            <div
              className="relative overflow-hidden px-6 pb-6 pt-8 text-center"
              style={{
                background: `linear-gradient(160deg, ${prizeColor}22 0%, ${prizeColor}08 100%)`,
                borderBottom: `3px solid ${prizeColor}33`,
              }}
            >
              {/* Confete */}
              {CONFETTI_DOTS.map((d, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute animate-bounce rounded-full"
                  style={{ left: d.x, top: d.y, width: d.s, height: d.s, background: d.c, animationDelay: `${i * 0.12}s`, animationDuration: "1.4s" }}
                />
              ))}

              <div
                className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[20px]"
                style={{ background: `${prizeColor}18`, border: `2px solid ${prizeColor}33` }}
              >
                <span className="text-3xl">
                  {result.type === "free_shipping" ? "🚚" : result.value >= 10 ? "🔥" : "🏷️"}
                </span>
              </div>

              <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Parabéns! Você ganhou
              </p>
              <h2
                className="relative mt-1 text-[2rem] font-black leading-tight"
                style={{ color: prizeColor }}
              >
                {prizeLabel}
              </h2>
              <p className="relative text-sm text-slate-500">no seu próximo pedido</p>
            </div>

            <div className="space-y-3 px-6 py-5">
              {/* Código do cupom */}
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Código do cupom
                </p>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl font-black tracking-widest text-slate-900">
                    {result.code}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-900"
                  >
                    {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Timer */}
              {expiresAt && (
                <div
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 ${
                    countdown.urgent ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <Clock className={`h-4 w-4 shrink-0 ${countdown.urgent ? "text-red-500" : "text-amber-500"}`} />
                  <div className="text-center">
                    <p className={`text-[11px] font-bold ${countdown.urgent ? "text-red-600" : "text-amber-700"}`}>
                      {countdown.urgent ? "⚡ Expira em breve — use logo!" : "Válido por"}
                    </p>
                    <p className={`font-mono text-xl font-black tabular-nums ${countdown.urgent ? "text-red-700" : "text-amber-800"}`}>
                      {countdown.display}
                    </p>
                  </div>
                </div>
              )}

              {/* Botão usar */}
              <button
                onClick={() => { onCouponApplied(result); onClose(); }}
                className="h-14 w-full rounded-2xl text-base font-black text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${prizeColor}, ${prizeColor}cc)` }}
              >
                Usar agora no carrinho
              </button>

              <button
                onClick={onClose}
                className="w-full text-center text-sm text-slate-400 hover:text-slate-600"
              >
                Usar depois
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CouponRouletteModal;
