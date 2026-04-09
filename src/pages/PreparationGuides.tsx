import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChefHat, CirclePlay, Flame, Search, Sparkles, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logoGostinho from "@/images/logoc.png";
import {
  PREPARATION_VIDEOS,
  getPreparationThumbnail,
  type PreparationVideo,
} from "@/data/preparationVideos";
import { normalizeText } from "@/utils/stringUtils";

type FilterKey = "all" | PreparationVideo["category"];

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "Todos",
  fritura: "Fritura",
  forno: "Forno",
  preparo: "Preparo",
};

const FILTER_ICONS: Record<FilterKey, React.ComponentType<{ className?: string }>> = {
  all: Sparkles,
  fritura: Flame,
  forno: ChefHat,
  preparo: UtensilsCrossed,
};

function matchesSearch(video: PreparationVideo, query: string) {
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) return true;

  const haystack = normalizeText(
    [video.title, video.description, video.category, ...video.keywords].join(" ")
  );

  return haystack.includes(normalizedQuery);
}

const PreparationGuides: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const filteredVideos = useMemo(
    () =>
      PREPARATION_VIDEOS.filter((video) => {
        const matchesCategory = filter === "all" || video.category === filter;
        return matchesCategory && matchesSearch(video, query);
      }),
    [filter, query]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(254,226,226,0.9),_rgba(255,255,255,1)_48%)] pb-14">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pt-5 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 mb-6 rounded-[28px] border border-red-100/80 bg-white/88 px-4 py-4 shadow-[0_14px_40px_rgba(127,29,29,0.08)] backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="rounded-full border-red-200 bg-white text-red-700 hover:bg-red-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>

              <img
                src={logoGostinho}
                alt="Gostinho Mineiro"
                className="h-12 w-auto rounded-2xl bg-white p-1.5 shadow-sm"
              />

              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                  Modos de preparo
                </h1>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-[28px] border border-red-100 bg-white/88 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busque por churros, coxinha, pão de queijo, broa..."
                className="h-12 rounded-full border-red-100 bg-white pl-11 text-slate-700"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
                const Icon = FILTER_ICONS[key];
                const active = filter === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-red-600 bg-red-600 text-white shadow-[0_12px_24px_rgba(220,38,38,0.22)]"
                        : "border-red-100 bg-red-50/60 text-red-700 hover:bg-red-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {FILTER_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredVideos.map((video) => (
            <article
              key={video.id}
              className="group overflow-hidden rounded-[28px] border border-red-100 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
            >
              <a
                href={video.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  <img
                    src={getPreparationThumbnail(video)}
                    alt={video.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm">
                    <CirclePlay className="h-4 w-4 text-red-600" />
                    Assistir no YouTube
                  </div>
                </div>
              </a>

              <div className="space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-red-500">
                    {FILTER_LABELS[video.category]}
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-black leading-tight text-slate-900">
                    {video.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {video.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Tutorial curto para apoio no preparo
                  </div>

                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <CirclePlay className="h-4 w-4" />
                    Abrir vídeo
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>

        {filteredVideos.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-dashed border-red-200 bg-white/80 px-6 py-12 text-center shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <p className="text-lg font-semibold text-slate-900">Nenhum vídeo encontrado</p>
            <p className="mt-2 text-sm text-slate-500">
              Tente buscar por outro produto ou trocar o filtro.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PreparationGuides;
