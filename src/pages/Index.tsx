// src/pages/Index.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Product } from "../types/products";
import SearchBar from "../components/SearchBar";
import { ORDERED_CATEGORIES } from "../data/products";
import ProductCard from "../components/ProductCard";
import CartToggle from "../components/CartToggle";
import Cart from "../components/Cart";
import HelperChat from "../components/HelperChat";
import SnakeGame from "../components/SnakeGame";
import { useCart } from "@/contexts/useCart";
import { normalizeText as normalizeTextUtil } from "@/utils/stringUtils";
import FeaturedProductsCarousel from "@/components/FeaturedProductsCarousel";
import { loadCrossSellMap, loadPublicCombos, type DeliveryComboResolved } from "@/lib/deliveryOffers";

// ✅ LOGO (substitui "GOSTINHO MINEIRO" no header)
import logoGostinho from "@/images/logoc.png";

import {
  Home,
  Bell,
  ClipboardList,
  PenSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  X,
  Heart,
  Facebook,
  Instagram,
  Youtube,
  CirclePlay,
  Star,
  Sparkles,
  Palette,
  BadgeCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getLocalTheme, type AppThemeKey } from "@/lib/appTheme";
import { buildUpsellCombos } from "@/lib/upsell";
import { mapCatalogProductRow, isVisibleCatalogProduct } from "@/lib/catalogProducts";
import {
  getCustomerSession,
  logoutCustomerSession,
  type CustomerSession,
} from "@/lib/customerAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getDisplayProductPrice } from "../../shared/productPricing";
import CouponRouletteModal from "@/components/CouponRouletteModal";
import { COUPONS_ENABLED } from "@/lib/featureFlags";
import { FREE_SHIPPING_THRESHOLD } from "@/data/shipping";

const ITEMS_PER_PAGE = 24;
const PRODUCTS_CACHE_KEY = "gm_catalog_products_v1";
const SEARCH_CACHE_KEY = "gm_catalog_search";
const CATEGORY_CACHE_KEY = "gm_catalog_category";
const JUNINO_FLAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];
const NEW_YEAR_FIREWORKS = [
  { x: "12%", y: "22%", size: "0.92", delay: "0s",    color: "#f59e0b" },
  { x: "28%", y: "12%", size: "1.18", delay: "0.45s", color: "#ec4899" },
  { x: "52%", y: "8%",  size: "0.85", delay: "1.0s",  color: "#a855f7" },
  { x: "74%", y: "18%", size: "1.08", delay: "0.2s",  color: "#f97316" },
  { x: "88%", y: "14%", size: "0.88", delay: "0.72s", color: "#14b8a6" },
];

const FREE_SHIPPING_CONFETTI = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 8) * 0.13}s`,
  duration: `${2.4 + (index % 5) * 0.18}s`,
  color: ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#facc15"][index % 6],
  size: `${7 + (index % 4) * 2}px`,
  rotate: `${(index * 29) % 180}deg`,
  drift: `${index % 2 === 0 ? "" : "-"}${18 + (index % 6) * 6}px`,
}));

const NATAL_SNOWFLAKES = [
  { left: "7%",  size: "6px",  duration: "9s",    delay: "0s",   drift: "20px"  },
  { left: "18%", size: "4px",  duration: "11s",   delay: "1.4s", drift: "-15px" },
  { left: "31%", size: "7px",  duration: "8s",    delay: "2.8s", drift: "18px"  },
  { left: "45%", size: "5px",  duration: "10s",   delay: "0.6s", drift: "-22px" },
  { left: "58%", size: "6px",  duration: "12s",   delay: "3.2s", drift: "16px"  },
  { left: "70%", size: "4px",  duration: "9.5s",  delay: "1.8s", drift: "-12px" },
  { left: "82%", size: "8px",  duration: "10.5s", delay: "4.6s", drift: "24px"  },
  { left: "93%", size: "5px",  duration: "8.5s",  delay: "5.2s", drift: "-18px" },
];

const BF_PROMO_TAGS = [
  { label: "PROMO",        left: "5%",  top: "12%", rot: "-4deg", delay: "0s"    },
  { label: "PROMOÇÃO",     left: "68%", top: "8%",  rot: "3deg",  delay: "0.7s"  },
  { label: "BLACK FRIDAY", left: "72%", top: "52%", rot: "-2deg", delay: "1.3s"  },
];

const BF_BOLTS = [
  { left: "58%", top: "6%",  width: "42px", height: "76px", delay: "0.4s", duration: "2.6s" },
  { left: "6%",  top: "34%", width: "28px", height: "52px", delay: "1.1s", duration: "2.2s" },
];

const BF_TICKER_ITEMS = [
  "Black Friday", "Promo", "Promoções Imperdíveis",
  "Peça Agora", "Ofertas", "Só Hoje",
  "Black Friday", "Promo", "Promoções Imperdíveis",
  "Peça Agora", "Ofertas", "Só Hoje",
];

const COPA_CONFETTI = [
  { left: "4%",  delay: "0s",    duration: "3.0s", color: "#16a34a", drift: "14px",  w: "7px",  h: "13px" },
  { left: "10%", delay: "0.4s",  duration: "2.6s", color: "#facc15", drift: "-12px", w: "10px", h: "16px" },
  { left: "17%", delay: "1.0s",  duration: "3.4s", color: "#2563eb", drift: "20px",  w: "6px",  h: "11px" },
  { left: "24%", delay: "0.2s",  duration: "2.8s", color: "#15803d", drift: "-16px", w: "9px",  h: "15px" },
  { left: "32%", delay: "0.8s",  duration: "3.1s", color: "#fbbf24", drift: "18px",  w: "7px",  h: "13px" },
  { left: "40%", delay: "1.4s",  duration: "2.5s", color: "#1d4ed8", drift: "-14px", w: "8px",  h: "14px" },
  { left: "49%", delay: "0.6s",  duration: "3.3s", color: "#16a34a", drift: "12px",  w: "6px",  h: "12px" },
  { left: "57%", delay: "0.15s", duration: "2.9s", color: "#facc15", drift: "-20px", w: "9px",  h: "15px" },
  { left: "65%", delay: "1.2s",  duration: "3.6s", color: "#2563eb", drift: "16px",  w: "7px",  h: "13px" },
  { left: "73%", delay: "0.5s",  duration: "2.7s", color: "#15803d", drift: "-10px", w: "10px", h: "16px" },
  { left: "81%", delay: "1.0s",  duration: "3.2s", color: "#fbbf24", drift: "22px",  w: "6px",  h: "11px" },
  { left: "88%", delay: "0.35s", duration: "2.4s", color: "#1d4ed8", drift: "-18px", w: "8px",  h: "14px" },
  { left: "94%", delay: "0.9s",  duration: "3.5s", color: "#16a34a", drift: "14px",  w: "7px",  h: "13px" },
];

const COPA_STARS_HERO = [
  { left: "7%",  top: "14%", size: "20px", delay: "0s",    duration: "2.6s" },
  { left: "19%", top: "30%", size: "13px", delay: "0.75s", duration: "1.9s" },
  { left: "46%", top: "7%",  size: "11px", delay: "0.5s",  duration: "1.7s" },
  { left: "74%", top: "10%", size: "22px", delay: "0.3s",  duration: "2.9s" },
  { left: "86%", top: "26%", size: "15px", delay: "1.1s",  duration: "2.2s" },
];

const COPA_SPOTLIGHTS = [
  { left: "16%", rot: "-14deg", delay: "0s",   duration: "3.6s" },
  { left: "84%", rot: "14deg",  delay: "0.9s", duration: "3.2s" },
];

const COPA_FLAGS_HERO = [
  { left: "6%",  top: "38%", delay: "0s",   duration: "2.8s" },
  { left: "88%", top: "32%", delay: "0.6s", duration: "3.1s" },
];

const JUNINO_STARS_HERO = [
  { left: "5%",  top: "26%", size: "20px", duration: "2.4s", delay: "0s"    },
  { left: "13%", top: "10%", size: "12px", duration: "1.8s", delay: "0.7s"  },
  { left: "39%", top: "8%",  size: "14px", duration: "2.8s", delay: "0.35s" },
  { left: "61%", top: "6%",  size: "10px", duration: "2.0s", delay: "1.0s"  },
  { left: "79%", top: "32%", size: "13px", duration: "1.6s", delay: "0.55s" },
];

const PASCOA_PETALS = [
  { left: "4%",  delay: "0s",   duration: "4.2s", color: "#f9a8d4", drift: "22px"  },
  { left: "18%", delay: "0.8s", duration: "3.8s", color: "#c4b5fd", drift: "-16px" },
  { left: "34%", delay: "1.6s", duration: "4.6s", color: "#86efac", drift: "26px"  },
  { left: "53%", delay: "0.4s", duration: "4.0s", color: "#fde68a", drift: "-18px" },
  { left: "69%", delay: "1.2s", duration: "3.6s", color: "#f9a8d4", drift: "20px"  },
  { left: "84%", delay: "2.0s", duration: "4.4s", color: "#c4b5fd", drift: "-24px" },
  { left: "92%", delay: "0.6s", duration: "5.0s", color: "#fdba74", drift: "14px"  },
];

/* --------------------------------------------------------
   HELPERS
-------------------------------------------------------- */
function safeGetEmployee() {
  return getCustomerSession();
}

function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function scrollToCatalogTop(ref: React.RefObject<HTMLElement>) {
  const el = ref.current;
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 8;
  window.scrollTo({ top, behavior: "smooth" });
}

function normalizeForSearch(text: string) {
  const base = normalizeTextUtil(text ?? "");
  return base.replace(/\s+/g, "");
}

/* --------------------------------------------------------
   TYPES
-------------------------------------------------------- */
interface Notice {
  id: string;
  title: string;
  body: string;
  created_at?: string;
  image_url?: string | null;
}

type CarouselMode = "auto" | "manual";

type TopSellingRow = {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_value: number;
  image_path: string | null;
};

type SmartCombo = {
  id: string;
  title: string;
  description: string;
  badge?: string;
  audienceLabel?: string;
  occasionLabel?: string;
  items: { product: Product; quantity: number }[];
  total: number;
};

type ProductRow = Record<string, unknown>;

type FeaturedProductRow = {
  position: number;
  product_id: string;
};

const THEME_HEADER_COLORS: Record<
  AppThemeKey,
  {
    solid: string;
    translucent: string;
    borderSolid: string;
    borderTranslucent: string;
    menuBg: string;
    menuBorder: string;
  }
> = {
  default: {
    solid: "#dc2626",
    translucent: "rgba(220, 38, 38, 0.55)",
    borderSolid: "#dc2626",
    borderTranslucent: "rgba(254, 202, 202, 0.35)",
    menuBg: "rgba(239, 68, 68, 0.8)",
    menuBorder: "rgba(252, 165, 165, 0.5)",
  },
  junino: {
    solid: "#c2410c",
    translucent: "rgba(194, 65, 12, 0.85)",
    borderSolid: "#9a3412",
    borderTranslucent: "rgba(253, 186, 116, 0.38)",
    menuBg: "rgba(194, 65, 12, 0.82)",
    menuBorder: "rgba(253, 186, 116, 0.5)",
  },
  natal: {
    solid: "#1B4D3E",
    translucent: "rgba(27, 77, 62, 0.90)",
    borderSolid: "#163D32",
    borderTranslucent: "rgba(201, 168, 76, 0.42)",
    menuBg: "rgba(27, 77, 62, 0.82)",
    menuBorder: "rgba(201, 168, 76, 0.54)",
  },
  blackfriday: {
    solid: "#1e1e2c",
    translucent: "rgba(28, 28, 44, 0.96)",
    borderSolid: "#ef4444",
    borderTranslucent: "rgba(239, 68, 68, 0.28)",
    menuBg: "rgba(32, 32, 50, 0.97)",
    menuBorder: "rgba(239, 68, 68, 0.35)",
  },
  pascoa: {
    solid: "#7e22ce",
    translucent: "rgba(126, 34, 206, 0.82)",
    borderSolid: "#6b21a8",
    borderTranslucent: "rgba(240, 171, 252, 0.4)",
    menuBg: "rgba(126, 34, 206, 0.78)",
    menuBorder: "rgba(240, 171, 252, 0.45)",
  },
  anonovo: {
    solid: "#fffcf0",
    translucent: "rgba(255, 252, 240, 0.95)",
    borderSolid: "#c9971a",
    borderTranslucent: "rgba(201, 151, 26, 0.30)",
    menuBg: "rgba(146, 96, 12, 0.88)",
    menuBorder: "rgba(201, 151, 26, 0.55)",
  },
  copa: {
    solid: "#166534",
    translucent: "rgba(22, 101, 52, 0.88)",
    borderSolid: "#fbbf24",
    borderTranslucent: "rgba(251, 191, 36, 0.4)",
    menuBg: "rgba(22, 101, 52, 0.82)",
    menuBorder: "rgba(251, 191, 36, 0.5)",
  },
};

const THEME_COMBO_STYLES: Record<
  AppThemeKey,
  {
    cardClass: string;
    glowClass: string;
    mediaClass: string;
    totalClass: string;
    hintClass: string;
    buttonClass: string;
    dialogItemClass: string;
  }
> = {
  default: {
    cardClass:
      "border-orange-100 bg-[linear-gradient(145deg,rgba(255,247,237,0.96),rgba(255,241,242,0.92))]",
    glowClass: "bg-orange-200/40",
    mediaClass: "border-white/80 bg-white/72",
    totalClass: "border-white/80 bg-white/78",
    hintClass: "bg-white/75 text-slate-600",
    buttonClass:
      "bg-red-600 hover:bg-red-700 text-white shadow-[0_10px_24px_rgba(220,38,38,0.35)]",
    dialogItemClass: "border-orange-100/70 bg-white",
  },
  junino: {
    cardClass:
      "border-orange-200 bg-[linear-gradient(145deg,rgba(255,249,240,0.97),rgba(255,237,213,0.95))]",
    glowClass: "bg-orange-300/40",
    mediaClass: "border-orange-100 bg-white/82",
    totalClass: "border-orange-100 bg-white/84",
    hintClass: "bg-orange-50/92 text-orange-900",
    buttonClass:
      "bg-[#c2410c] hover:bg-[#9a3412] text-white shadow-[0_10px_24px_rgba(194,65,12,0.38)]",
    dialogItemClass: "border-orange-100 bg-orange-50/45",
  },
  natal: {
    cardClass:
      "border-[rgba(27,77,62,0.22)] bg-[linear-gradient(145deg,rgba(250,248,243,0.97),rgba(230,244,238,0.95))]",
    glowClass: "bg-[rgba(155,35,53,0.18)]",
    mediaClass: "border-[rgba(27,77,62,0.16)] bg-white/84",
    totalClass: "border-[rgba(27,77,62,0.16)] bg-white/86",
    hintClass: "bg-[rgba(250,248,243,0.92)] text-[#163d32]",
    buttonClass:
      "bg-[#1B4D3E] hover:bg-[#163D32] text-white shadow-[0_10px_24px_rgba(27,77,62,0.40)]",
    dialogItemClass: "border-[rgba(27,77,62,0.14)] bg-white/60",
  },
  blackfriday: {
    cardClass:
      "border-white/[0.12] bg-[linear-gradient(145deg,rgba(92,96,116,0.96),rgba(68,72,90,0.96))] shadow-[0_18px_34px_rgba(15,23,42,0.18)]",
    glowClass: "bg-red-500/12",
    mediaClass: "border-white/[0.12] bg-[rgba(84,88,106,0.92)]",
    totalClass: "border-white/[0.12] bg-[rgba(74,78,96,0.94)]",
    hintClass: "bg-[rgba(255,255,255,0.10)] text-white/82",
    buttonClass:
      "bg-[#ef4444] hover:bg-[#dc2626] text-white font-black shadow-[0_10px_28px_rgba(239,68,68,0.45)]",
    dialogItemClass: "border-white/[0.12] bg-[rgba(84,88,106,0.94)] text-white",
  },
  pascoa: {
    cardClass:
      "border-[rgba(168,85,247,0.2)] bg-[linear-gradient(145deg,rgba(253,248,255,0.97),rgba(243,232,255,0.95))]",
    glowClass: "bg-fuchsia-300/30",
    mediaClass: "border-[rgba(168,85,247,0.15)] bg-white/86",
    totalClass: "border-[rgba(168,85,247,0.15)] bg-white/88",
    hintClass: "bg-[rgba(253,248,255,0.92)] text-[#6b21a8]",
    buttonClass:
      "bg-[#7e22ce] hover:bg-[#6b21a8] text-white shadow-[0_10px_24px_rgba(126,34,206,0.35)]",
    dialogItemClass: "border-[rgba(168,85,247,0.14)] bg-white/60",
  },
  anonovo: {
    cardClass:
      "border-[rgba(201,151,26,0.22)] bg-[linear-gradient(145deg,rgba(255,253,247,0.97),rgba(255,248,220,0.95))]",
    glowClass: "bg-amber-200/40",
    mediaClass: "border-[rgba(201,151,26,0.18)] bg-white/86",
    totalClass: "border-[rgba(201,151,26,0.18)] bg-white/88",
    hintClass: "bg-[rgba(255,253,240,0.92)] text-[#92400e]",
    buttonClass:
      "bg-[#c9971a] hover:bg-[#a37a12] text-white shadow-[0_10px_24px_rgba(201,151,26,0.38)]",
    dialogItemClass: "border-[rgba(201,151,26,0.15)] bg-white/90",
  },
  copa: {
    cardClass:
      "border-[rgba(22,101,52,0.28)] bg-[linear-gradient(145deg,rgba(228,252,238,0.98),rgba(254,252,232,0.95))]",
    glowClass: "bg-green-300/35",
    mediaClass: "border-[rgba(22,163,74,0.18)] bg-[rgba(228,252,238,0.86)]",
    totalClass: "border-[rgba(22,163,74,0.18)] bg-[rgba(228,252,238,0.90)]",
    hintClass: "bg-[rgba(228,252,238,0.94)] text-[#15803d]",
    buttonClass:
      "bg-[#15803d] hover:bg-[#14532d] text-white font-bold shadow-[0_10px_28px_rgba(22,101,52,0.42)]",
    dialogItemClass: "border-[rgba(22,101,52,0.18)] bg-[rgba(240,253,244,0.80)]",
  },
};

/* --------------------------------------------------------
   LOADING (Uiverse - JkHuger)
   - Overlay full screen
   - CSS isolado (prefixo gm-uiverse-)
-------------------------------------------------------- */
const UiverseLoading: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white/65 backdrop-blur-sm">
      <div className="gm-uiverse-frame">
        <div className="gm-uiverse-center">
          <div className="gm-uiverse-dot-1" />
          <div className="gm-uiverse-dot-2" />
          <div className="gm-uiverse-dot-3" />
        </div>
      </div>

      <style>{`
        .gm-uiverse-frame {
          position: relative;
          width: 220px;
          height: 220px;
        }

        .gm-uiverse-center {
          position: absolute;
          width: 220px;
          height: 220px;
          top: 0;
          left: 0;
        }

        .gm-uiverse-dot-1 {
          position: absolute;
          z-index: 3;
          width: 30px;
          height: 30px;
          top: 95px;
          left: 95px;
          background: #fff;
          border-radius: 50%;
          -webkit-animation-fill-mode: both;
          animation-fill-mode: both;
          -webkit-animation: gm-jump-jump-1 2s cubic-bezier(0.21, 0.98, 0.6, 0.99) infinite alternate;
          animation: gm-jump-jump-1 2s cubic-bezier(0.21, 0.98, 0.6, 0.99) infinite alternate;
        }

        .gm-uiverse-dot-2 {
          position: absolute;
          z-index: 2;
          width: 60px;
          height: 60px;
          top: 80px;
          left: 80px;
          background: #fff;
          border-radius: 50%;
          -webkit-animation-fill-mode: both;
          animation-fill-mode: both;
          -webkit-animation: gm-jump-jump-2 2s cubic-bezier(0.21, 0.98, 0.6, 0.99) infinite alternate;
          animation: gm-jump-jump-2 2s cubic-bezier(0.21, 0.98, 0.6, 0.99) infinite alternate;
        }

        .gm-uiverse-dot-3 {
          position: absolute;
          z-index: 1;
          width: 90px;
          height: 90px;
          top: 65px;
          left: 65px;
          background: #fff;
          border-radius: 50%;
          -webkit-animation-fill-mode: both;
          animation-fill-mode: both;
          -webkit-animation: gm-jump-jump-3 2s cubic-bezier(0.21, 0.98, 0.6, 0.99) infinite alternate;
          animation: gm-jump-jump-3 2s cubic-bezier(0.21, 0.98, 0.6, 0.99) infinite alternate;
        }

        @keyframes gm-jump-jump-1 {
          0%, 70% {
            box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.2);
            -webkit-transform: scale(0);
            transform: scale(0);
          }
          100% {
            box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.3);
            -webkit-transform: scale(1);
            transform: scale(1);
          }
        }

        @keyframes gm-jump-jump-2 {
          0%, 40% {
            box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.2);
            -webkit-transform: scale(0);
            transform: scale(0);
          }
          100% {
            box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.3);
            -webkit-transform: scale(1);
            transform: scale(1);
          }
        }

        @keyframes gm-jump-jump-3 {
          0%, 10% {
            box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.2);
            -webkit-transform: scale(0);
            transform: scale(0);
          }
          100% {
            box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.3);
            -webkit-transform: scale(1);
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

/* --------------------------------------------------------
   BOTTOM NAV (MOBILE)
-------------------------------------------------------- */
interface BottomNavProps {
  noticeCount?: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ noticeCount = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const HOME_PATH = "/catalogo";

  const tabs = [
    { label: "Início", path: HOME_PATH, icon: Home },
    { label: "Avisos", path: "/avisos", icon: Bell },
    { label: "Favoritos", path: "/favoritos", icon: Heart },
    { label: "Pedidos", path: "/meus-pedidos", icon: ClipboardList },
  ];

  const isActive = (path: string) => {
    if (path === HOME_PATH) {
      return (
        location.pathname === HOME_PATH ||
        location.pathname === "/" ||
        location.pathname === "/index"
      );
    }
    return location.pathname === path;
  };

  return (
    <nav
      className="
        bottom-nav-bar
        fixed bottom-0 left-0 right-0 z-40 md:hidden
        bg-white/95 backdrop-blur-md
        border-t border-gray-200
        shadow-[0_-4px_12px_rgba(0,0,0,0.06)]
      "
    >
      <div className="flex justify-around py-2">
        {tabs.map(({ label, path, icon: Icon }) => {
          const active = isActive(path);
          const isHome = label === "Início";
          const isAvisos = label === "Avisos";

          return (
            <button
              key={path}
              onClick={() => {
                if (isHome) window.location.href = HOME_PATH;
                else navigate(path);
              }}
              className={`
                relative flex flex-col items-center gap-0.5
                text-[11px] transition-all active:scale-95
                ${active ? "text-red-600 font-semibold" : "text-gray-500"}
              `}
            >
              <div
                className={`
                  relative flex items-center justify-center rounded-full p-2 transition-all
                  ${active ? "bg-red-50 scale-110 shadow-sm" : "bg-transparent"}
                `}
              >
                <Icon className="h-5 w-5" />

                {isAvisos && noticeCount > 0 && (
                  <span
                    className="
                      absolute -top-1.5 -right-1.5
                      min-w-[16px] h-4 px-1
                      rounded-full bg-red-500
                      text-[10px] font-bold text-white
                      flex items-center justify-center
                      border-2 border-white
                    "
                  >
                    {noticeCount > 9 ? "9+" : noticeCount}
                  </span>
                )}
              </div>

              <span>{label}</span>

              {active && (
                <span className="mt-0.5 h-1 w-6 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

/* --------------------------------------------------------
   SKELETON
-------------------------------------------------------- */
const ProductGridSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-white p-3 shadow-sm animate-pulse space-y-3"
        >
          <div className="w-full h-32 rounded-lg bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-3 w-1/2 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-8 w-24 bg-gray-200 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

/* --------------------------------------------------------
   PAGINATION
-------------------------------------------------------- */
type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
};

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  onPrev,
  onNext,
  disabled,
}) => {
  const canPrev = currentPage > 1 && !disabled;
  const canNext = currentPage < totalPages && !disabled;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={onPrev}
          className="
            pagination-btn
            inline-flex items-center gap-2
            rounded-lg border bg-white px-4 py-2 text-sm font-semibold
            hover:bg-gray-50 disabled:opacity-50
          "
        >
          ← Anterior
        </button>

        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          className="
            pagination-btn
            inline-flex items-center gap-2
            rounded-lg border bg-white px-4 py-2 text-sm font-semibold
            hover:bg-gray-50 disabled:opacity-50
          "
        >
          Próximo →
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span className="catalog-count text-gray-500">Página</span>

        <select
          value={currentPage}
          disabled={disabled || totalPages <= 1}
          onChange={(e) => onPageChange(Number(e.target.value))}
          className="
            pagination-select
            h-9 rounded-lg border bg-white px-3 text-sm
            focus:outline-none focus:ring-2 focus:ring-red-200
            disabled:opacity-60
          "
          aria-label="Selecionar página"
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <span className="text-gray-500">de</span>
        <span className="font-semibold">{totalPages}</span>
      </div>
    </div>
  );
};

/* --------------------------------------------------------
   PAGE
-------------------------------------------------------- */
const Index: React.FC = () => {
  const navigate = useNavigate();
  const { addMultipleToCart, applyCoupon, isCartOpen, cartItems, cartTotal, appliedCoupon: cartCoupon } = useCart();
  const catalogRef = useRef<HTMLDivElement | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ✅ Loading overlay (Uiverse)
  // aparece enquanto carrega produtos/avisos/destaques e some quando tudo terminar
  const [overlayLoading, setOverlayLoading] = useState(true);
  const firstPaintDone = useRef(false);

  const [searchTerm, setSearchTerm] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(SEARCH_CACHE_KEY) ?? "";
  });

  const [selectedCategory, setSelectedCategory] = useState<string | "all">(
    () => {
      if (typeof window === "undefined") return "all";
      const cachedCategory = localStorage.getItem(CATEGORY_CACHE_KEY);
      return cachedCategory || "all";
    }
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [snakeDialogOpen, setSnakeDialogOpen] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const logoClickResetRef = useRef<number | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);

  const searchBarContainerRef = useRef<HTMLDivElement | null>(null);
  const searchBarOffsetRef = useRef<number | null>(null);

  const [comboDetailOpen, setComboDetailOpen] = useState(false);
  const [selectedCombo, setSelectedCombo] = useState<SmartCombo | null>(null);
  const [activeTheme, setActiveTheme] = useState<AppThemeKey>(getLocalTheme());
  const headerColors = THEME_HEADER_COLORS[activeTheme] ?? THEME_HEADER_COLORS.default;
  const comboTheme = THEME_COMBO_STYLES[activeTheme] ?? THEME_COMBO_STYLES.default;

  const [notices, setNotices] = useState<Notice[]>([]);
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0);

  // ✅ Destaques
  const [featuredMode, setFeaturedMode] = useState<CarouselMode>("auto");
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [managedCombos, setManagedCombos] = useState<DeliveryComboResolved[]>([]);
  const [crossSellMap, setCrossSellMap] = useState<Record<string, Product[]>>({});

  // ✅ Avisos carregando (pra compor o overlay)
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [showRoulette, setShowRoulette] = useState(false);
  const [showFreeShippingCelebration, setShowFreeShippingCelebration] = useState(false);
  const freeShippingEligibilityReady = useRef(false);
  const wasEligibleForFreeShipping = useRef(false);

  const hasLoadedFromCache = useRef(false);
  const employee: CustomerSession | null = safeGetEmployee();
  const isLoggedIn = !!(employee?.id || employee?.phone || employee?.cpf);
  const displayName = employee?.full_name ?? employee?.name ?? "Cliente";
  const safeCartTotal = Number.isFinite(cartTotal) ? cartTotal : 0;
  const hasFreeShipping = cartItems.length > 0 && safeCartTotal >= FREE_SHIPPING_THRESHOLD;

  const isAdmin =
    employee?.is_admin ||
    employee?.role === "admin" ||
    employee?.tipo === "ADMIN";

  // MODO TESTE: roleta aparece toda vez que entra no site (logado e sem cupom ativo)
  useEffect(() => {
    if (!COUPONS_ENABLED) return;
    if (!isLoggedIn) return;
    if (cartCoupon) return;
    const timer = setTimeout(() => setShowRoulette(true), 1200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    if (!freeShippingEligibilityReady.current) {
      wasEligibleForFreeShipping.current = hasFreeShipping;
      freeShippingEligibilityReady.current = true;
      return;
    }

    if (!hasFreeShipping) {
      wasEligibleForFreeShipping.current = false;
      setShowFreeShippingCelebration(false);
      return;
    }

    if (isCartOpen) {
      wasEligibleForFreeShipping.current = true;
      return;
    }

    if (!wasEligibleForFreeShipping.current) {
      setShowFreeShippingCelebration(true);
      const timeout = window.setTimeout(() => {
        setShowFreeShippingCelebration(false);
      }, 4400);

      wasEligibleForFreeShipping.current = true;
      return () => window.clearTimeout(timeout);
    }

    wasEligibleForFreeShipping.current = true;
  }, [hasFreeShipping, isCartOpen]);

  const persistLocalSetting = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.debug(`Nao foi possivel persistir ${key}:`, error);
    }
  }, []);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const handleSelectCategory = (cat: string | "all") => {
    setSelectedCategory(cat);
    if (searchTerm.trim().length) setSearchTerm("");
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[placeholder*="Buscar"], input[placeholder*="buscar"], input[type="search"]'
      );
      input?.focus();
    });
  };

  const handleLogoSecretClick = () => {
    if (logoClickResetRef.current) {
      window.clearTimeout(logoClickResetRef.current);
    }

    setLogoClickCount((current) => {
      const nextCount = current + 1;
      if (nextCount >= 7) {
        setSnakeDialogOpen(true);
        return 0;
      }
      return nextCount;
    });

    logoClickResetRef.current = window.setTimeout(() => {
      setLogoClickCount(0);
      logoClickResetRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    persistLocalSetting(SEARCH_CACHE_KEY, searchTerm);
  }, [persistLocalSetting, searchTerm]);

  useEffect(() => {
    persistLocalSetting(CATEGORY_CACHE_KEY, selectedCategory);
  }, [persistLocalSetting, selectedCategory]);

  useEffect(() => {
    const syncTheme = () => setActiveTheme(getLocalTheme());
    syncTheme();
    window.addEventListener("storage", syncTheme);
    window.addEventListener("focus", syncTheme);
    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("focus", syncTheme);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (logoClickResetRef.current) {
        window.clearTimeout(logoClickResetRef.current);
      }
    };
  }, []);

  /* ---------------- Produtos ---------------- */
  useEffect(() => {
    let isMounted = true;

    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(PRODUCTS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setProducts(parsed);
            setLoading(false);
            hasLoadedFromCache.current = true;
          }
        }
      } catch (err) {
        console.error("Erro ao ler cache de produtos:", err);
      }
    }

    async function loadProducts() {
      try {
        if (!hasLoadedFromCache.current) setLoading(true);

        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("name", { ascending: true });

        if (error) {
          if (isMounted) setLoadError(error.message);
          return;
        }

        if (isMounted && data) {
          const mapped: Product[] = (data as ProductRow[])
            .map(mapCatalogProductRow)
            .filter(isVisibleCatalogProduct);

          setProducts(mapped);

          try {
            localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(mapped));
          } catch (err) {
            console.error("Erro ao salvar cache de produtos:", err);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  /* ---------------- Destaques: modo (auto/manual) ---------------- */
  useEffect(() => {
    let mounted = true;

    async function loadFeaturedMode() {
      try {
        const { data, error } = await supabase
          .from("carousel_settings")
          .select("mode")
          .eq("id", 1)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          setFeaturedMode("auto");
          return;
        }

        setFeaturedMode(((data?.mode as CarouselMode) || "auto") as CarouselMode);
      } catch {
        if (!mounted) return;
        setFeaturedMode("auto");
      }
    }

    loadFeaturedMode();
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------- Destaques: lista ---------------- */
  useEffect(() => {
    let mounted = true;

    async function loadFeatured() {
      setFeaturedLoading(true);

      try {
        // ✅ MANUAL (CORRIGIDO): sem JOIN, igual à tela de /destaques
        if (featuredMode === "manual") {
          const { data: rows, error: err1 } = await supabase
            .from("featured_products")
            .select("position, product_id, active")
            .eq("active", true)
            .order("position", { ascending: true })
            .limit(5);

          if (!mounted) return;

          if (!err1 && rows && rows.length > 0) {
            const ordered = (rows as FeaturedProductRow[])
              .filter((r) => r?.product_id)
              .map((r) => ({ position: r.position, product_id: r.product_id }));

            const ids = ordered.map((r) => r.product_id);

            const { data: prods, error: err2 } = await supabase
              .from("products")
              .select("*")
              .in("id", ids);

            if (!mounted) return;

            if (!err2 && prods && prods.length > 0) {
              const byId = new Map<string, ProductRow>();
              (prods as ProductRow[]).forEach((p) => byId.set(String(p.id), p));

              const mappedManual = ordered
                .map((r) => byId.get(String(r.product_id)))
                .filter(Boolean)
                .map(mapRowToProduct);

              if (mappedManual.length > 0) {
                setFeaturedProducts(mappedManual);
                setFeaturedLoading(false);
                return; // 🔴 impede cair no AUTO
              }
            }
          }
        }

        // ✅ AUTO: funciona mesmo se "products" ainda não carregou
        const { data: topData } = await supabase.rpc("get_top_selling_products", {
          limit_count: 5,
        });

        if (!mounted) return;

        const rows = (topData as TopSellingRow[]) ?? [];
        const byId = new Map((products ?? []).map((p) => [String(p.id), p]));

        const mappedAuto: Product[] = rows
          .map((r) => {
            const local = byId.get(String(r.product_id));
            if (local) return local;

            return {
              id: r.product_id,
              old_id: null,
              name: r.product_name,
              price: 0,
              employee_price: 0,
              images: [],
              image_path: r.image_path ?? null,
              category: "Outros",
              description: "",
              packageInfo: "",
              saleType: "kg",
              weight: 0,
              isPackage: false,
              featured: false,
              inStock: true,
              isLaunch: false,
              extraInfo: undefined,
            } as Product;
          })
          .slice(0, 5);

        setFeaturedProducts(mappedAuto);
      } catch (e) {
        console.error("Erro ao carregar destaques:", e);
      } finally {
        if (mounted) setFeaturedLoading(false);
      }
    }

    loadFeatured();
    return () => {
      mounted = false;
    };
  }, [featuredMode, products]);

  /* ---------------- Avisos ---------------- */
  useEffect(() => {
    let isMounted = true;

    async function loadNotices() {
      setNoticesLoading(true);
      try {
        const { data, error } = await supabase
          .from("notices")
          .select("id, title, body, created_at, is_published, image_url")
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro carregando avisos:", error);
          return;
        }

        if (isMounted && data) {
          setNotices(
            (data as Notice[]).map((n) => ({
              id: n.id,
              title: n.title,
              body: n.body,
              created_at: n.created_at,
              image_url: n.image_url ?? null,
            }))
          );
        }
      } catch (err) {
        console.error("Erro inesperado ao carregar avisos:", err);
      } finally {
        if (isMounted) setNoticesLoading(false);
      }
    }

    loadNotices();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (notices.length <= 1) {
      setCurrentNoticeIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setCurrentNoticeIndex((prev) => (prev + 1) % notices.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [notices]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));

    const list = Array.from(set);
    if (!list.length) return ORDERED_CATEGORIES;

    list.sort((a, b) => {
      const ia = ORDERED_CATEGORIES.indexOf(a as (typeof ORDERED_CATEGORIES)[number]);
      const ib = ORDERED_CATEGORIES.indexOf(b as (typeof ORDERED_CATEGORIES)[number]);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return list;
  }, [products]);

  const filtered = products.filter((p) => {
    const termNorm = normalizeForSearch(debouncedSearchTerm).trim();
    const globalSearchActive = !!termNorm;

    const nameNorm = normalizeForSearch(p.name);
    const idNorm = normalizeForSearch(String(p.id));
    const oldIdNorm =
      p.old_id !== undefined && p.old_id !== null
        ? normalizeForSearch(String(p.old_id))
        : "";

    const matchesSearch =
      !globalSearchActive ||
      nameNorm.includes(termNorm) ||
      idNorm.includes(termNorm) ||
      (oldIdNorm && oldIdNorm.includes(termNorm));

    const productCategoryName = p.category || "";
    const catNorm = normalizeForSearch(productCategoryName);
    const selectedCatNorm =
      selectedCategory === "all" ? "" : normalizeForSearch(selectedCategory);

    let matchesCategory = true;
    if (!globalSearchActive) {
      matchesCategory =
        selectedCategory === "all" ||
        (selectedCatNorm !== "" && catNorm === selectedCatNorm);
    }

    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = useMemo(
    () =>
      filtered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      ),
    [filtered, currentPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedCategory]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const goTo = (path: string) => {
    if (path === "/catalogo") window.location.href = "/catalogo";
    else navigate(path);
    setMenuOpen(false);
  };

  const handleLogout = () => {
    void logoutCustomerSession();
    setMenuOpen(false);
    navigate("/catalogo", { replace: true });
  };

  /* ---------------- mobile + search (FIX DO "SALTO") ---------------- */
  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 768);

    const updateSearchOffset = () => {
      const el = searchBarContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // top absoluto (document)
      searchBarOffsetRef.current = rect.top + window.scrollY;
    };

    updateIsMobile();

    // ✅ mede várias vezes no início pra pegar carregamentos (hero/destaques/imagens)
    const raf1 = requestAnimationFrame(() => updateSearchOffset());
    const raf2 = requestAnimationFrame(() =>
      requestAnimationFrame(() => updateSearchOffset())
    );
    const t1 = window.setTimeout(() => updateSearchOffset(), 150);
    const t2 = window.setTimeout(() => updateSearchOffset(), 600);

    const handleResize = () => {
      updateIsMobile();
      updateSearchOffset();
    };

    window.addEventListener("resize", handleResize);

    // ✅ Recalcula quando QUALQUER coisa muda a altura da página
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        // evita recalcular no meio do layout thrash
        requestAnimationFrame(() => updateSearchOffset());
      });
      // body pega mudanças do hero/carrossel/imagens acima do catálogo
      ro.observe(document.body);
    }

    // também quando terminar de carregar a página
    window.addEventListener("load", updateSearchOffset);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("load", updateSearchOffset);
      ro?.disconnect();
    };
  }, []);

  // ✅ também recalcula quando avisos/carrossel mudam (garante)
  useEffect(() => {
    const el = searchBarContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      searchBarOffsetRef.current = rect.top + window.scrollY;
    });
  }, [notices.length, currentNoticeIndex, featuredLoading, featuredMode]);

  useEffect(() => {
    const handleScroll = () => {
      setIsAtTop(window.scrollY <= 6);

      if (!isMobile) {
        setHideHeader(false);
        return;
      }
      if (searchBarOffsetRef.current == null) {
        setHideHeader(false);
        return;
      }

      // ✅ use o MESMO "top" que você usa no sticky (top-24)
      const HEADER_HEIGHT = 96; // corresponde ao header fixo
      const threshold = Math.max(0, searchBarOffsetRef.current - HEADER_HEIGHT);

      // 🔥 Agora só some quando REALMENTE encostar
      if (window.scrollY >= threshold) setHideHeader(true);
      else setHideHeader(false);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // roda uma vez pra sincronizar
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  const hasNotices = notices.length > 0;
  const currentNotice = hasNotices ? notices[currentNoticeIndex] : null;
  const showNoticeHero = !!currentNotice;
  const hasNoticeImage = !!currentNotice?.image_url;

  const changePage = (nextPage: number) => {
    const p = Math.max(1, Math.min(totalPages, nextPage));
    setCurrentPage(p);
    requestAnimationFrame(() => scrollToCatalogTop(catalogRef));
  };

  /**
   * ✅ Padroniza SOMENTE a imagem do ProductCard DENTRO DO CARROSSEL
   * - Mobile: mais destaque pra imagem (object-cover + altura maior)
   * - Desktop: mantém o comportamento atual (object-contain)
   */
  const featuredCards = useMemo(() => {
    if (!featuredProducts.length) return [];

    return featuredProducts.map((p) => (
      <div
        key={String(p.id)}
        data-featured-card="true"
        className={`
          w-[300px] md:w-[340px]
          shrink-0

          /* Wrapper do card (mobile) — "não lavado" e mais destaque */
          [&_[data-card]]:bg-white
          [&_[data-card]]:shadow-[0_10px_24px_rgba(0,0,0,0.10)]
          [&_[data-card]]:border-gray-200/80
          md:[&_[data-card]]:shadow-none

          /* Imagem do card */
          [&_button[aria-label^='Imagem do produto']]:w-full
          [&_button[aria-label^='Imagem do produto']]:h-[190px]
          [&_button[aria-label^='Imagem do produto']]:rounded-2xl
          [&_button[aria-label^='Imagem do produto']]:overflow-hidden
          md:[&_button[aria-label^='Imagem do produto']]:h-[190px]

          /* Mobile = cover (mais impacto), Desktop = contain (como era) */
          [&_button[aria-label^='Imagem do produto']_img]:w-full
          [&_button[aria-label^='Imagem do produto']_img]:h-full
          [&_button[aria-label^='Imagem do produto']_img]:object-cover
          md:[&_button[aria-label^='Imagem do produto']_img]:object-contain
        `}
      >
        <ProductCard
          product={p}
          relatedProducts={products}
          crossSellRecommendations={crossSellMap[String(p.id)] ?? []}
        />
      </div>
    ));
  }, [featuredProducts, products, crossSellMap]);

  const smartCombos = useMemo<SmartCombo[]>(() => {
    if (!products.length) return [];
    return buildUpsellCombos(products);
  }, [products]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!products.length) return;
      try {
        const [combos, crossSell] = await Promise.all([
          loadPublicCombos(products),
          loadCrossSellMap(products),
        ]);
        if (!mounted) return;
        setManagedCombos(combos);
        setCrossSellMap(crossSell);
      } catch {
        if (!mounted) return;
        setManagedCombos([]);
        setCrossSellMap({});
      }
    })();
    return () => {
      mounted = false;
    };
  }, [products]);

  const combosToShow: SmartCombo[] = managedCombos.length
    ? managedCombos.map((combo) => ({
        id: combo.id,
        title: combo.title,
        description: combo.description,
        badge: combo.badge,
        items: combo.items,
        total: combo.total,
      }))
    : smartCombos;

  const handleAddCombo = (combo: SmartCombo) => {
    addMultipleToCart(combo.items);
  };

  const handleOpenComboDetail = (combo: SmartCombo) => {
    setSelectedCombo(combo);
    setComboDetailOpen(true);
  };

  /* --------------------------------------------------------
     Overlay loading: aparece no 1º carregamento "de verdade"
     - se veio do cache: mostra rapidinho só pra não piscar feio
  -------------------------------------------------------- */
  useEffect(() => {
    const allDone = !loading && !featuredLoading && !noticesLoading;
    if (!firstPaintDone.current) {
      // segura pelo menos 250ms pra dar "feel" de carregamento
      if (allDone) {
        const t = window.setTimeout(() => {
          setOverlayLoading(false);
          firstPaintDone.current = true;
        }, hasLoadedFromCache.current ? 180 : 320);
        return () => clearTimeout(t);
      } else {
        setOverlayLoading(true);
      }
    } else {
      // depois do primeiro load, não força overlay de novo
      if (allDone) setOverlayLoading(false);
    }
  }, [loading, featuredLoading, noticesLoading]);

  return (
    <div className="min-h-screen flex flex-col relative pb-28 md:pb-0">
      {/* ✅ LOADING OVERLAY */}
      <UiverseLoading show={overlayLoading} />

      {/* Roleta de cupom */}
      {COUPONS_ENABLED && showRoulette && (
        <CouponRouletteModal
          onClose={() => setShowRoulette(false)}
          onCouponApplied={(coupon) => {
            applyCoupon(coupon);
            setShowRoulette(false);
          }}
        />
      )}

      <AnimatePresence>
        {showFreeShippingCelebration && !isCartOpen && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[70] overflow-hidden px-5 pt-[calc(env(safe-area-inset-top)+6rem)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="free-shipping-confetti-layer" aria-hidden="true">
              {FREE_SHIPPING_CONFETTI.map((piece) => (
                <span
                  key={piece.id}
                  className="free-shipping-confetti"
                  style={{
                    left: piece.left,
                    animationDelay: piece.delay,
                    animationDuration: piece.duration,
                    backgroundColor: piece.color,
                    width: piece.size,
                    height: piece.size,
                    transform: `rotate(${piece.rotate})`,
                    "--confetti-drift": piece.drift,
                  } as React.CSSProperties}
                />
              ))}
            </div>

            <motion.div
              className="pointer-events-auto mx-auto max-w-[330px] rounded-2xl border border-green-100 bg-white p-5 text-center shadow-[0_24px_70px_rgba(15,23,42,0.25)]"
              initial={{ y: -18, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: -12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
                <BadgeCheck className="h-6 w-6" />
              </div>
              <p className="text-lg font-bold text-slate-950">Frete grátis liberado</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Seu pedido atingiu o valor mínimo para entrega grátis.
              </p>
              <Button
                type="button"
                className="mt-4 h-10 w-full bg-green-600 text-white hover:bg-green-700"
                onClick={() => setShowFreeShippingCelebration(false)}
              >
                Continuar comprando
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner discreto para quem já tem cupom ativo */}
      {COUPONS_ENABLED && !showRoulette && isLoggedIn && cartCoupon && (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 md:bottom-4">
          <div className="flex items-center gap-2 rounded-full border border-green-200 bg-white px-4 py-2 shadow-lg">
            <span className="text-base">🎟️</span>
            <span className="text-sm font-bold text-green-700">
              {cartCoupon.type === "free_shipping"
                ? "Frete grátis ativo"
                : `${cartCoupon.value}% de desconto ativo`}
            </span>
            <span className="font-mono text-xs text-green-600">{cartCoupon.code}</span>
          </div>
        </div>
      )}

      {/* COPA: Camada decorativa de fundo (troféu, estrelas, gol) */}
      {activeTheme === "copa" && (
        <div className="copa-bg-layer" aria-hidden="true">
          {/* Glows ambientes */}
          <div className="copa-bg-glow-top" />
          <div className="copa-bg-glow-left" />
          <div className="copa-bg-glow-right" />

          {/* 5 Estrelas do Brasil — centralizadas no topo */}
          <div className="copa-bg-stars-row">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`bg-star-${i}`} className="copa-bg-champion-star" />
            ))}
          </div>

        </div>
      )}

      <div
        className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-red-200/40 blur-3xl pointer-events-none"
      />
      <div
        className="absolute top-28 -right-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl pointer-events-none"
      />
      <div
        className="absolute top-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.85), rgba(255,255,255,0))",
        }}
      />

      {/* HEADER */}
      <header
        className={`
          fixed top-0 left-0 right-0 z-40 overflow-hidden
          border-b
          ${isAtTop ? "" : "backdrop-blur-2xl"}
          text-white
          py-5
          transition-all duration-300
          ${
            isMobile && hideHeader
              ? "opacity-0 -translate-y-3 pointer-events-none"
              : "opacity-100 translate-y-0"
          }
        `}
        style={{
          backgroundColor: isAtTop ? headerColors.solid : headerColors.translucent,
          borderBottomColor: isAtTop
            ? headerColors.borderSolid
            : headerColors.borderTranslucent,
        }}
      >
        {activeTheme === "natal" && (
          <div className="xmas-lights xmas-lights-header">
            {Array.from({ length: 26 }).map((_, i) => (
              <span key={`header-bulb-${i}`} className="xmas-bulb" />
            ))}
          </div>
        )}
        {activeTheme === "anonovo" && (
          <div className="newyear-header-glow" aria-hidden="true">
            <div className="newyear-spark-cluster left" />
            <div className="newyear-spark-cluster right" />
          </div>
        )}
        {activeTheme === "pascoa" && (
          <>
            <div className="easter-egg easter-egg-header-accent" aria-hidden="true" />
            <div className="easter-bunny easter-bunny-header" aria-hidden="true" />
          </>
        )}
        {activeTheme === "copa" && (
          <>
            <div className="copa-ribbon copa-ribbon-header" aria-hidden="true" />
          </>
        )}
        {activeTheme === "junino" && (
          <div className="junino-bunting junino-bunting-header" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, index) => (
              <span
                key={`header-flag-${index}`}
                className="junino-flag junino-flag-header"
                style={{
                  backgroundColor: JUNINO_FLAG_COLORS[index % JUNINO_FLAG_COLORS.length],
                  transform: `rotate(${index % 2 === 0 ? -7 : 7}deg)`,
                }}
              />
            ))}
          </div>
        )}

        <div className="container relative z-10 mx-auto px-4 flex items-center justify-between gap-4">
          {activeTheme === "anonovo" && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-center md:flex">
              <span className="newyear-greeting newyear-greeting-header">Feliz Ano Novo!</span>
            </div>
          )}
          {/* ✅ LOGO NO LUGAR DO TEXTO */}
          <button
            onClick={handleLogoSecretClick}
            className="text-left flex items-center"
            aria-label="Logo da Gostinho Mineiro"
            title={logoClickCount > 0 ? `${logoClickCount}/7` : "Logo da Gostinho Mineiro"}
          >
            <img
              src={logoGostinho}
              alt="Gostinho Mineiro"
              className="
                h-8 sm:h-9 md:h-10
                w-auto
                object-contain
                select-none
              "
            />
          </button>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <div className="flex flex-col text-right leading-tight">
                  <span className="text-base font-semibold">
                    {displayName}{" "}
                    {isAdmin && (
                      <span className="text-[11px] opacity-80 ml-1">(Admin)</span>
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border"
                  style={{
                    backgroundColor: headerColors.menuBg,
                    borderColor: headerColors.menuBorder,
                  }}
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-label="Abrir menu"
                >
                  <span className="relative block h-4 w-5">
                    <span
                      className={`absolute left-0 h-0.5 w-full rounded-full bg-white transition-all duration-300 ${
                        menuOpen ? "top-1/2 rotate-45" : "top-0"
                      }`}
                    />
                    <span
                      className={`absolute left-0 h-0.5 w-full rounded-full bg-white transition-all duration-300 ${
                        menuOpen ? "opacity-0" : "top-1/2 -translate-y-1/2"
                      }`}
                    />
                    <span
                      className={`absolute left-0 h-0.5 w-full rounded-full bg-white transition-all duration-300 ${
                        menuOpen ? "bottom-1/2 -rotate-45" : "bottom-0"
                      }`}
                    />
                  </span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="rounded-full bg-white text-red-700 px-4 py-1.5 text-sm font-semibold hover:bg-red-50"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/cadastro")}
                  className="rounded-full border border-white/80 text-white px-4 py-1.5 text-sm font-semibold hover:bg-white/10"
                >
                  Cadastrar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="pt-[88px]" />

      {/* OVERLAY MENU */}
      <div
        className={`
          fixed inset-0 z-50 transition-opacity duration-200
          backdrop-blur-sm
          ${
            menuOpen ? "bg-black/30 opacity-100" : "pointer-events-none opacity-0"
          }
        `}
        onClick={() => setMenuOpen(false)}
      />

      {/* DRAWER */}
      <aside
        className={`
          side-drawer
          fixed right-0 top-0 bottom-0 z-50 w-72 max-w-[80%]
          bg-white text-gray-900 shadow-xl border-l border-gray-200
          transform transition-transform duration-200
          ${menuOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              Menu do catálogo
            </span>
            <span className="text-sm font-semibold truncate max-w-[150px]">
              {displayName}
            </span>
          </div>

          <button
            onClick={() => setMenuOpen(false)}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
          >
            <span className="relative block h-4 w-4">
              <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 rotate-45 rounded-full bg-gray-800" />
              <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 -rotate-45 rounded-full bg-gray-800" />
            </span>
          </button>
        </div>

        <nav className="px-2 py-3 flex flex-col gap-1 text-sm">
          <button
            onClick={() => goTo("/catalogo")}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
              <Home className="h-4 w-4 text-red-600" />
            </span>
            <span>Catálogo</span>
          </button>

          <button
            onClick={() => goTo("/avisos")}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
              <Bell className="h-4 w-4 text-red-600" />
            </span>
            <span>Alertas</span>
          </button>

          {!isAdmin && (
            <button
              onClick={() => goTo("/favoritos")}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <Heart className="h-4 w-4 text-red-600" />
              </span>
              <span>Favoritos</span>
            </button>
          )}

          <button
            onClick={() => goTo("/modos-de-preparo")}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
              <CirclePlay className="h-4 w-4 text-red-600" />
            </span>
            <span>Modos de preparo</span>
          </button>

          <button
            onClick={() => goTo("/meus-pedidos")}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
              <ClipboardList className="h-4 w-4 text-red-600" />
            </span>
            <span>Pedidos</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => goTo("/relatorios")}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <BarChart2 className="h-4 w-4 text-red-600" />
              </span>
              <span>Relatórios</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => goTo("/operacao-delivery")}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <ClipboardList className="h-4 w-4 text-red-600" />
              </span>
              <span>Operação Delivery</span>
            </button>
          )}

          {/* ✅ DESTAQUES (só admin) — FIX: centraliza de verdade o SVG na bolinha */}
          {isAdmin && (
            <button
              onClick={() => goTo("/destaques")}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
            >
              {/* TROCA flex -> grid + svg block (remove baseline/inline) */}
              <span className="grid h-8 w-8 place-items-center rounded-full bg-red-100">
                <Star className="h-4 w-4 text-red-600 block" />
              </span>
              <span>Destaques</span>
            </button>
          )}

          {/* ✅ 8) Pedidos (Admin) - NOVO */}
          {isAdmin && (
            <button
              onClick={() => goTo("/admin/pedidos")}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <ClipboardList className="h-4 w-4 text-red-600" />
              </span>
              <span>Pedidos (Admin)</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => goTo("/admin/ofertas")}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <Sparkles className="h-4 w-4 text-red-600" />
              </span>
              <span>Ofertas Delivery</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => goTo("/admin/temas")}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <Palette className="h-4 w-4 text-red-600" />
              </span>
              <span>Temas do Site</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => goTo("/admin")}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-gray-800"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <PenSquare className="h-4 w-4 text-red-600" />
              </span>
              <span>Editar</span>
            </button>
          )}
        </nav>

        <div className="mt-auto px-3 pb-4 pt-2 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700 transition"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 container mx-auto px-4 py-4">
        {loadError && (
          <p className="mb-4 text-center text-red-600">Erro: {loadError}</p>
        )}

        {/* HERO */}
        <section className="mb-6 relative">
          <div
            className={`
              relative overflow-hidden rounded-[2rem] min-h-[300px] md:min-h-[390px] theme-season-hero
              flex items-stretch shadow-[0_28px_70px_rgba(15,23,42,0.22)]
              ${
                (hasNotices ? true : false) && !((hasNotices ? notices[currentNoticeIndex] : null)?.image_url)
                  ? "bg-gray-100 border border-gray-300"
                  : ""
              }
            `}
            style={
              (hasNotices ? notices[currentNoticeIndex] : null)
                ? (hasNotices ? notices[currentNoticeIndex] : null)?.image_url
                  ? {
                      backgroundImage: `url('${
                        (hasNotices ? notices[currentNoticeIndex] : null)!.image_url
                      }')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {}
                : {
                    backgroundImage: "url('/products/10034.jpg')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
            }
          >
            {activeTheme === "pascoa" && (
              <>
                <div className="easter-chocolate-drip" aria-hidden="true" />
                <div className="easter-bunny easter-bunny-hero" aria-hidden="true" />
                <div className="easter-egg easter-egg-hero-accent" aria-hidden="true" />
                {PASCOA_PETALS.map((petal, i) => (
                  <div
                    key={`petal-${i}`}
                    className="pascoa-petal"
                    style={{
                      left: petal.left,
                      width: "12px",
                      height: "18px",
                      background: petal.color,
                      animationDelay: petal.delay,
                      animationDuration: petal.duration,
                      "--petal-drift": petal.drift,
                    } as React.CSSProperties}
                    aria-hidden="true"
                  />
                ))}
              </>
            )}
            {activeTheme === "copa" && (
              <>
                {/* Holofotes do estádio */}
                {COPA_SPOTLIGHTS.map((spot, i) => (
                  <div
                    key={`copa-spot-${i}`}
                    className="copa-hero-spotlight"
                    style={{
                      left: spot.left,
                      animationDelay: spot.delay,
                      animationDuration: spot.duration,
                      "--spot-rot": spot.rot,
                    } as React.CSSProperties}
                    aria-hidden="true"
                  />
                ))}


                {/* Estrelas de campeonato */}
                {COPA_STARS_HERO.map((star, i) => (
                  <div
                    key={`copa-star-${i}`}
                    className="copa-hero-star"
                    style={{
                      left: star.left,
                      top: star.top,
                      width: star.size,
                      height: star.size,
                      animationDelay: star.delay,
                      animationDuration: star.duration,
                    }}
                    aria-hidden="true"
                  />
                ))}

                {/* Bandeirinhas do Brasil */}
                {COPA_FLAGS_HERO.map((flag, i) => (
                  <div
                    key={`copa-flag-${i}`}
                    className="copa-hero-flag"
                    style={{
                      left: flag.left,
                      top: flag.top,
                      animationDelay: flag.delay,
                      animationDuration: flag.duration,
                    }}
                    aria-hidden="true"
                  />
                ))}

                {/* Confetti colorido */}
                {COPA_CONFETTI.map((piece, i) => (
                  <div
                    key={`copa-confetti-${i}`}
                    className="copa-confetti-piece"
                    style={{
                      left: piece.left,
                      width: piece.w,
                      height: piece.h,
                      background: piece.color,
                      animationDelay: piece.delay,
                      animationDuration: piece.duration,
                      "--drift": piece.drift,
                    } as React.CSSProperties}
                    aria-hidden="true"
                  />
                ))}

                {/* Faixa tricolor hero */}
                <div className="copa-ribbon copa-ribbon-hero" aria-hidden="true" />

                {/* Grama do campo */}
                <div className="copa-hero-grass" aria-hidden="true" />
              </>
            )}
            {activeTheme === "blackfriday" && (
              <>
                {/* Background watermark text */}
                <div className="bf-hero-watermark" aria-hidden="true">BLACK FRIDAY</div>

                {/* Corner ribbon */}
                <div className="bf-corner-ribbon" aria-hidden="true">OFERTA</div>

                {/* Floating promo tags */}
                {BF_PROMO_TAGS.map((tag, i) => (
                  <div
                    key={`bf-tag-${i}`}
                    className="bf-promo-tag"
                    style={
                      {
                        left: tag.left,
                        top: tag.top,
                        animationDelay: tag.delay,
                        animationDuration: "3.2s",
                        "--tag-rot": tag.rot,
                      } as React.CSSProperties
                    }
                    aria-hidden="true"
                  >
                    <div className="bf-promo-tag-hole" />
                    <div className="bf-promo-tag-body">{tag.label}</div>
                  </div>
                ))}

                {/* Lightning bolts */}
                {BF_BOLTS.map((bolt, i) => (
                  <div
                    key={`bf-bolt-${i}`}
                    className="bf-hero-bolt"
                    style={{
                      left: bolt.left,
                      top: bolt.top,
                      width: bolt.width,
                      height: bolt.height,
                      background: "#ef4444",
                      animationDelay: bolt.delay,
                      animationDuration: bolt.duration,
                    }}
                    aria-hidden="true"
                  />
                ))}

                {/* Scrolling promotional ticker */}
                <div className="bf-ticker" aria-hidden="true">
                  <div className="bf-ticker-track">
                    {BF_TICKER_ITEMS.map((item, i) => (
                      i % 1 === 0 ? (
                        <span key={`ticker-${i}`}>
                          <span className="bf-ticker-item">{item}</span>
                          <span className="bf-ticker-dot" />
                        </span>
                      ) : null
                    ))}
                  </div>
                </div>
              </>
            )}
            {activeTheme === "anonovo" && (
              <div className="newyear-fireworks" aria-hidden="true">
                {NEW_YEAR_FIREWORKS.map((firework, index) => (
                  <div
                    key={`firework-${index}`}
                    className="newyear-firework"
                    style={
                      {
                        "--firework-x": firework.x,
                        "--firework-y": firework.y,
                        "--firework-scale": firework.size,
                        "--firework-delay": firework.delay,
                        "--firework-color": firework.color,
                      } as React.CSSProperties
                    }
                  >
                    {Array.from({ length: 8 }).map((_, rayIndex) => (
                      <span
                        key={`firework-ray-${index}-${rayIndex}`}
                        className="newyear-firework-ray"
                        style={{ transform: `rotate(${rayIndex * 45}deg)` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
            {activeTheme === "junino" && (
              <>
                <div className="junino-bunting junino-bunting-top" aria-hidden="true">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <span
                      key={`top-${index}`}
                      className="junino-flag"
                      style={{
                        backgroundColor: JUNINO_FLAG_COLORS[index % JUNINO_FLAG_COLORS.length],
                        transform: `rotate(${index % 2 === 0 ? -6 : 6}deg)`,
                      }}
                    />
                  ))}
                </div>
                <div className="junino-bunting junino-bunting-middle" aria-hidden="true">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <span
                      key={`middle-${index}`}
                      className="junino-flag junino-flag-small"
                      style={{
                        backgroundColor:
                          JUNINO_FLAG_COLORS[(index + 3) % JUNINO_FLAG_COLORS.length],
                        transform: `rotate(${index % 2 === 0 ? 5 : -5}deg)`,
                      }}
                    />
                  ))}
                </div>
                <div className="junino-hero-moon" aria-hidden="true" />
                {JUNINO_STARS_HERO.map((star, i) => (
                  <div
                    key={`junino-star-${i}`}
                    className="junino-hero-star"
                    style={{
                      left: star.left,
                      top: star.top,
                      width: star.size,
                      height: star.size,
                      animationDuration: star.duration,
                      animationDelay: star.delay,
                    }}
                    aria-hidden="true"
                  />
                ))}
              </>
            )}
            {activeTheme === "natal" && (
              <>
                {/* Neve sutil — CSS-only, performática */}
                <div className="natal-snow-container" aria-hidden="true">
                  {NATAL_SNOWFLAKES.map((flake, i) => (
                    <span
                      key={`snow-${i}`}
                      className="natal-snowflake"
                      style={{
                        left: flake.left,
                        width: flake.size,
                        height: flake.size,
                        animationDuration: flake.duration,
                        animationDelay: flake.delay,
                        "--snow-drift": flake.drift,
                      } as React.CSSProperties}
                    />
                  ))}
                </div>
                {/* Estrela de Belém — topo centro */}
                <div className="natal-star-belem natal-star-belem-hero" aria-hidden="true" />
                {/* Glow dourado suave no topo */}
                <div className="natal-hero-glow" aria-hidden="true" />
                {/* Ramos de pinheiro nos cantos */}
                <div className="natal-pine-left" aria-hidden="true" />
                <div className="natal-pine-right" aria-hidden="true" />
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/60 via-slate-900/40 to-slate-950/55" />
            <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -bottom-12 right-10 h-44 w-44 rounded-full bg-red-400/20 blur-3xl" />

            <div className="relative z-10 w-full px-6 py-8 md:px-10 md:py-10 flex items-start">
              {((hasNotices ? notices[currentNoticeIndex] : null) != null) ? (
                (hasNotices ? notices[currentNoticeIndex] : null)!.image_url ? (
                  <div className="relative max-w-2xl rounded-3xl border border-white/25 bg-white/10 p-5 md:p-7 backdrop-blur-md text-white shadow-[0_16px_44px_rgba(0,0,0,0.26)]">
                    {activeTheme === "natal" && <div className="santa-hat" aria-hidden="true" />}
                    <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] font-semibold">
                      Aviso em destaque
                    </span>
                    <div className="mt-3">
                      <h2 className="text-2xl md:text-4xl font-extrabold leading-tight">
                        {(hasNotices ? notices[currentNoticeIndex] : null)!.title}
                      </h2>
                      {!!(hasNotices ? notices[currentNoticeIndex] : null)!.body && (
                        <p className="mt-3 text-sm md:text-base text-white/90 line-clamp-3">
                          {(hasNotices ? notices[currentNoticeIndex] : null)!.body}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => navigate("/avisos")}
                      className="mt-6 inline-flex items-center px-5 py-2.5 rounded-full bg-white/92 text-slate-900 text-sm font-semibold hover:bg-white transition"
                    >
                      Ver aviso completo
                    </button>
                  </div>
                ) : (
                  <div className="relative max-w-2xl rounded-3xl border border-white/60 bg-white/88 px-5 py-6 md:px-7 md:py-8 backdrop-blur-md shadow-[0_18px_46px_rgba(15,23,42,0.20)]">
                    {activeTheme === "natal" && <div className="santa-hat" aria-hidden="true" />}
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-600 mb-2">
                      Avisos internos Gostinho Mineiro
                    </p>
                    <div className="border-l-4 border-red-500 pl-4">
                      <h2 className="text-2xl md:text-4xl font-extrabold leading-tight text-slate-900">
                        {(hasNotices ? notices[currentNoticeIndex] : null)!.title}
                      </h2>
                      <p className="mt-3 text-sm md:text-base text-gray-700">
                        {(hasNotices ? notices[currentNoticeIndex] : null)!.body}
                      </p>
                      <button
                        onClick={() => navigate("/avisos")}
                        className="mt-6 inline-flex items-center px-6 py-3 rounded-full bg-red-600 text-white font-semibold shadow-md hover:bg-red-700 transition"
                      >
                        Ver detalhes dos avisos
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="w-full flex items-center justify-center">
                  <div className="hero-default-panel max-w-3xl rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md px-5 py-6 md:px-9 md:py-8 text-center text-white flex flex-col items-center shadow-[0_22px_56px_rgba(0,0,0,0.28)]">
                    <h2 className="text-3xl md:text-5xl font-extrabold leading-tight">
                      Produtos Gostinho Mineiro
                    </h2>

                    <p className="hero-default-copy text-sm md:text-lg text-white/90 mt-3 max-w-2xl">
                      Uma experiência premium de delivery, rápida e intuitiva. Escolha seus produtos, finalize em poucos passos e receba no conforto de casa.
                    </p>

                    <button
                      onClick={() =>
                        catalogRef.current?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="hero-default-cta mt-6 inline-flex items-center justify-center px-6 py-3 rounded-full bg-white text-slate-900 font-semibold shadow-[0_10px_30px_rgba(255,255,255,0.25)] hover:bg-white/90 transition"
                    >
                      Ver catálogo de produtos
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {((hasNotices ? notices[currentNoticeIndex] : null) != null) && notices.length > 1 && (
            <>
              <button
                onClick={() =>
                  setCurrentNoticeIndex(
                    (prev) => (prev - 1 + notices.length) % notices.length
                  )
                }
                className="flex items-center justify-center absolute left-2 md:-left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-10 md:h-10 rounded-full bg-white shadow border border-red-100 hover:bg-red-50 transition"
              >
                <ChevronLeft className="h-5 w-5 text-red-600" />
              </button>
              <button
                onClick={() =>
                  setCurrentNoticeIndex((prev) => (prev + 1) % notices.length)
                }
                className="flex items-center justify-center absolute right-2 md:-right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-10 md:h-10 rounded-full bg-white shadow border border-red-100 hover:bg-red-50 transition"
              >
                <ChevronRight className="h-5 w-5 text-red-600" />
              </button>
            </>
          )}
        </section>

        {/* ✅ DESTAQUES */}
        {featuredLoading ? (
          <div
            className="
              mb-6 rounded-2xl border px-4 py-4 text-sm text-gray-600 flex items-center gap-2
              bg-white
              md:bg-white/60 md:backdrop-blur-md
            "
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600">
              ★
            </span>
            Carregando destaques...
          </div>
        ) : featuredCards.length ? (
          <div className="mb-7 gm-featured">
            <FeaturedProductsCarousel
              title="Produtos em destaque"
              items={featuredCards}
              speedPxPerSec={22}
              itemMinWidth={340}
              gap={20}
              className="md:mt-1"
            />
          </div>
        ) : null}

        {combosToShow.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-slate-900">
                  Combos inteligentes
                </h2>
              </div>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {combosToShow.map((combo) => (
                <article
                  key={combo.id}
                  onClick={() => handleOpenComboDetail(combo)}
                  className={`group relative cursor-pointer overflow-hidden rounded-[1.6rem] border p-3 shadow-[0_16px_44px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(15,23,42,0.18)] md:rounded-[1.9rem] md:p-4 ${comboTheme.cardClass}`}
                >
                  <div
                    className={`absolute -right-12 -top-12 h-40 w-40 rounded-full blur-2xl transition-transform duration-300 group-hover:scale-110 ${comboTheme.glowClass}`}
                  />

                  <div className="relative z-10">
                    <h3 className="text-[19px] leading-tight font-extrabold text-slate-900 md:text-[22px]">{combo.title}</h3>
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2 md:text-[15px]">
                      {combo.description}
                    </p>

                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2.5 items-end md:mt-4 md:gap-3">
                      <div className={`rounded-[1.15rem] border p-2 shadow-sm md:rounded-2xl ${comboTheme.mediaClass}`}>
                        <img
                          src={combo.items[0]?.product.images?.[0] || combo.items[0]?.product.image_path || "/placeholder.png"}
                          alt={combo.title}
                          className="h-20 w-full rounded-xl object-cover md:h-24"
                        />
                        <div className="-mt-2 flex items-center gap-2 overflow-hidden">
                          {combo.items.slice(0, 4).map((item) => (
                            <div key={item.product.id} className="relative">
                              <img
                                src={item.product.images?.[0] || item.product.image_path || "/placeholder.png"}
                                alt={item.product.name}
                                className="h-9 w-9 rounded-lg border-2 border-white object-cover shadow-sm md:h-10 md:w-10"
                              />
                              <span className="absolute -bottom-1 -right-1 rounded-full bg-red-600 text-white text-[10px] h-4 min-w-4 px-1 flex items-center justify-center font-bold">
                                {item.quantity}
                              </span>
                            </div>
                          ))}
                          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                            {combo.items.length} itens
                          </span>
                        </div>
                      </div>

                      <div className={`rounded-[1.15rem] border px-2.5 py-2 text-right shadow-sm md:rounded-2xl md:px-3 ${comboTheme.totalClass}`}>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Total</p>
                        <p className="text-[1.35rem] font-black text-slate-900 leading-none md:text-2xl">
                          {combo.total.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2.5 md:mt-4 md:gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold md:px-3 md:text-[11px] ${comboTheme.hintClass}`}>
                        Toque para ver detalhes
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddCombo(combo);
                        }}
                        className={`h-10 rounded-full px-4 text-sm font-bold md:h-11 md:px-6 md:text-base ${comboTheme.buttonClass}`}
                      >
                        Adicionar combo
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* CATÁLOGO */}
        <section ref={catalogRef} className="mt-4">
          <div
            ref={searchBarContainerRef}
            className={`
              search-sticky-bar
              z-30 bg-gray-50/95 backdrop-blur-md pb-3 transition-all duration-300
              ${
                isMobile
                  ? hideHeader
                    ? "fixed top-0 left-0 right-0 shadow-md"
                    : "sticky top-24"
                  : "sticky top-24"
              }
            `}
          >
            <div className="relative">
              <SearchBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedCategory={selectedCategory}
                setSelectedCategory={handleSelectCategory}
                categories={categories}
              />

              <button
                type="button"
                onClick={handleClearSearch}
                className={`
                  search-clear-btn
                  absolute right-4
                  top-[18px]
                  h-9 w-9 rounded-full
                  bg-white/90 backdrop-blur
                  border border-gray-200
                  shadow-sm
                  flex items-center justify-center
                  hover:bg-gray-50 active:scale-95
                  z-40
                  ${searchTerm.trim().length ? "opacity-100" : "opacity-60"}
                `}
                aria-label="Limpar busca"
                title="Limpar busca"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          {isMobile && hideHeader && <div className="h-[108px]" />}

          <div className="flex items-center justify-between mt-4 mb-4">
            <h2 className="catalog-heading text-xl font-bold text-slate-900">Produtos</h2>
            {!loading && (
              <p className="catalog-count text-xs text-slate-500">
                Exibindo {paginated.length} de {filtered.length} produtos
              </p>
            )}
          </div>

          {loading && !products.length ? (
            <ProductGridSkeleton />
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">Nenhum produto encontrado.</p>
          ) : (
            <>
              <div className="mb-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(p) => changePage(p)}
                  onPrev={() => changePage(currentPage - 1)}
                  onNext={() => changePage(currentPage + 1)}
                />
              </div>

              <div
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {paginated.map((p) => (
                    <motion.div
                      key={String(p.id)}
                      className="h-full"
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ProductCard
                        product={p}
                        relatedProducts={products}
                        crossSellRecommendations={crossSellMap[String(p.id)] ?? []}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(p) => changePage(p)}
                  onPrev={() => changePage(currentPage - 1)}
                  onNext={() => changePage(currentPage + 1)}
                />
              </div>
            </>
          )}
        </section>
      </main>

      <BottomNav noticeCount={notices.length} />
      <Footer activeTheme={activeTheme} />
      <HelperChat />
      <CartToggle />
      <Cart />

      <Dialog open={comboDetailOpen} onOpenChange={setComboDetailOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCombo?.title || "Detalhes do combo"}</DialogTitle>
            <DialogDescription>
              {selectedCombo?.description || "Confira os produtos deste combo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(selectedCombo?.items ?? []).map((item) => {
              const price = getDisplayProductPrice(item.product);
              const subtotal = price * item.quantity;
              return (
                <div
                  key={item.product.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${comboTheme.dialogItemClass}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.product.images?.[0] || item.product.image_path || "/placeholder.png"}
                      alt={item.product.name}
                      className="h-11 w-11 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.quantity}x {price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-900 whitespace-nowrap">
                    {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-slate-600">
              {selectedCombo?.items.length ?? 0} itens no combo
            </span>
            <Button
              type="button"
              onClick={() => {
                if (!selectedCombo) return;
                handleAddCombo(selectedCombo);
                setComboDetailOpen(false);
              }}
              className={`rounded-full ${comboTheme.buttonClass}`}
            >
              Adicionar combo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={snakeDialogOpen} onOpenChange={setSnakeDialogOpen}>
        <DialogContent className="max-w-[95vw] border-0 bg-white/95 p-4 shadow-[0_30px_90px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:max-w-3xl sm:p-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-2xl text-slate-900">Jogo da Cobinha</DialogTitle>
            <DialogDescription className="text-slate-600">
              Easter egg liberado com 7 cliques na logo da página principal.
            </DialogDescription>
          </DialogHeader>
          <SnakeGame />
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* --------------------------------------------------------
   FOOTER (padrão)
-------------------------------------------------------- */
const socialLinks = [
  {
    name: "Instagram",
    url: "https://www.instagram.com/gostinhomineiro.oficial/",
    icon: Instagram,
    hoverGlow:
      "from-fuchsia-200/0 via-fuchsia-300/70 to-amber-200/0",
    hoverIcon:
      "group-hover:bg-[linear-gradient(135deg,#f58529_0%,#feda77_20%,#dd2a7b_52%,#8134af_78%,#515bd4_100%)]",
  },
  {
    name: "Facebook",
    url: "https://www.facebook.com/gostinhomineirobsb/?locale=pt_BR",
    icon: Facebook,
    hoverGlow: "from-blue-100/0 via-blue-300/70 to-cyan-100/0",
    hoverIcon: "group-hover:bg-[#1877F2]",
  },
  {
    name: "YouTube",
    url: "https://www.youtube.com/@gostinhomineiropaodequeijo7377",
    icon: Youtube,
    hoverGlow: "from-red-100/0 via-red-300/70 to-orange-100/0",
    hoverIcon: "group-hover:bg-[#FF0000]",
  },
];

const developerText =
  "©️ 2026 Catálogo Interativo varejo desenvolvido por Winiston Alle & Mateus Borges";

const Footer: React.FC<{ activeTheme: AppThemeKey }> = ({ activeTheme }) => {
  return (
    <footer
      className={`footer-shell relative pt-4 pb-24 md:pb-2 ${
        activeTheme === "copa"
          ? "border-t border-green-300/60 bg-green-100/70"
          : "border-t border-slate-300/80 bg-slate-200/75"
      }`}
    >
      {activeTheme === "natal" && (
        <>
          <div className="xmas-tree xmas-tree-footer-left">
            <span className="xmas-tree-star" />
            <span className="xmas-tree-ornament xmas-tree-ornament-red" />
            <span className="xmas-tree-ornament xmas-tree-ornament-gold" />
            <span className="xmas-tree-ornament xmas-tree-ornament-blue" />
            <span className="xmas-tree-trunk" />
          </div>
          <div className="xmas-tree xmas-tree-footer-right">
            <span className="xmas-tree-star" />
            <span className="xmas-tree-ornament xmas-tree-ornament-red" />
            <span className="xmas-tree-ornament xmas-tree-ornament-gold" />
            <span className="xmas-tree-ornament xmas-tree-ornament-blue" />
            <span className="xmas-tree-trunk" />
          </div>
        </>
      )}
      {activeTheme === "anonovo" && (
        <>
          <div className="newyear-footer-glow" aria-hidden="true" />
          <div className="newyear-spark-cluster footer-left" aria-hidden="true" />
          <div className="newyear-spark-cluster footer-right" aria-hidden="true" />
        </>
      )}
      {activeTheme === "copa" && (
        <>
          <div className="copa-ribbon copa-ribbon-footer" aria-hidden="true" />
          <div className="copa-flag" aria-hidden="true">
            <span className="copa-flag-diamond" />
            <span className="copa-flag-circle" />
          </div>
        </>
      )}
      {activeTheme === "pascoa" && (
        <>
          <div className="easter-egg easter-egg-footer-accent" aria-hidden="true" />
          <div className="easter-cross" aria-hidden="true" />
        </>
      )}
      {activeTheme === "junino" && (
        <>
          <div className="junino-bunting junino-bunting-footer" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, index) => (
              <span
                key={`footer-flag-${index}`}
                className="junino-flag junino-flag-footer"
                style={{
                  backgroundColor:
                    JUNINO_FLAG_COLORS[(index + 2) % JUNINO_FLAG_COLORS.length],
                  transform: `rotate(${index % 2 === 0 ? 6 : -6}deg)`,
                }}
              />
            ))}
          </div>
          <div className="junino-lantern junino-lantern-left" aria-hidden="true" />
          <div className="junino-lantern junino-lantern-right" aria-hidden="true" />
        </>
      )}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center">
          {activeTheme === "anonovo" && (
            <p className="newyear-greeting newyear-greeting-footer mt-2">Feliz Ano Novo!</p>
          )}
          <div className="mb-4 mt-4 flex flex-wrap items-center justify-center gap-3">
            {socialLinks.map((link, index) => (
              <motion.a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Link para ${link.name}`}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
                whileHover={{ y: -4, scale: 1.06 }}
                whileTap={{ scale: 0.97 }}
                className="footer-social-btn group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/85 bg-white/88 text-slate-700 shadow-[0_14px_32px_rgba(15,23,42,0.10)] transition-shadow hover:shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
              >
                <span
                  className={`absolute inset-0 bg-gradient-to-r ${link.hoverGlow} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                />
                <span
                  className={`footer-social-icon relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${link.hoverIcon}`}
                >
                  <link.icon className="h-5 w-5" />
                </span>
              </motion.a>
            ))}
          </div>

          <div className="footer-developer pt-2 text-center">
            <p className="text-xs text-slate-500">{developerText}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Index;
