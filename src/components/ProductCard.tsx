import React, { useEffect, useMemo, useState } from "react";
import { Product } from "../types/products";
import { useCart } from "../contexts/CartContext";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Plus, Minus, Package, Check, XCircle, Heart } from "lucide-react";
import { Input } from "./ui/input";
import ProductImageCarousel from "./ProductImageCarousel";
import ProductDetail from "./ProductDetail";
import { toast } from "./ui/sonner";

interface ProductCardProps {
  product: Product;
  hideImages?: boolean; // ✅ novo
  relatedProducts?: Product[];
  crossSellRecommendations?: Product[];
}

function getFavoriteStorageKey() {
  try {
    const raw = localStorage.getItem("employee_session");
    if (!raw) return "favorites_anon";
    const sess = JSON.parse(raw);
    const signature =
      sess?.id || sess?.cpf || sess?.phone || sess?.full_name || "anon";
    return `favorites_${String(signature)}`;
  } catch {
    return "favorites_anon";
  }
}

function readFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(getFavoriteStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => String(v));
  } catch {
    return [];
  }
}

function writeFavoriteIds(ids: string[]) {
  try {
    localStorage.setItem(getFavoriteStorageKey(), JSON.stringify(ids));
  } catch {
    // ignore localStorage errors
  }
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  hideImages = false,
  relatedProducts = [],
  crossSellRecommendations = [],
}) => {
  const { addToCart, decreaseQuantity, updateQuantity, cartItems } = useCart();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const employeePrice = Number(product.employee_price ?? 0);
  const isAvailable = product.inStock !== false;

  const currentItem = cartItems.find((item) => item.product.id === product.id);
  const quantity = currentItem?.quantity || 0;

  const [inputValue, setInputValue] = useState(quantity.toString());

  useEffect(() => {
    setInputValue(quantity.toString());
  }, [quantity]);

  // ✅ IMPORTANTE: evita o Carousel/Drag “roubar” os cliques dos botões
  const stop = (e: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    setInputValue(value);
  };

  const applyQuantity = () => {
    const newQuantity = parseInt(inputValue) || 0;

    if (newQuantity > 0) {
      if (quantity > 0) {
        updateQuantity(product.id, newQuantity);
      } else {
        addToCart(product, newQuantity);
      }
    } else {
      setInputValue(quantity.toString());
      toast.error("Quantidade inválida", {
        description: "Insira um número maior que zero.",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") applyQuantity();
  };

  const handleAddToCart = () => {
    if (!isAvailable) {
      toast.error("Produto indisponível", {
        description: "Este produto está temporariamente sem estoque.",
      });
      return;
    }
    addToCart(product);
  };

  const handleOpenDetail = () => {
    setIsDetailOpen(true);
  };

  const crossSellItems = useMemo(() => {
    if (crossSellRecommendations.length > 0) {
      return crossSellRecommendations
        .filter((candidate) => candidate.id !== product.id && candidate.inStock !== false)
        .slice(0, 2);
    }

    if (!relatedProducts.length) return [];

    return relatedProducts
      .filter(
        (candidate) =>
          candidate.id !== product.id &&
          candidate.category === product.category &&
          candidate.inStock !== false
      )
      .sort(
        (a, b) =>
          Number(b.employee_price ?? b.price ?? 0) -
          Number(a.employee_price ?? a.price ?? 0)
      )
      .slice(0, 2);
  }, [crossSellRecommendations, relatedProducts, product.id, product.category]);

  const handleCrossSellAdd = (candidate: Product, e: React.MouseEvent) => {
    stop(e);
    addToCart(candidate);
  };

  // ---------------------- FAVORITOS (Supabase) ----------------------
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const loadIsFavorite = useMemo(
    () => () => {
      const ids = readFavoriteIds();
      setIsFavorite(ids.includes(String(product.id)));
    },
    [product.id]
  );

  useEffect(() => {
    loadIsFavorite();
  }, [loadIsFavorite]);

  const toggleFavorite = (e: React.MouseEvent) => {
    stop(e);

    if (favLoading) return;
    setFavLoading(true);

    try {
      const ids = readFavoriteIds();
      const id = String(product.id);
      const exists = ids.includes(id);

      if (exists) {
        writeFavoriteIds(ids.filter((v) => v !== id));
        setIsFavorite(false);
        toast.message("Removido dos favoritos", { description: product.name });
      } else {
        writeFavoriteIds([...ids, id]);
        setIsFavorite(true);
        toast.success("Adicionado aos favoritos", { description: product.name });
      }
    } catch (err: any) {
      toast.error("Não foi possível atualizar favoritos", {
        description: err?.message ?? "Tente novamente.",
      });
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <>
      <Card
        data-card
        role="button"
        tabIndex={0}
        onClick={handleOpenDetail}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenDetail();
          }
        }}
        className={`
          relative
          overflow-hidden
          shadow-[0_14px_34px_rgba(15,23,42,0.08)] rounded-3xl
          border transition-all duration-300
          min-w-0
          cursor-pointer

          bg-white/60 backdrop-blur-2xl
          ${hideImages ? "flex flex-col" : "flex flex-row md:flex-col"}
          ${
            quantity > 0
              ? "border-red-200 shadow-[0_18px_40px_rgba(220,38,38,0.18)] translate-y-[-2px]"
              : "border-white/80 hover:translate-y-[-2px] hover:shadow-[0_20px_42px_rgba(15,23,42,0.14)]"
          }

          [[data-featured-card='true']_&]:flex-col
          [[data-featured-card='true']_&]:bg-white
          [[data-featured-card='true']_&]:backdrop-blur-0
          [[data-featured-card='true']_&]:border-gray-200/80
          [[data-featured-card='true']_&]:shadow-[0_10px_24px_rgba(0,0,0,0.12)]

          md:[[data-featured-card='true']_&]:bg-white/40
          md:[[data-featured-card='true']_&]:backdrop-blur-sm
          md:[[data-featured-card='true']_&]:border-white/20
          md:[[data-featured-card='true']_&]:shadow-sm
        `}
      >
        {/* ❤️ FAVORITO */}
        <button
          type="button"
          onPointerDown={stop}
          onTouchStart={stop}
          onClick={toggleFavorite}
          aria-label={
            isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
          }
          className={`
            absolute top-2 right-2 z-30
            inline-flex items-center justify-center
            h-8 w-8 rounded-full
            bg-white/95 backdrop-blur-sm
            border border-white/90
            shadow-sm
            transition-transform
            hover:scale-[1.03]
            active:scale-[0.98]
            ${favLoading ? "opacity-70" : ""}

            [[data-featured-card='true']_&]:bg-white
            [[data-featured-card='true']_&]:backdrop-blur-0
            [[data-featured-card='true']_&]:border-gray-200/70
            md:[[data-featured-card='true']_&]:bg-white/90
            md:[[data-featured-card='true']_&]:backdrop-blur-sm
          `}
        >
          <Heart
            className={`
              h-4 w-4
              ${isFavorite ? "fill-red-600 text-red-600" : "text-gray-600"}
            `}
          />
        </button>

        {/* ✅ IMAGEM */}
        {!hideImages && (
          <button
            type="button"
            onClick={handleOpenDetail}
            className={`
              relative
              bg-slate-100/80
              overflow-hidden
              flex items-center justify-center
              flex-shrink-0
              group

              w-24 h-24
              md:w-full md:h-auto md:aspect-square
              rounded-l-2xl md:rounded-t-2xl md:rounded-b-none
              mr-3 md:mr-0

              [[data-featured-card='true']_&]:w-full
              [[data-featured-card='true']_&]:h-[190px]
              [[data-featured-card='true']_&]:mr-0
              [[data-featured-card='true']_&]:rounded-t-2xl
              [[data-featured-card='true']_&]:rounded-b-none

              md:[[data-featured-card='true']_&]:h-auto
              md:[[data-featured-card='true']_&]:aspect-square
              md:[[data-featured-card='true']_&]:rounded-t-2xl
              md:[[data-featured-card='true']_&]:rounded-b-none
            `}
            aria-label={`Imagem do produto ${product.name}`}
          >
            {product.images && product.images.length > 0 ? (
              <ProductImageCarousel
                images={product.images}
                productName={product.name}
                className={`
                  w-full h-full
                  transition-transform duration-300
                  group-hover:scale-105
                  object-contain md:object-cover
                  [[data-featured-card='true']_&]:object-cover
                `}
              />
            ) : product.image_path ? (
              <img
                src={product.image_path}
                alt={product.name}
                loading="lazy"
                decoding="async"
                className={`
                  w-full h-full
                  transition-transform duration-300
                  group-hover:scale-105
                  object-cover md:object-cover
                  [[data-featured-card='true']_&]:object-cover
                `}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs md:text-sm">
                Sem imagem
              </div>
            )}

            <div className="hidden md:inline-flex absolute top-2 right-12 bg-white/95 text-slate-700 font-bold px-2 py-1 rounded-full text-[10px] shadow-sm">
              {product.category}
            </div>

            {product.isLaunch && (
              <div className="absolute top-2 left-2 bg-green-600 text-white font-bold px-2 py-1 rounded-full text-[10px] shadow-sm">
                Lançamento
              </div>
            )}

            {!isAvailable && !product.isLaunch && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <div className="bg-red-600 text-white font-bold px-3 py-2 rounded-md text-xs">
                  Sem Estoque
                </div>
              </div>
            )}

            <span className="hidden md:block absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded-full bg-black/40 text-white backdrop-blur-sm">
              Ver detalhes
            </span>
          </button>
        )}

        {/* ---------------------- INFORMAÇÕES ---------------------- */}
        <div className="flex flex-1 min-w-0 flex-col justify-between">
          <CardContent
            className={`
              flex-grow
              min-w-0
              ${
                hideImages
                  ? "pt-2 pb-1 px-3"
                  : "pt-2 md:pt-4 pb-1 md:pb-3 pr-3 md:pr-4 pl-1.5 md:pl-4"
              }

              [[data-featured-card='true']_&]:px-3
              [[data-featured-card='true']_&]:pt-3
              [[data-featured-card='true']_&]:pb-2
              md:[[data-featured-card='true']_&]:px-4
              md:[[data-featured-card='true']_&]:pt-4
              md:[[data-featured-card='true']_&]:pb-3
            `}
          >
            <h3
              className={`
                font-semibold mb-1 line-clamp-2 min-w-0
                ${hideImages ? "text-[13px]" : "text-[13px] md:text-base"}
                [[data-featured-card='true']_&]:text-[14px]
                md:[[data-featured-card='true']_&]:text-base
              `}
              title={product.name}
            >
              {product.name}
            </h3>

            <p className="text-[11px] md:text-xs text-gray-500 mb-1 line-clamp-2 min-w-0">
              {product.packageInfo}
            </p>

            {product.description && (
              <p className="hidden md:block text-xs text-gray-500 mb-2 line-clamp-2">
                {product.description}
              </p>
            )}

            <div className="hidden md:flex items-center gap-2 mb-2 text-[11px] text-gray-500">
              {product.isPackage && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
                  <Package className="h-3 w-3 mr-1" />
                  Pacote
                </span>
              )}

              {quantity > 0 && (
                <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 px-2 py-0.5">
                  <Check className="h-3 w-3 mr-1" />
                  No carrinho
                </span>
              )}
            </div>

            <p className="text-[15px] md:text-lg font-bold text-slate-900 mt-1">
              {employeePrice.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          </CardContent>

          {/* ---------------------- FOOTER / QUANTIDADE ---------------------- */}
          <CardFooter
            className={`
              pt-0 flex justify-start items-center
              ${
                hideImages
                  ? "pb-3 px-3"
                  : "pb-2 md:pb-4 pr-3 md:pr-4 pl-1.5 md:pl-4"
              }

              [[data-featured-card='true']_&]:px-3
              [[data-featured-card='true']_&]:pb-3
              md:[[data-featured-card='true']_&]:px-4
              md:[[data-featured-card='true']_&]:pb-4
            `}
          >
            {isAvailable ? (
              <div
                className="flex items-center gap-2"
                onPointerDown={stop}
                onTouchStart={stop}
                onClick={stop}
              >
                <Button
                  onClick={(e) => {
                    stop(e);
                    decreaseQuantity(product.id);
                  }}
                  variant="outline"
                  size="icon"
                  className="rounded-full h-7 w-7 md:h-8 md:w-8"
                  disabled={quantity === 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>

                <div className="relative" onPointerDown={stop} onTouchStart={stop}>
                  <Input
                    type="text"
                    value={inputValue}
                    onChange={handleQuantityChange}
                    onBlur={applyQuantity}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => stop(e)}
                    onPointerDown={(e) => stop(e)}
                    inputMode="numeric"
                    className="h-7 w-10 md:h-8 md:w-12 px-2 text-center text-xs md:text-sm"
                  />

                  {inputValue !== quantity.toString() && (
                    <Button
                      onClick={(e) => {
                        stop(e);
                        applyQuantity();
                      }}
                      variant="outline"
                      size="sm"
                      className="absolute -right-11 top-0 h-7 px-2 md:h-8 md:px-2"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <Button
                  onClick={(e) => {
                    stop(e);
                    handleAddToCart();
                  }}
                  variant={quantity > 0 ? "default" : "outline"}
                  size="icon"
                  className={`rounded-full h-7 w-7 md:h-8 md:w-8 ${
                    quantity > 0 ? "bg-slate-900 text-white hover:bg-slate-800" : ""
                  }`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 border-red-500"
                disabled
              >
                <XCircle className="h-4 w-4 mr-1" />
                {product.isLaunch ? "Em Breve" : "Indisponível"}
              </Button>
            )}
          </CardFooter>
        </div>
      </Card>

      <ProductDetail
        product={product}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </>
  );
};

export default ProductCard;
