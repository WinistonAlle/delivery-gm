// src/pages/Admin.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/products";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PageLoader from "@/components/PageLoader";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

const FALLBACK_IMG = "/placeholder.png";

// ✅ bucket criado no Supabase Storage via SQL
const STORAGE_BUCKET = "products";

const CATEGORY_LABELS: Record<string, string> = {
  "1": "Pão de Queijo",
  "2": "Salgados Assados",
  "3": "Salgados P/ Fritar",
  "4": "Pães e Massas Doces",
  "5": "Biscoito de Queijo",
  "6": "Salgados Grandes",
  "7": "Alho em creme",
  "8": "Outros",
};

const SALE_TYPE_LABELS = {
  kg: "Por kg",
  pct: "Pacote",
} as const;

type AdminProduct = Omit<Product, "category" | "extraInfo"> & {
  category: string;
  image_path?: string | null;
  weight: number;
  extraInfo?: Product["extraInfo"] | null;
};

type ProductRow = Record<string, unknown> & {
  id?: string | null;
  old_id?: unknown;
  name?: string | null;
  price?: unknown;
  employee_price?: unknown;
  images?: unknown;
  image?: unknown;
  image_path?: string | null;
  category_id?: unknown;
  category?: unknown;
  category_name?: unknown;
  categoryId?: unknown;
  description?: string | null;
  packageInfo?: string | null;
  package_info?: string | null;
  saleType?: Product["saleType"] | null;
  sale_type?: Product["saleType"] | null;
  weight?: unknown;
  isPackage?: boolean | null;
  is_package?: boolean | null;
  featured?: boolean | null;
  isFeatured?: boolean | null;
  inStock?: boolean | null;
  in_stock?: boolean | null;
  isLaunch?: boolean | null;
  is_launch?: boolean | null;
  extraInfo?: Product["extraInfo"] | null;
  extra_info?: Product["extraInfo"] | null;
};

type ProductPayload = {
  id: string;
  old_id: number | null;
  name: string;
  employee_price: number;
  sale_type: Product["saleType"];
  unit: string;
  category_id: number | null;
  images: string[];
  image_path: string | null;
  description: string;
  package_info: string;
  weight: number;
  is_package: boolean;
  featured: boolean;
  in_stock: boolean;
  is_launch: boolean;
  extra_info: Product["extraInfo"] | Record<string, never>;
};

type WeightRow = {
  product_id?: string | number | null;
  weight?: unknown;
};

type Editable = AdminProduct & {
  images?: string[];

  // ✅ mantém o texto enquanto digita (pra aceitar 3,5 / 3.5)
  weight_input?: string;
  employee_price_input?: string;
};

const PRODUCTS_CACHE_KEY = "gm_catalog_products_v1";

function parseBRNumber(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;

  const s = String(v).trim();
  if (!s) return fallback;

  const normalized = s.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function safeNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseBRNumber(v, NaN);
  return Number.isFinite(n) ? n : null;
}

function safeNumber(v: unknown, fallback = 0): number {
  return parseBRNumber(v, fallback);
}

function normalizeImages(row: ProductRow): string[] {
  if (Array.isArray(row.images)) return row.images.filter((value): value is string => typeof value === "string" && Boolean(value));
  if (typeof row.images === "string" && row.images.trim())
    return row.images
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);

  if (row.image && typeof row.image === "string") return [row.image];
  if (row.image_path && typeof row.image_path === "string") return [row.image_path];
  return [];
}

function mapRowToProduct(row: ProductRow): AdminProduct {
  const employeePrice = safeNumber(row.employee_price ?? row.price, 0);

  const categoryId =
    row.category_id ?? row.category ?? row.category_name ?? row.categoryId ?? null;

  const oldId = safeNumberOrNull(row.old_id);

  const images = normalizeImages(row);

  return {
    id: String(row.id ?? ""),
    old_id: oldId,
    name: row.name ?? "",
    price: employeePrice,
    employee_price: employeePrice,
    images,
    image_path: row.image_path ?? (images[0] ?? null),

    category: categoryId != null ? String(categoryId) : "8",

    description: row.description ?? "",
    packageInfo: row.packageInfo ?? row.package_info ?? "",
    saleType: row.saleType === "pct" || row.sale_type === "pct" ? "pct" : "kg",
    weight: safeNumber(row.weight, 0),

    isPackage: row.isPackage ?? row.is_package ?? false,
    featured: row.featured ?? row.isFeatured ?? false,

    inStock: row.inStock ?? row.in_stock ?? true,

    isLaunch: row.isLaunch ?? row.is_launch ?? false,
    extraInfo: row.extraInfo ?? row.extra_info ?? null,
  };
}

function mapEditingToDbPayload(editing: Editable) {
  const employeePrice = parseBRNumber(
    editing.employee_price_input ?? editing.employee_price,
    0
  );
  const weightValue = parseBRNumber(editing.weight_input ?? editing.weight, 0);
  const normalizedImages = (editing.images ?? [])
    .map((image) => image.trim())
    .filter(Boolean);

  const firstImage =
    normalizedImages.length > 0
      ? normalizedImages[0]
      : (editing.image_path?.trim() ?? null);

  const payload: ProductPayload = {
    id: editing.id,
    old_id: safeNumberOrNull(editing.old_id),

    name: editing.name?.trim() ?? "",
    employee_price: employeePrice,
    sale_type: editing.saleType === "pct" ? "pct" : "kg",
    unit: "un",

    category_id: editing.category ? Number(editing.category) : null,
    images: normalizedImages,

    image_path: editing.image_path ?? firstImage,

    description: editing.description ?? "",
    package_info: editing.packageInfo ?? "",
    weight: weightValue,
    is_package: !!editing.isPackage,
    featured: !!editing.featured,
    in_stock: editing.inStock !== false,
    is_launch: !!editing.isLaunch,
    extra_info: editing.extraInfo ?? {},
  };

  return payload;
}

function isCatalogHidden(product: Pick<AdminProduct, "extraInfo">) {
  return product.extraInfo?.hidden === true;
}

function setCatalogHidden(
  extraInfo: Product["extraInfo"] | null | undefined,
  hidden: boolean
): Product["extraInfo"] {
  return {
    ...(extraInfo ?? {}),
    hidden,
  };
}

function getAdminProductsApiUrl() {
  if (typeof window === "undefined") return "/api/admin-products";
  return new URL("/api/admin-products", window.location.origin).toString();
}

function getAdminApiHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

async function readApiPayload<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchProductsDirectly(): Promise<AdminProduct[]> {
  const { data: productsData, error: pErr } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (pErr) throw pErr;

  const mapped = ((productsData ?? []) as ProductRow[]).map(mapRowToProduct);
  const ids = mapped.map((p) => p.id).filter(Boolean);

  if (ids.length) {
    const { data: wData, error: wErr } = await supabase
      .from("weight")
      .select("product_id, weight")
      .in("product_id", ids);

    if (!wErr) {
      const byId = new Map<string, number>();
      ((wData ?? []) as WeightRow[]).forEach((row) => {
        if (row.product_id) byId.set(String(row.product_id), safeNumber(row.weight, 0));
      });

      for (const p of mapped) {
        const w = byId.get(String(p.id));
        if (w !== undefined) p.weight = w;
      }
    }
  }

  return mapped;
}

type AdminProductsApiResponse = {
  items?: ProductRow[];
  error?: string;
};

async function fetchProductsFromApi(): Promise<AdminProduct[]> {
  const response = await fetch(getAdminProductsApiUrl(), {
    method: "GET",
    credentials: "include",
  });

  const result = await readApiPayload<AdminProductsApiResponse>(response);
  if (!response.ok) {
    throw new Error(result?.error || "Erro ao carregar produtos.");
  }

  return ((result?.items ?? []) as ProductRow[]).map(mapRowToProduct);
}

async function saveProductThroughApi(payload: ProductPayload): Promise<AdminProduct[]> {
  const response = await fetch(getAdminProductsApiUrl(), {
    method: "POST",
    credentials: "include",
    headers: getAdminApiHeaders(),
    body: JSON.stringify(payload),
  });

  const result = await readApiPayload<AdminProductsApiResponse>(response);
  if (!response.ok) {
    throw new Error(result?.error || "Erro ao salvar produto.");
  }

  return ((result?.items ?? []) as ProductRow[]).map(mapRowToProduct);
}

async function deleteProductThroughApi(productId: string): Promise<AdminProduct[]> {
  const response = await fetch(getAdminProductsApiUrl(), {
    method: "DELETE",
    credentials: "include",
    headers: getAdminApiHeaders(),
    body: JSON.stringify({ id: productId }),
  });

  const result = await readApiPayload<AdminProductsApiResponse>(response);
  if (!response.ok) {
    throw new Error(result?.error || "Erro ao excluir produto.");
  }

  return ((result?.items ?? []) as ProductRow[]).map(mapRowToProduct);
}

function invalidateCatalogCache() {
  try {
    localStorage.removeItem(PRODUCTS_CACHE_KEY);
  } catch {
    // ignore localStorage errors
  }
}

export default function Admin() {
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Busca / filtro
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string>("todas");

  // Form (add/edit)
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Editable | null>(null);

  // Exclusão
  const [toDelete, setToDelete] = useState<Product | null>(null);

  // Upload de imagem
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Scroll to Top
  const [showScroll, setShowScroll] = useState(false);

  const checkScrollTop = () => {
    if (!showScroll && window.pageYOffset > 400) setShowScroll(true);
    else if (showScroll && window.pageYOffset <= 400) setShowScroll(false);
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  useEffect(() => {
    window.addEventListener("scroll", checkScrollTop);
    return () => window.removeEventListener("scroll", checkScrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScroll]);

  const reloadProducts = useCallback(async () => {
    try {
      setItems(await fetchProductsFromApi());
      return;
    } catch (err) {
      console.error("Erro ao carregar produtos via API:", err);
    }

    setItems(await fetchProductsDirectly());
  }, []);

  // --------- Carregar produtos do Supabase ----------
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        await reloadProducts();
      } catch (err) {
        console.error("Erro ao carregar produtos:", err);
        alert("Erro ao carregar produtos do banco.");
      } finally {
        setLoading(false);
      }
    };

    void fetchProducts();
  }, [reloadProducts]);

  // --------- Categorias dinâmicas ----------
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((p) => {
      if (p.category != null) set.add(String(p.category));
    });
    return Array.from(set).sort();
  }, [items]);

  // --------- Ordenação / filtro ----------
  const ordenados = useMemo(() => {
    return [...items].sort((a, b) => {
      const catA = String(a.category ?? "");
      const catB = String(b.category ?? "");
      if (catA !== catB) return catA.localeCompare(catB);
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [items]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return ordenados.filter((p) => {
      const catId = String(p.category ?? "");
      const catLabel = CATEGORY_LABELS[catId] ?? catId;
      const byCat = categoria === "todas" || catId === categoria;

      if (!termo) return byCat;

      const haystack = [p.name, catId, catLabel, p.description, p.id, p.old_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return byCat && haystack.includes(termo);
    });
  }, [ordenados, busca, categoria]);

  // --------- Form: Add / Edit ----------
  const startAdd = () => {
    setEditing({
      // ✅ AGORA É UUID DE VERDADE (evita erro "invalid input syntax for type uuid")
      id: generateId(),
      old_id: null,
      name: "",
      price: 0,
      employee_price: 0,
      employee_price_input: "",
      images: [],
      image_path: null,
      category: "8",
      description: "",
      packageInfo: "",
      saleType: "kg",
      weight: 0,
      weight_input: "",
      isPackage: false,
      isLaunch: false,
      featured: false,
      inStock: true,
      extraInfo: null,
    });
    setOpenForm(true);
  };

  const startEdit = (p: AdminProduct) => {
    const weightNum = safeNumber(p.weight, 0);
    const priceNum = safeNumber(p.employee_price, 0);

    setEditing({
      ...p,
      old_id: safeNumberOrNull(p.old_id),
      images: (p.images ?? []).filter(Boolean),
      image_path: p.image_path ?? (p.images?.[0] ?? null),

      weight: weightNum,
      weight_input: String(weightNum).replace(".", ","),

      employee_price: priceNum,
      employee_price_input: String(priceNum).replace(".", ","),
    });
    setOpenForm(true);
  };

  const closeForm = () => {
    setOpenForm(false);
    setEditing(null);
    setUploadError(null);
  };

  // --------- Upload de imagem p/ Supabase ----------
  async function uploadProductImage(file: File): Promise<string> {
    setUploadingImage(true);
    setUploadError(null);

    try {
      const productId = editing?.id ?? "unknown";
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `${productId}/${fileName}`;

      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(
        filePath,
        file,
        {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "image/jpeg",
        }
      );

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(data.path);

      const url = publicData?.publicUrl;
      if (!url) throw new Error("Não foi possível obter a URL pública.");

      return url;
    } catch (err: unknown) {
      console.error("Erro ao enviar imagem:", err);
      setUploadError(err instanceof Error ? err.message : "Erro ao enviar imagem. Tente novamente.");
      throw err;
    } finally {
      setUploadingImage(false);
    }
  }

  // --------- Handlers de arquivo / drag & drop ----------
  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;

    uploadProductImage(file)
      .then((url) => {
        setEditing((prev) =>
          prev
            ? {
                ...prev,
                images: [url, ...(prev.images ?? [])],
                image_path: prev.image_path ?? url,
              }
            : prev
        );
      })
      .catch(() => {});
  }

  function handleImageDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!editing) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    uploadProductImage(file)
      .then((url) => {
        setEditing((prev) =>
          prev
            ? {
                ...prev,
                images: [url, ...(prev.images ?? [])],
                image_path: prev.image_path ?? url,
              }
            : prev
        );
      })
      .catch(() => {});
  }

  function handleImageDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  // --------- Salvar (INSERT/UPDATE) ----------
  const onSubmitForm = async () => {
    if (!editing) return;

    if (!editing.name?.trim()) {
      alert("Informe o nome.");
      return;
    }

      setSaving(true);
    try {
      const payload = mapEditingToDbPayload(editing);
      await saveProductThroughApi(payload);
      await reloadProducts();
      invalidateCatalogCache();

      closeForm();
    } catch (err: unknown) {
      console.error("Erro ao salvar produto:", err);
      alert(
        "Erro ao salvar produto no banco.\n\n" +
          (err instanceof Error ? err.message : "Erro desconhecido.")
      );
    } finally {
      setSaving(false);
    }
  };

  // --------- Excluir ----------
  const confirmDelete = (p: Product) => setToDelete(p);

  const doDelete = async () => {
    if (!toDelete) return;
    const deletingProductId = toDelete.id;
    const previousItems = items;
    setDeleting(true);
    setToDelete(null);
    setItems((current) => current.filter((item) => item.id !== deletingProductId));

    try {
      await deleteProductThroughApi(deletingProductId);
      await reloadProducts();
      invalidateCatalogCache();
    } catch (err) {
      setItems(previousItems);
      console.error("Erro ao excluir produto:", err);
      alert(
        "Erro ao excluir produto no banco.\n\n" +
          (err instanceof Error ? err.message : "Erro desconhecido.")
      );
    } finally {
      setDeleting(false);
    }
  };

  const toggleCatalogVisibility = async (product: AdminProduct) => {
    const nextHidden = !isCatalogHidden(product);
    const payload = mapEditingToDbPayload({
      ...product,
      extraInfo: setCatalogHidden(product.extraInfo, nextHidden),
      images: product.images ?? [],
      weight_input: String(safeNumber(product.weight, 0)).replace(".", ","),
      employee_price_input: String(safeNumber(product.employee_price, 0)).replace(".", ","),
    });

    setSaving(true);
    try {
      setItems(await saveProductThroughApi(payload));
      invalidateCatalogCache();
    } catch (err) {
      console.error("Erro ao atualizar visibilidade do produto:", err);
      alert(
        "Erro ao atualizar visibilidade do produto.\n\n" +
          (err instanceof Error ? err.message : "Erro desconhecido.")
      );
    } finally {
      setSaving(false);
    }
  };

  // --------- Render ----------
  return (
    <div className="p-6 space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = "/catalogo";
            }}
          >
            ← Voltar ao Catálogo
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/admin/ofertas";
            }}
          >
            Gerenciar Ofertas Delivery
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/admin/temas";
            }}
          >
            Gerenciar Temas
          </Button>
          <h1 className="text-xl font-semibold">Painel de Produtos (Admin)</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, categoria, ID ou old_id..."
            className="w-72"
          />

          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categoryOptions.map((id) => (
                <SelectItem key={id} value={id}>
                  {CATEGORY_LABELS[id] ?? id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-border mx-1" />

          <Button onClick={startAdd}>Novo produto</Button>
        </div>
      </header>

      {loading ? (
        <PageLoader fullscreen={false} label="Carregando produtos..." />
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhum produto encontrado.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            {filtrados.length} produto(s)
            {busca ? ` • filtro: “${busca}”` : ""}
            {categoria !== "todas" ? ` • ${CATEGORY_LABELS[categoria] ?? categoria}` : ""}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((p) => {
              const catId = String(p.category ?? "");
              const catLabel = CATEGORY_LABELS[catId] || catId || "Sem categoria";

              const thumb =
                (p.images?.length ? p.images[0] : null) ||
                p.image_path ||
                FALLBACK_IMG;

              const w = safeNumber(p.weight, 0);
              const hidden = isCatalogHidden(p);

              return (
                <Card key={p.id} className={`overflow-hidden ${hidden ? "opacity-75" : ""}`}>
                  <CardHeader className="p-0">
                    <img
                      src={thumb}
                      alt={p.name}
                      className="h-40 w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                      }}
                    />
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                    <CardTitle className="text-base leading-snug line-clamp-2">
                      {p.name}
                    </CardTitle>

                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Badge variant="secondary">{catLabel || "Sem categoria"}</Badge>
                      {p.isPackage && <Badge>Pacote</Badge>}
                      {p.featured && <Badge>⭐ Destaque</Badge>}
                      {p.inStock === false && (
                        <Badge variant="destructive">Sem estoque</Badge>
                      )}
                      {hidden && <Badge variant="outline">Oculto no catálogo</Badge>}
                      {p.isLaunch && <Badge variant="outline">Lançamento</Badge>}
                    </div>

                    <div className="text-lg font-semibold">
                      R$ {safeNumber(p.employee_price, 0).toFixed(2)}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      ID: {p.old_id !== null ? p.old_id : p.id} •{" "}
                      {p.packageInfo || "—"} • {w ? `${w}kg` : ""}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => startEdit(p)}>
                        Editar
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void toggleCatalogVisibility(p)}
                        disabled={saving || deleting}
                      >
                        {hidden ? "Reexibir" : "Ocultar"}
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => confirmDelete(p)}
                        disabled={saving || deleting}
                      >
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Dialog do formulário */}
      <Dialog open={openForm} onOpenChange={(o) => (o ? setOpenForm(true) : closeForm())}>
        <DialogContent className="sm:max-w-[780px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Resumo + preview */}
              <div className="sm:col-span-2 flex items-center gap-4 border rounded-lg p-3">
                <img
                  src={(editing.images && editing.images[0]) || editing.image_path || FALLBACK_IMG}
                  alt={editing.name}
                  className="h-16 w-16 rounded-md object-cover border"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                  }}
                />
                <div className="flex-1">
                  <div className="font-semibold line-clamp-1">
                    {editing.name || "Produto sem nome"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ID: {editing.old_id !== null ? editing.old_id : editing.id} • R${" "}
                    {parseBRNumber(
                      editing.employee_price_input ?? editing.employee_price,
                      0
                    ).toFixed(2)}
                    {" • "}
                    {SALE_TYPE_LABELS[editing.saleType]}
                  </div>
                </div>
              </div>

              <Field label="ID (old_id)">
                <Input
                  value={editing.old_id !== null ? String(editing.old_id) : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = raw === "" ? null : safeNumberOrNull(raw);
                    setEditing({ ...editing, old_id: n });
                  }}
                  placeholder="ID numérico do produto"
                />
              </Field>

              <Field label="Nome">
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Nome do produto"
                />
              </Field>

              <Field label="Categoria">
                <Select
                  value={String(editing.category ?? "8")}
                  onValueChange={(v) => setEditing({ ...editing, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Preço do produto (R$)">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editing.employee_price_input ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      employee_price_input: e.target.value,
                    })
                  }
                  placeholder="Ex.: 48,50"
                />
              </Field>

              <Field label="Tipo de venda">
                <Select
                  value={editing.saleType}
                  onValueChange={(value: Product["saleType"]) =>
                    setEditing({ ...editing, saleType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Por kg</SelectItem>
                    <SelectItem value="pct">Pacote</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Descrição" full>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                />
              </Field>

              <Field label="Package info">
                <Input
                  value={editing.packageInfo ?? ""}
                  onChange={(e) => setEditing({ ...editing, packageInfo: e.target.value })}
                  placeholder="Ex.: Pacote 1kg, Pote 200g..."
                />
              </Field>

              <Field label="Peso (kg)">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editing.weight_input ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      weight_input: e.target.value,
                    })
                  }
                  placeholder="Ex.: 3,5 ou 3.5"
                />
              </Field>

              {/* Dropzone + preview + edição manual */}
              <Field label="Imagens do produto" full>
                <div className="space-y-2">
                  <div
                    onDrop={handleImageDrop}
                    onDragOver={handleImageDragOver}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center cursor-pointer hover:bg-muted/40"
                    onClick={() => {
                      const input = document.getElementById(
                        "product-image-input"
                      ) as HTMLInputElement | null;
                      input?.click();
                    }}
                  >
                    <input
                      id="product-image-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />

                    <span className="text-sm font-medium">
                      Arraste uma imagem aqui ou clique para selecionar
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Formatos comuns (JPG, PNG). A primeira será usada como principal.
                    </span>

                    {uploadingImage && (
                      <span className="text-xs text-blue-500">Enviando imagem...</span>
                    )}
                    {uploadError && (
                      <span className="text-xs text-red-500">{uploadError}</span>
                    )}
                  </div>

                  {editing.images && editing.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editing.images.map((img, index) => (
                        <div
                          key={img + index}
                          className="relative w-16 h-16 rounded-md overflow-hidden border"
                        >
                          <img
                            src={img}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                            }}
                          />
                          {index === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white text-center">
                              Principal
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Input
                    value={editing.images?.join(", ") ?? ""}
                    onChange={(e) => {
                      const imgs = e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);

                      setEditing({
                        ...editing,
                        images: imgs,
                        image_path: editing.image_path ?? imgs[0] ?? null,
                      });
                    }}
                    placeholder={`https://.../storage/v1/object/public/${STORAGE_BUCKET}/<uuid>/arquivo.jpg, https://...`}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2 sm:col-span-2">
                <Flag
                  label="Conta no mínimo"
                  checked={!!editing.isPackage}
                  onCheckedChange={(v) => setEditing({ ...editing, isPackage: v })}
                />
                <Flag
                  label="Destaque"
                  checked={!!editing.featured}
                  onCheckedChange={(v) => setEditing({ ...editing, featured: v })}
                />
                <Flag
                  label="Em estoque"
                  checked={editing.inStock !== false}
                  onCheckedChange={(v) => setEditing({ ...editing, inStock: v })}
                />
                <Flag
                  label="Visível no catálogo"
                  checked={!isCatalogHidden(editing)}
                  onCheckedChange={(v) =>
                    setEditing({
                      ...editing,
                      extraInfo: setCatalogHidden(editing.extraInfo, !v),
                    })
                  }
                />
                <Flag
                  label="Lançamento"
                  checked={!!editing.isLaunch}
                  onCheckedChange={(v) => setEditing({ ...editing, isLaunch: v })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeForm} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={onSubmitForm} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground">
            {toDelete?.name} (ID: {toDelete?.old_id ?? toDelete?.id})
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={doDelete}
              disabled={deleting}
            >
              {deleting ? "Excluindo..." : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showScroll && (
        <Button
          onClick={scrollTop}
          className="fixed bottom-4 right-4 p-3 rounded-full shadow-lg z-50"
          aria-label="Voltar ao Topo"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </Button>
      )}
    </div>
  );
}

// ------------- Componentes auxiliares -------------

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2 space-y-1" : "space-y-1"}>
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Flag({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

// ✅ CORREÇÃO PRINCIPAL: gerar UUID válido (compatível com coluna uuid do Postgres)
function generateId() {
  return crypto.randomUUID();
}
