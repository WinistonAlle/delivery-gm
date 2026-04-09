import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

type Position = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";

const GRID_SIZE = 12;
const INITIAL_SNAKE: Position[] = [
  { x: 5, y: 6 },
  { x: 4, y: 6 },
  { x: 3, y: 6 },
];
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

function randomFood(snake: Position[]): Position {
  const occupied = new Set(snake.map((segment) => `${segment.x}:${segment.y}`));
  const freeCells: Position[] = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x}:${y}`)) freeCells.push({ x, y });
    }
  }

  return freeCells[Math.floor(Math.random() * freeCells.length)] ?? { x: 8, y: 6 };
}

const SnakeGame: React.FC = () => {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [direction, setDirection] = useState<Direction>("right");
  const [queuedDirection, setQueuedDirection] = useState<Direction>("right");
  const [food, setFood] = useState<Position>({ x: 8, y: 6 });
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [gameOver, setGameOver] = useState(false);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection("right");
    setQueuedDirection("right");
    setFood(randomFood(INITIAL_SNAKE));
    setScore(0);
    setGameOver(false);
    setIsRunning(true);
  };

  const changeDirection = (nextDirection: Direction) => {
    if (OPPOSITE_DIRECTION[direction] === nextDirection) return;
    setQueuedDirection(nextDirection);
  };

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
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          changeDirection("up");
          break;
        case "ArrowDown":
          event.preventDefault();
          changeDirection("down");
          break;
        case "ArrowLeft":
          event.preventDefault();
          changeDirection("left");
          break;
        case "ArrowRight":
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
  }, [direction, gameOver]);

  useEffect(() => {
    if (!isRunning || gameOver) return;

    const speed = Math.max(90, 180 - score * 5);
    const interval = window.setInterval(() => {
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

        const hitSelf = currentSnake.some(
          (segment) => segment.x === nextHead.x && segment.y === nextHead.y
        );

        if (hitSelf) {
          setGameOver(true);
          setIsRunning(false);
          return currentSnake;
        }

        const willEat = nextHead.x === food.x && nextHead.y === food.y;
        const nextSnake = willEat
          ? [nextHead, ...currentSnake]
          : [nextHead, ...currentSnake.slice(0, -1)];

        if (willEat) {
          setScore((current) => {
            const nextScore = current + 1;
            setBestScore((best) => Math.max(best, nextScore));
            return nextScore;
          });
          setFood(randomFood(nextSnake));
        }

        return nextSnake;
      });
    }, speed);

    return () => window.clearInterval(interval);
  }, [direction, food, gameOver, isRunning, queuedDirection, score]);

  const board = useMemo(() => {
    const snakeCells = new Set(snake.map((segment) => `${segment.x}:${segment.y}`));
    const head = snake[0];

    return Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
      const x = index % GRID_SIZE;
      const y = Math.floor(index / GRID_SIZE);
      const key = `${x}:${y}`;
      const isHead = head?.x === x && head?.y === y;
      const isSnake = snakeCells.has(key);
      const isFood = food.x === x && food.y === y;

      return { key, isHead, isSnake, isFood };
    });
  }, [food, snake]);

  const controls: Array<{ label: string; icon: typeof ArrowUp; direction: Direction }> = [
    { label: "Cima", icon: ArrowUp, direction: "up" },
    { label: "Esquerda", icon: ArrowLeft, direction: "left" },
    { label: "Direita", icon: ArrowRight, direction: "right" },
    { label: "Baixo", icon: ArrowDown, direction: "down" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-slate-50">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Snake X7</p>
          <p className="text-sm text-slate-300">Setas do teclado ou botões abaixo.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Pontos</p>
          <p className="text-2xl font-semibold">{score}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div
          className="grid aspect-square w-full overflow-hidden rounded-3xl border border-emerald-200 bg-slate-950 p-2 shadow-[0_18px_60px_rgba(15,23,42,0.35)]"
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
        >
          {board.map((cell) => (
            <div
              key={cell.key}
              className={`m-[2px] rounded-[8px] transition-colors ${
                cell.isFood
                  ? "bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.55)]"
                  : cell.isHead
                    ? "bg-emerald-300"
                    : cell.isSnake
                      ? "bg-emerald-500"
                      : "bg-slate-800/95"
              }`}
            />
          ))}
        </div>

        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Recorde</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{bestScore}</p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                if (gameOver) resetGame();
                else setIsRunning((current) => !current);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {gameOver ? "Jogar de novo" : isRunning ? "Pausar" : "Continuar"}
            </button>

            <button
              type="button"
              onClick={resetGame}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div />
            {controls.slice(0, 1).map(({ label, icon: Icon, direction: nextDirection }) => (
              <button
                key={label}
                type="button"
                onClick={() => changeDirection(nextDirection)}
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
                aria-label={label}
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}
            <div />
            {controls.slice(1).map(({ label, icon: Icon, direction: nextDirection }) => (
              <button
                key={label}
                type="button"
                onClick={() => changeDirection(nextDirection)}
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
                aria-label={label}
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Coma os quadrados dourados, evite bater nas bordas e não cruze o próprio corpo.
          </p>
        </div>
      </div>

      {gameOver && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Fim de jogo. Pressione Enter ou toque em &quot;Jogar de novo&quot;.
        </div>
      )}
    </div>
  );
};

export default SnakeGame;
