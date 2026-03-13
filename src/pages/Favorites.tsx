import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/products";
import ProductCard from "@/components/ProductCard";
import CartToggle from "@/components/CartToggle";
import Cart from "@/components/Cart";
import { Button } from "@/components/ui/button";
import logoGostinho from "@/images/logoc.png";

function safeGetSession() {
  try {
    const raw = localStorage.getItem("employee_session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getFavoriteStorageKey() {
  try {
    const sess = safeGetSession();
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

function mapRowToProduct(row: any): Product {
  const value = Number(row.employee_price ?? row.price ?? 0);
  return {
    id: row.id,
    old_id: row.old_id ?? null,
    name: row.name,
    price: value,
    employee_price: value,
    images: row.images ?? (row.image ? [row.image] : []),
    image_path: row.image_path ?? null,
    category: row.category ?? row.category_name ?? "Outros",
    description: row.description ?? "",
    packageInfo: row.packageInfo ?? row.package_info ?? "",
    weight: Number(row.weight ?? 0),
    isPackage: row.isPackage ?? row.is_package ?? false,
    featured: row.featured ?? row.isFeatured ?? false,
    inStock: row.inStock ?? row.in_stock ?? true,
    isLaunch: row.isLaunch ?? row.is_launch ?? false,
    extraInfo: row.extraInfo ?? undefined,
  };
}

const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const session: any = safeGetSession() ?? {};
  const displayName = session?.full_name ?? session?.name ?? "Cliente";

  useEffect(() => {
    const sess = localStorage.getItem("employee_session");
    if (!sess) navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    let alive = true;

    async function loadFavorites() {
      try {
        setLoading(true);
        setLoadError(null);

        const ids = readFavoriteIds();
        if (!ids.length) {
          if (!alive) return;
          setProducts([]);
          return;
        }

        const { data, error } = await supabase
          .from("products")
          .select("*")
          .in("id", ids);

        if (error) throw error;

        const byId = new Map((data ?? []).map((row: any) => [String(row.id), row]));
        const ordered = ids
          .map((id) => byId.get(String(id)))
          .filter(Boolean)
          .map(mapRowToProduct);

        if (!alive) return;
        setProducts(ordered);
      } catch (err: any) {
        if (!alive) return;
        setLoadError(err?.message ?? "Erro ao carregar favoritos.");
        setProducts([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadFavorites();

    const onFocus = () => loadFavorites();
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-20 bg-red-600 text-white border-b border-red-700">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button onClick={() => navigate("/catalogo")} aria-label="Voltar ao catálogo">
            <img src={logoGostinho} alt="Gostinho Mineiro" className="h-9 w-auto" />
          </button>
          <div className="text-right">
            <p className="text-sm font-semibold">{displayName}</p>
            <p className="text-xs opacity-90">Seus favoritos</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Favoritos</h1>
            <p className="text-sm text-gray-600">Produtos salvos para pedir mais rápido.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/catalogo")}>Voltar</Button>
        </div>

        {loading ? <p className="text-gray-600">Carregando favoritos...</p> : null}
        {loadError ? <p className="text-red-600">{loadError}</p> : null}

        {!loading && !loadError && products.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 bg-white text-center">
            <p className="font-medium text-gray-800">Você ainda não favoritou produtos.</p>
            <p className="text-sm text-gray-600 mt-1 mb-4">No catálogo, clique no coração para salvar itens aqui.</p>
            <Button onClick={() => navigate("/catalogo")}>Ir para o catálogo</Button>
          </div>
        ) : null}

        {!loading && !loadError && products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}
      </main>

      <CartToggle />
      <Cart />
    </div>
  );
};

export default FavoritesPage;
