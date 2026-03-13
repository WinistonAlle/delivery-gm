import React from "react";
import { Search } from "lucide-react";

type Props = {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedCategory: string | "all";
  setSelectedCategory: (value: string | "all") => void;
  categories: string[];
};

const SearchBar: React.FC<Props> = ({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  categories,
}) => {
  return (
    <div
      className="
        w-full rounded-3xl p-4 shadow-[0_18px_50px_rgba(12,18,38,0.10)]
        bg-white/60 backdrop-blur-2xl
        border border-white/70
        flex flex-col gap-4
      "
    >
      {/* Campo de busca */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="
            w-full pl-12 pr-4 py-3
            rounded-full
            bg-white/85 backdrop-blur-md
            border border-slate-200/80
            shadow-[inset_0_1px_1px_rgba(255,255,255,0.75)]
            text-sm md:text-base
            focus:outline-none focus:ring-2 focus:ring-red-500/40
          "
        />
      </div>

      {/* Categorias */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {/* Todas */}
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`
            px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all duration-200
            ${
              selectedCategory === "all"
                ? "bg-slate-900 text-white shadow-[0_8px_24px_rgba(15,23,42,0.35)]"
                : "bg-white/80 backdrop-blur-md text-slate-700 border border-slate-200 hover:bg-white"
            }
          `}
        >
          Todas
        </button>

        {/* Demais categorias */}
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(isActive ? "all" : cat)}
              className={`
                px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all duration-200
                ${
                  isActive
                    ? "bg-slate-900 text-white shadow-[0_8px_24px_rgba(15,23,42,0.35)]"
                    : "bg-white/80 backdrop-blur-md text-slate-700 border border-slate-200 hover:bg-white"
                }
              `}
            >
              {cat || "Sem categoria"}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SearchBar;
