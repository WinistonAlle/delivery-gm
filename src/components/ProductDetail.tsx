import React, { useState, useEffect, useMemo } from "react";
import { Product } from "@/types/products";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProductImageCarousel from "./ProductImageCarousel";
import { Package, Scale, Plus, Minus, Check, XCircle, BadgePercent } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useCart } from "@/contexts/useCart";
import { toast } from "./ui/sonner-toast";
import { getDisplayProductPrice, WHOLESALE_THRESHOLD } from "../../shared/productPricing";
import { findProductUpgradeSuggestions } from "@/lib/upsell";

interface ProductDetailProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  relatedProducts?: Product[];
  crossSellRecommendations?: Product[];
}

type ProductView = Product & {
  package_info?: string;
  is_package?: boolean;
  in_stock?: boolean;
};

const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  isOpen,
  onClose,
  relatedProducts = [],
  crossSellRecommendations = [],
}) => {
  const { addToCart, decreaseQuantity, updateQuantity, cartItems } = useCart();
  const productView = product as ProductView;

  // ---- campos flexíveis vindos do Supabase ----
  const images: string[] = Array.isArray(productView.images)
    ? productView.images
    : [];

  const packageInfo: string =
    productView.packageInfo ??
    productView.package_info ??
    "";

  const rawWeight =
    typeof productView.weight === "number"
      ? productView.weight
      : Number(productView.weight ?? 0) || null;

  const isPackage =
    productView.isPackage ?? productView.is_package ?? false;

  const isInStock =
    productView.inStock ??
    productView.in_stock ??
    true;

  const employeePrice = getDisplayProductPrice(productView);

  const extraInfo = productView.extraInfo ?? {};
  const getRotationOffset = (value: string, length: number) => {
    if (length <= 1) return 0;
    const hash = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return hash % length;
  };

  const rotateList = <T,>(items: T[], offset: number) => {
    if (!items.length || offset <= 0) return items;
    return [...items.slice(offset), ...items.slice(0, offset)];
  };

  const upgradeSuggestions = useMemo(
    () => findProductUpgradeSuggestions(product, relatedProducts),
    [product, relatedProducts]
  );
  const comboSuggestions = useMemo(() => {
    const source =
      crossSellRecommendations.length > 0
        ? crossSellRecommendations
        : relatedProducts.filter((candidate) => candidate.category === product.category);

    const uniqueCandidates = source.filter(
      (candidate, index, list) =>
        candidate.id !== product.id &&
        candidate.inStock !== false &&
        list.findIndex((item) => item.id === candidate.id) === index
    );

    const rotated = rotateList(
      uniqueCandidates,
      getRotationOffset(String(product.id), uniqueCandidates.length)
    );

    return rotated.slice(0, 3);
  }, [crossSellRecommendations, relatedProducts, product.category, product.id]);

  // Item atual no carrinho
  const currentItem = cartItems.find((item) => item.product.id === product.id);
  const quantity = currentItem ? currentItem.quantity : 0;

  // Estado do input de quantidade
  const [inputValue, setInputValue] = useState<string>(quantity.toString());
  const [manualEdit, setManualEdit] = useState(false);

  // Sincroniza quando o carrinho muda
  useEffect(() => {
    setInputValue(quantity.toString());
    if (!manualEdit || parseInt(inputValue) === quantity) {
      setManualEdit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setInputValue(value);
      setManualEdit(true);
    }
  };

  const handleApplyQuantity = () => {
    const newQuantity = parseInt(inputValue) || 0;

    if (newQuantity > 0) {
      const itemExists = cartItems.find(
        (item) => item.product.id === product.id
      );

      if (itemExists) {
        updateQuantity(product.id, newQuantity);
      } else {
        addToCart(product, newQuantity);
      }

      setManualEdit(false);
    } else {
      setInputValue(quantity.toString());
      toast("Quantidade inválida", {
        description: "Por favor, insira um número maior que zero.",
      });
    }
  };

  const handleAddToCart = () => {
    if (!isInStock) {
      toast("Produto indisponível", {
        description: "Este produto está temporariamente fora de estoque.",
      });
      return;
    }
    addToCart(product);
  };

  const handleDecreaseQuantity = () => {
    decreaseQuantity(product.id);
  };

  const handleQuickAdd = (candidate: Product, quantityToAdd = 1) => {
    addToCart(candidate, quantityToAdd);
    toast.success("Sugestão adicionada", {
      description: candidate.name,
    });
  };

  const showApplyButton =
    manualEdit && parseInt(inputValue || "0") !== quantity;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="break-words pr-8 text-xl font-extrabold text-slate-900">
            {product.name}
          </DialogTitle>
          {packageInfo && (
            <DialogDescription className="text-sm text-slate-500">
              {packageInfo}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="mt-4 space-y-4 overflow-x-hidden">
        <div className="relative w-full overflow-hidden rounded-2xl bg-gray-100">
          {images && images.length > 0 ? (
            <ProductImageCarousel
              images={images}
              productName={product.name}
              className="aspect-video overflow-hidden rounded-2xl"
            />
          ) : product.image_path ? (
            <img
              src={product.image_path}
              alt={product.name}
              className="aspect-video w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center text-sm text-gray-400">
              Sem imagem
            </div>
          )}

          {!isInStock && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-red-600 text-white font-bold px-3 py-2 rounded-md text-sm">
                SEM ESTOQUE
              </div>
            </div>
          )}
        </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {rawWeight && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1">
                  <Scale className="mr-1 h-3 w-3" />
                  {rawWeight.toFixed(2)}kg
                </span>
              )}
              {isPackage && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1">
                  <Package className="mr-1 h-3 w-3" />
                  Pacote
                </span>
              )}
            </div>

            {product.description ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {product.description}
              </p>
            ) : null}

            {!product.description &&
              !extraInfo?.usageTips &&
              !extraInfo?.ingredients &&
              !extraInfo?.funFact && (
                <p className="mt-3 text-sm text-slate-500">
                  Informações adicionais sobre este produto estarão disponíveis
                  em breve.
                </p>
              )}

            <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Preço
                </p>
                <span className="mt-1 block text-2xl font-extrabold text-red-600">
                  {Number(employeePrice || 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <BadgePercent className="h-3.5 w-3.5" />
                  Preço de atacado disponível em compras acima de{" "}
                  {WHOLESALE_THRESHOLD.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>

              {isInStock ? (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <Button
                    onClick={handleDecreaseQuantity}
                    variant="outline"
                    size="icon"
                    className={`h-9 w-9 rounded-full ${
                      quantity === 0 ? "cursor-not-allowed opacity-50" : ""
                    }`}
                    disabled={quantity === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>

                  <Input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    className="h-9 w-14 shrink-0 px-2 text-center"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />

                  {showApplyButton ? (
                    <Button
                      onClick={handleApplyQuantity}
                      variant="outline"
                      size="sm"
                      className="h-9 w-full rounded-full px-3 sm:w-auto"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Aplicar
                    </Button>
                  ) : null}

                  <Button
                    onClick={handleAddToCart}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-500 text-red-500"
                  disabled
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Indisponível
                </Button>
              )}
            </div>
          </div>

          {upgradeSuggestions.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {upgradeSuggestions[0].title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {upgradeSuggestions[0].description}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full rounded-full bg-amber-500 px-4 text-white hover:bg-amber-600 sm:w-auto sm:shrink-0"
                  onClick={() => handleQuickAdd(upgradeSuggestions[0].product)}
                >
                  Levar esta
                </Button>
              </div>
            </div>
          )}

          {comboSuggestions.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                Combina com
              </p>
              <div className="mt-3 space-y-2">
                {comboSuggestions.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex min-w-0 flex-col gap-3 rounded-xl bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-slate-900 sm:truncate">
                        {candidate.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {getDisplayProductPrice(candidate).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full rounded-full sm:w-auto"
                      onClick={() => handleQuickAdd(candidate)}
                    >
                      Adicionar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {extraInfo?.usageTips && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium text-gray-700">
                Dicas de uso:
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {extraInfo.usageTips}
              </p>
            </div>
          )}

          {extraInfo?.ingredients && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium text-gray-700">
                Ingredientes:
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {extraInfo.ingredients}
              </p>
            </div>
          )}

          {extraInfo?.funFact && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium text-gray-700">
                Você sabia?
              </h3>
              <p className="text-sm text-gray-600 mt-1">{extraInfo.funFact}</p>
            </div>
          )}

          {!isInStock && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center text-red-600">
              <XCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>Produto indisponível no momento.</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetail;
