import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Gauge,
  Gamepad2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";

type Position = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";
type Food = Position & { kind: "classic" | "bonus"; value: number };

const GRID_SIZE = 15;
const INITIAL_SNAKE: Position[] = [
  { x: 7, y: 8 },
  { x: 6, y: 8 },
  { x: 5, y: 8 },
];
const INITIAL_FOOD: Food = { x: 11, y: 8, kind: "classic", value: 1 };
const STORAGE_KEY = "gm_snake_best_score";

const DIRECTION_VECTORS: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function triggerHaptic(pattern: number | number[] = 12) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate(pattern);
}

function cellKey(position: Position) {
  return `${position.x}:${position.y}`;
}

function randomFood(snake: Position[], nextScore = 0): Food {
  const occupied = new Set(snake.map(cellKey));
  const freeCells: Position[] = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x}:${y}`)) freeCells.push({ x, y });
    }
  }

  const position = freeCells[Math.floor(Math.random() * freeCells.length)] ?? { x: 11, y: 8 };
  const isBonus = nextScore > 0 && nextScore % 5 === 0;
  return {
    ...position,
    kind: isBonus ? "bonus" : "classic",
    value: isBonus ? 3 : 1,
  };
}

const SnakeGame: React.FC = () => {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [direction, setDirection] = useState<Direction>("right");
  const [queuedDirection, setQueuedDirection] = useState<Direction>("right");
  const [food, setFood] = useState<Food>(INITIAL_FOOD);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lastGain, setLastGain] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const pointerStartRef = useRef<Position | null>(null);
  const gainTimeoutRef = useRef<number | null>(null);

  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setDirection("right");
    setQueuedDirection("right");
    setFood(randomFood(INITIAL_SNAKE));
    setScore(0);
    setCombo(0);
    setLastGain(null);
    setGameOver(false);
    setIsRunning(true);
    setTurbo(false);
  }, []);

  const changeDirection = useCallback((nextDirection: Direction) => {
    setQueuedDirection((current) =>
      OPPOSITE_DIRECTION[current] === nextDirection ? current : nextDirection
    );
    triggerHaptic(8);
  }, []);

  const tickGame = useCallback(() => {
    if (!isRunning || gameOver) return;

    setSnake((currentSnake) => {
      const nextDirection =
        OPPOSITE_DIRECTION[direction] === queuedDirection ? direction : queuedDirection;
      const vector = DIRECTION_VECTORS[nextDirection];
      const head = currentSnake[0];
      const nextHead = {
        x: (head.x + vector.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + vector.y + GRID_SIZE) % GRID_SIZE,
      };

      setDirection(nextDirection);

      const willEat = nextHead.x === food.x && nextHead.y === food.y;
      const bodyToCheck = willEat ? currentSnake : currentSnake.slice(0, -1);
      const hitSelf = bodyToCheck.some(
        (segment) => segment.x === nextHead.x && segment.y === nextHead.y
      );

      if (hitSelf) {
        setGameOver(true);
        setIsRunning(false);
        setCombo(0);
        triggerHaptic([30, 40, 30]);
        return currentSnake;
      }

      const nextSnake = willEat
        ? [nextHead, ...currentSnake]
        : [nextHead, ...currentSnake.slice(0, -1)];

      if (willEat) {
        const gain = food.value;
        setLastGain(gain);
        setCombo((current) => current + 1);
        setScore((current) => {
          const nextScore = current + gain;
          setBestScore((best) => Math.max(best, nextScore));
          setFood(randomFood(nextSnake, nextScore));
          return nextScore;
        });
        triggerHaptic(food.kind === "bonus" ? [12, 30, 12] : 14);
      }

      return nextSnake;
    });
  }, [direction, food, gameOver, isRunning, queuedDirection]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
      if (Number.isFinite(stored) && stored > 0) setBestScore(stored);
    } catch {
      // ignore storage issues
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(bestScore));
    } catch {
      // ignore storage issues
    }
  }, [bestScore]);

  useEffect(() => {
    if (lastGain === null) return;
    if (gainTimeoutRef.current !== null) window.clearTimeout(gainTimeoutRef.current);
    gainTimeoutRef.current = window.setTimeout(() => setLastGain(null), 620);
    return () => {
      if (gainTimeoutRef.current !== null) window.clearTimeout(gainTimeoutRef.current);
    };
  }, [lastGain]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowUp":
        case "w":
        case "W":
          event.preventDefault();
          changeDirection("up");
          break;
        case "ArrowDown":
        case "s":
        case "S":
          event.preventDefault();
          changeDirection("down");
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          event.preventDefault();
          changeDirection("left");
          break;
        case "ArrowRight":
        case "d":
        case "D":
          event.preventDefault();
          changeDirection("right");
          break;
        case " ":
          event.preventDefault();
          if (gameOver) resetGame();
          else setIsRunning((current) => !current);
          break;
        case "Enter":
          if (gameOver) {
            event.preventDefault();
            resetGame();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [changeDirection, gameOver, resetGame]);

  useEffect(() => {
    if (!isRunning || gameOver) return;

    const speed = Math.max(64, 190 - score * 4 - Math.min(combo, 8) * 4 - (turbo ? 48 : 0));
    const interval = window.setInterval(tickGame, speed);
    return () => window.clearInterval(interval);
  }, [combo, gameOver, isRunning, score, tickGame, turbo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.render_game_to_text = () =>
      JSON.stringify({
        mode: gameOver ? "game_over" : isRunning ? "playing" : "paused",
        coordinateSystem: "grid origin top-left, x right, y down, wrapping edges enabled",
        snake: snake.map((segment) => ({ x: segment.x, y: segment.y })),
        direction,
        queuedDirection,
        food,
        score,
        bestScore,
        combo,
        turbo,
      });
    window.advanceTime = (ms: number) => {
      const steps = Math.max(1, Math.round(ms / 120));
      for (let index = 0; index < steps; index += 1) tickGame();
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [bestScore, combo, direction, food, gameOver, isRunning, queuedDirection, score, snake, tickGame, turbo]);

  const board = useMemo(() => {
    const head = snake[0];
    const snakeIndexByCell = new Map(snake.map((segment, index) => [cellKey(segment), index]));

    return Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
      const x = index % GRID_SIZE;
      const y = Math.floor(index / GRID_SIZE);
      const key = `${x}:${y}`;
      const snakeIndex = snakeIndexByCell.get(key);
      const isHead = head?.x === x && head?.y === y;
      const isSnake = snakeIndex !== undefined;
      const isFood = food.x === x && food.y === y;

      return { key, x, y, isHead, isSnake, isFood, snakeIndex };
    });
  }, [food, snake]);

  const speedLabel = turbo ? "Turbo" : score >= 18 ? "Insano" : score >= 9 ? "Rapido" : "Leve";
  const progressToBonus = score === 0 ? 5 : 5 - (score % 5 || 5);

  const controls: Array<{ label: string; icon: typeof ArrowUp; direction: Direction }> = [
    { label: "Esquerda", icon: ArrowLeft, direction: "left" },
    { label: "Cima", icon: ArrowUp, direction: "up" },
    { label: "Baixo", icon: ArrowDown, direction: "down" },
    { label: "Direita", icon: ArrowRight, direction: "right" },
  ];

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    if (distance < 22) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      changeDirection(deltaX > 0 ? "right" : "left");
    } else {
      changeDirection(deltaY > 0 ? "down" : "up");
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-4">
      <div className="overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_top_left,#fbbf24_0,#f97316_24%,#166534_70%,#052e16_100%)] p-3 text-white shadow-[0_18px_60px_rgba(21,128,61,0.28)] sm:rounded-[24px] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-amber-100" />
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-100">
                Cobrinha GM
              </p>
            </div>
            <p className="mt-1.5 max-w-[18rem] text-sm leading-5 text-emerald-50">
              Swipe no tabuleiro, segure turbo e busque os bonus a cada 5 pontos.
            </p>
          </div>

          <div className="rounded-2xl bg-white/16 px-3 py-2.5 text-right backdrop-blur sm:px-4 sm:py-3">
            <p className="text-xs text-emerald-50/80">Pontos</p>
            <p className="text-3xl font-black leading-none">{score}</p>
            {lastGain !== null && (
              <p className="mt-1 text-xs font-bold text-amber-100">+{lastGain}</p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:mt-4">
          <div className="rounded-2xl bg-white/14 px-2.5 py-2 backdrop-blur sm:px-3">
            <div className="flex items-center gap-1.5 text-emerald-50/80">
              <Trophy className="h-3.5 w-3.5" />
              Recorde
            </div>
            <p className="mt-1 text-lg font-bold">{bestScore}</p>
          </div>
          <div className="rounded-2xl bg-white/14 px-2.5 py-2 backdrop-blur sm:px-3">
            <div className="flex items-center gap-1.5 text-emerald-50/80">
              <Gauge className="h-3.5 w-3.5" />
              Ritmo
            </div>
            <p className="mt-1 text-lg font-bold">{speedLabel}</p>
          </div>
          <div className="rounded-2xl bg-white/14 px-2.5 py-2 backdrop-blur sm:px-3">
            <div className="flex items-center gap-1.5 text-emerald-50/80">
              <Sparkles className="h-3.5 w-3.5" />
              Combo
            </div>
            <p className="mt-1 text-lg font-bold">x{Math.max(1, combo)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative mx-auto w-full max-w-[310px] sm:max-w-[430px] lg:max-w-none">
          <div
            className="grid aspect-square w-full touch-none select-none overflow-hidden rounded-[28px] border border-emerald-200 bg-[#10251b] p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.28)] sm:p-2"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            data-snake-board="true"
          >
            {board.map((cell) => {
              const shade = (cell.x + cell.y) % 2 === 0 ? "bg-emerald-950/75" : "bg-emerald-900/75";
              const snakeDepth = cell.snakeIndex ?? 0;

              return (
                <div
                  key={cell.key}
                  className={`relative m-[1.5px] rounded-[7px] transition-transform duration-150 ${
                    cell.isFood
                      ? food.kind === "bonus"
                        ? "scale-95 bg-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.78)]"
                        : "scale-95 bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.7)]"
                      : cell.isHead
                        ? "scale-105 bg-lime-300 shadow-[0_0_16px_rgba(190,242,100,0.55)]"
                        : cell.isSnake
                          ? snakeDepth % 2 === 0
                            ? "bg-emerald-400"
                            : "bg-green-500"
                          : shade
                  }`}
                >
                  {cell.isHead && (
                    <span className="absolute inset-[22%] rounded-full bg-white/70 shadow-[8px_0_0_rgba(255,255,255,0.7)]" />
                  )}
                  {cell.isFood && food.kind === "bonus" && (
                    <span className="absolute inset-[28%] rounded-full bg-white/80" />
                  )}
                </div>
              );
            })}
          </div>

          {!isRunning && !gameOver && (
            <div className="absolute inset-0 grid place-items-center rounded-[28px] bg-slate-950/45 text-white backdrop-blur-[2px]">
              <div className="rounded-2xl bg-white/15 px-5 py-3 text-center shadow-lg">
                <p className="text-sm font-bold">Pausado</p>
                <p className="text-xs text-white/75">Toque em continuar</p>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 grid place-items-center rounded-[28px] bg-slate-950/62 text-white backdrop-blur-[2px]">
              <div className="mx-5 rounded-3xl bg-white px-5 py-4 text-center text-slate-900 shadow-xl">
                <p className="text-lg font-black">Fim de jogo</p>
                <p className="mt-1 text-sm text-slate-600">Pontuacao final: {score}</p>
                <button
                  type="button"
                  onClick={resetGame}
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  Jogar de novo
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                if (gameOver) resetGame();
                else setIsRunning((current) => !current);
              }}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition active:scale-[0.98] hover:bg-slate-800"
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {gameOver ? "Novo" : isRunning ? "Pausar" : "Continuar"}
            </button>

            <button
              type="button"
              onClick={resetGame}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition active:scale-[0.98] hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>

          <button
            type="button"
            onPointerDown={() => {
              setTurbo(true);
              triggerHaptic(10);
            }}
            onPointerUp={() => setTurbo(false)}
            onPointerCancel={() => setTurbo(false)}
            onPointerLeave={() => setTurbo(false)}
            className={`flex min-h-12 w-full touch-none items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition active:scale-[0.98] ${
              turbo
                ? "bg-amber-400 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.45)]"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            <Zap className="h-4 w-4" />
            Segurar turbo
          </button>

          <div className="hidden rounded-2xl bg-slate-50 p-3 sm:block">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>Proximo bonus</span>
              <span>{progressToBonus === 5 ? 5 : progressToBonus} pontos</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all"
                style={{ width: `${((score % 5) / 5) * 100 || 8}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1">
            {controls.map(({ label, icon: Icon, direction: nextDirection }) => (
              <button
                key={label}
                type="button"
                onClick={() => changeDirection(nextDirection)}
                className="flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition active:scale-95 hover:bg-slate-100 sm:h-14"
                aria-label={label}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

export default SnakeGame;
