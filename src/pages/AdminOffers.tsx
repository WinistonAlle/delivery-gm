import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import type { Product } from "@/types/products";
import {
  type CrossSellRule,
  type DeliveryComboConfig,
  loadAdminOfferConfig,
  saveAdminOfferConfig,
} from "@/lib/deliveryOffers";
import {
  addAdminPhone,
  getAdminPhones,
  normalizePhone,
  removeAdminPhone,
} from "@/lib/customerAuth";
import { APP_THEMES, type AppThemeKey, applyTheme, getLocalTheme, saveTheme } from "@/lib/appTheme";

const FALLBACK_IMG = "/placeholder.png";
const THEME_SWATCHES: Record<AppThemeKey, [string, string, string]> = {
  default: ["#dc2626", "#f3f6fb", "#334155"],
  junino: ["#f97316", "#facc15", "#ea580c"],
  natal: ["#059669", "#dc2626", "#ecfdf5"],
  aniversario: ["#4f46e5", "#a855f7", "#f59e0b"],
  blackfriday: ["#000000", "#27272a", "#f59e0b"],
  pascoa: ["#ec4899", "#a78bfa", "#fbcfe8"],
  anonovo: ["#f59e0b", "#1e293b", "#fef3c7"],
  copa: ["#16a34a", "#facc15", "#2563eb"],
};

function createCombo(): DeliveryComboConfig {
  return {
    id: crypto.randomUUID(),
    title: "Novo combo",
    description: "",
    badge: "Combo",
    is_active: true,
    sort_order: Date.now(),
    items: [],
  };
}

function createCrossSellRule(): CrossSellRule {
  return {
    id: crypto.randomUUID(),
    source_product_id: "",
    target_product_id: "",
    priority: 1,
    is_active: true,
  };
}

export default function AdminOffers() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<DeliveryComboConfig[]>([]);
  const [cartRecommendationIds, setCartRecommendationIds] = useState<string[]>([]);
  const [checkoutRecommendationIds, setCheckoutRecommendationIds] = useState<string[]>([]);
  const [crossSellRules, setCrossSellRules] = useState<CrossSellRule[]>([]);
  const [adminPhones, setAdminPhones] = useState<string[]>([]);
  const [newAdminPhone, setNewAdminPhone] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageMode, setStorageMode] = useState<"supabase" | "local">("supabase");
  const [selectedTheme, setSelectedTheme] = useState<AppThemeKey>(getLocalTheme());

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const config = await loadAdminOfferConfig();
        if (!mounted) return;
        setProducts(config.products ?? []);
        setCombos(config.combos ?? []);
        setCartRecommendationIds(config.cartRecommendationIds ?? []);
        setCheckoutRecommendationIds(config.checkoutRecommendationIds ?? []);
        setCrossSellRules(config.crossSellRules ?? []);
        setStorageMode(config.mode);
        setAdminPhones(getAdminPhones());
      } catch {
        if (!mounted) return;
        toast.error("Não foi possível carregar as ofertas");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    applyTheme(selectedTheme);
  }, [selectedTheme]);

  const productsById = useMemo(
    () => new Map(products.map((product) => [String(product.id), product])),
    [products]
  );

  const selectableProducts = useMemo(
    () =>
      [...products]
        .filter((product) => product.inStock !== false)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  const addRecProduct = (placement: "cart" | "checkout", productId: string) => {
    if (!productId) return;
    if (placement === "cart") {
      setCartRecommendationIds((prev) =>
        prev.includes(productId) ? prev : [...prev, productId]
      );
      return;
    }
    setCheckoutRecommendationIds((prev) =>
      prev.includes(productId) ? prev : [...prev, productId]
    );
  };

  const removeRecProduct = (placement: "cart" | "checkout", productId: string) => {
    if (placement === "cart") {
      setCartRecommendationIds((prev) => prev.filter((id) => id !== productId));
      return;
    }
    setCheckoutRecommendationIds((prev) => prev.filter((id) => id !== productId));
  };

  const onSaveAll = async () => {
    setSaving(true);
    try {
      const [offersResult, themeResult] = await Promise.all([
        saveAdminOfferConfig({
          combos,
          cartRecommendationIds,
          checkoutRecommendationIds,
          crossSellRules,
        }),
        saveTheme(selectedTheme),
      ]);
      if (offersResult.mode === "supabase" && themeResult === "supabase") {
        setStorageMode("supabase");
      } else {
        setStorageMode("local");
      }
      toast.success(
        offersResult.mode === "supabase" && themeResult === "supabase"
          ? "Ofertas salvas no Supabase"
          : "Configurações salvas em modo local"
      );
    } catch (err: any) {
      toast.error("Erro ao salvar ofertas", {
        description: err?.message ?? "Tente novamente em instantes.",
      });
    } finally {
      setSaving(false);
    }
  };

  const combosGridClass =
    combos.length <= 1
      ? "grid grid-cols-1 gap-3"
      : "grid grid-cols-1 gap-3 2xl:grid-cols-2";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <p className="text-sm text-slate-600">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffe4e6_0%,#f8fafc_40%,#eef2ff_100%)] p-4 pb-24 md:p-6">
      <div className="mx-auto w-full max-w-[1560px] space-y-4 md:space-y-6">
        <header className="rounded-3xl border border-white/80 bg-white/85 p-4 backdrop-blur-xl shadow-[0_18px_46px_rgba(15,23,42,0.14)] md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl">Admin de Ofertas Delivery</h1>
              <p className="text-xs text-slate-500 md:text-sm max-w-2xl">
                Gerencie combos, sugestões do carrinho, sugestões do checkout e cross-sell.
              </p>
              <p className="mt-1 text-[11px] font-semibold text-red-600">
                Modo de persistência: {storageMode === "supabase" ? "Supabase" : "Local (fallback)"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button variant="outline" onClick={() => navigate("/admin")}>
                Voltar ao Admin
              </Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={onSaveAll} disabled={saving}>
                {saving ? "Salvando..." : "Salvar tudo"}
              </Button>
            </div>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[390px_minmax(0,1fr)] xl:items-start">
          <div className="space-y-4 xl:sticky xl:top-4">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Tema do site</h2>
              </div>
              <Card className="rounded-3xl border-white/80 bg-white/85 backdrop-blur-xl">
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs text-slate-500">
                    O tema escolhido é aplicado no site inteiro (catálogo, carrinho e checkout).
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {APP_THEMES.map((theme) => (
                      <button
                        key={theme.key}
                        type="button"
                        onClick={() => setSelectedTheme(theme.key)}
                        className={`rounded-2xl border p-3 text-left transition ${
                          selectedTheme === theme.key
                            ? "border-red-400 bg-red-50 shadow-sm"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-1.5">
                          {THEME_SWATCHES[theme.key].map((color) => (
                            <span
                              key={`${theme.key}-${color}`}
                              className="h-3 w-3 rounded-full border border-white/70 shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{theme.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{theme.subtitle}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Perfis Admin</h2>
              </div>
              <Card className="rounded-3xl border-white/80 bg-white/85 backdrop-blur-xl">
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs text-slate-500">
                    Telefones com privilégio de admin (menu completo, ofertas, pedidos e configurações).
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={newAdminPhone}
                      onChange={(e) => setNewAdminPhone(e.target.value)}
                      placeholder="Ex: 61999999999"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const phone = normalizePhone(newAdminPhone);
                        if (phone.length < 10) {
                          toast.error("Telefone inválido");
                          return;
                        }
                        addAdminPhone(phone);
                        setAdminPhones(getAdminPhones());
                        setNewAdminPhone("");
                        toast.success("Telefone promovido para admin");
                      }}
                    >
                      Adicionar admin
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {adminPhones.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum telefone admin.</p>
                    ) : null}
                    {adminPhones.map((phone) => (
                      <button
                        key={phone}
                        type="button"
                        onClick={() => {
                          removeAdminPhone(phone);
                          setAdminPhones(getAdminPhones());
                          toast.message("Admin removido");
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                      >
                        {phone}
                        <span className="text-slate-400">x</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid grid-cols-1 gap-3">
              <RecommendationEditor
                title="Recomendados do carrinho"
                ids={cartRecommendationIds}
                productsById={productsById}
                selectableProducts={selectableProducts}
                onAdd={(id) => addRecProduct("cart", id)}
                onRemove={(id) => removeRecProduct("cart", id)}
              />

              <RecommendationEditor
                title="Recomendados do checkout"
                ids={checkoutRecommendationIds}
                productsById={productsById}
                selectableProducts={selectableProducts}
                onAdd={(id) => addRecProduct("checkout", id)}
                onRemove={(id) => removeRecProduct("checkout", id)}
              />
            </section>
          </div>

          <div className="space-y-4 min-w-0">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Combos inteligentes</h2>
                <Button
                  variant="outline"
                  onClick={() => setCombos((prev) => [...prev, createCombo()])}
                >
                  Novo combo
                </Button>
              </div>

              <div className={combosGridClass}>
            {combos.map((combo, comboIndex) => {
              const previewProducts = combo.items
                .map((item) => productsById.get(String(item.product_id)))
                .filter(Boolean) as Product[];

              return (
                <Card key={combo.id} className="rounded-3xl border-white/80 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base md:text-lg">Combo #{comboIndex + 1}</CardTitle>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setCombos((prev) => prev.filter((item) => item.id !== combo.id))}
                      >
                        Remover
                      </Button>
                    </div>

                    <div className="flex -space-x-2">
                      {previewProducts.slice(0, 4).map((product) => (
                        <img
                          key={product.id}
                          src={product.images?.[0] || product.image_path || FALLBACK_IMG}
                          alt={product.name}
                          className="h-10 w-10 rounded-full border-2 border-white object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                          }}
                        />
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-500">Nome</label>
                        <Input
                          value={combo.title}
                          onChange={(e) =>
                            setCombos((prev) =>
                              prev.map((item) =>
                                item.id === combo.id ? { ...item, title: e.target.value } : item
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500">Badge</label>
                        <Input
                          value={combo.badge}
                          onChange={(e) =>
                            setCombos((prev) =>
                              prev.map((item) =>
                                item.id === combo.id ? { ...item, badge: e.target.value } : item
                              )
                            )
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-500">Descrição</label>
                      <Textarea
                        rows={2}
                        value={combo.description}
                        onChange={(e) =>
                          setCombos((prev) =>
                            prev.map((item) =>
                              item.id === combo.id ? { ...item, description: e.target.value } : item
                            )
                          )
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500">Ordem</label>
                        <Input
                          type="number"
                          value={combo.sort_order}
                          onChange={(e) =>
                            setCombos((prev) =>
                              prev.map((item) =>
                                item.id === combo.id
                                  ? { ...item, sort_order: Number(e.target.value || 0) }
                                  : item
                              )
                            )
                          }
                        />
                      </div>
                      <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 md:col-span-2">
                        <span className="text-sm font-medium text-slate-700">Ativo no catálogo</span>
                        <Switch
                          checked={combo.is_active}
                          onCheckedChange={(v) =>
                            setCombos((prev) =>
                              prev.map((item) =>
                                item.id === combo.id ? { ...item, is_active: v } : item
                              )
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Produtos do combo</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setCombos((prev) =>
                              prev.map((item) =>
                                item.id === combo.id
                                  ? {
                                      ...item,
                                      items: [...item.items, { product_id: "", quantity: 1 }],
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          Adicionar item
                        </Button>
                      </div>

                      {combo.items.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhum item no combo.</p>
                      ) : null}

                      {combo.items.map((item, itemIndex) => (
                        <div
                          key={`${combo.id}-${itemIndex}`}
                          className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-2 xl:grid-cols-[minmax(0,1fr)_110px_120px]"
                        >
                          <select
                            className="h-10 w-full min-w-0 rounded-md border px-2 text-sm"
                            value={item.product_id}
                            onChange={(e) =>
                              setCombos((prev) =>
                                prev.map((comboItem) =>
                                  comboItem.id === combo.id
                                    ? {
                                        ...comboItem,
                                        items: comboItem.items.map((it, idx) =>
                                          idx === itemIndex
                                            ? { ...it, product_id: e.target.value }
                                            : it
                                        ),
                                      }
                                    : comboItem
                                )
                              )
                            }
                          >
                            <option value="">Selecione produto</option>
                            {selectableProducts.map((product) => (
                              <option key={product.id} value={String(product.id)}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              setCombos((prev) =>
                                prev.map((comboItem) =>
                                  comboItem.id === combo.id
                                    ? {
                                        ...comboItem,
                                        items: comboItem.items.map((it, idx) =>
                                          idx === itemIndex
                                            ? { ...it, quantity: Math.max(1, Number(e.target.value || 1)) }
                                            : it
                                        ),
                                      }
                                    : comboItem
                                )
                              )
                            }
                          />
                          <Button
                            variant="outline"
                            className="md:w-auto w-full"
                            onClick={() =>
                              setCombos((prev) =>
                                prev.map((comboItem) =>
                                  comboItem.id === combo.id
                                    ? {
                                        ...comboItem,
                                        items: comboItem.items.filter((_, idx) => idx !== itemIndex),
                                      }
                                    : comboItem
                                )
                              )
                            }
                          >
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Cross-sell por produto</h2>
                <Button
                  variant="outline"
                  onClick={() => setCrossSellRules((prev) => [...prev, createCrossSellRule()])}
                >
                  Nova regra
                </Button>
              </div>

              <Card className="rounded-3xl border-white/80 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                <CardContent className="space-y-2 p-3 md:p-4">
                  {crossSellRules.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhuma regra cadastrada.</p>
                  ) : null}

                  {crossSellRules.map((rule, idx) => (
                    <div
                      key={rule.id}
                      className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_90px_110px]"
                    >
                  <select
                    className="h-10 w-full min-w-0 rounded-md border px-2 text-sm"
                    value={rule.source_product_id}
                    onChange={(e) =>
                      setCrossSellRules((prev) =>
                        prev.map((item) =>
                          item.id === rule.id ? { ...item, source_product_id: e.target.value } : item
                        )
                      )
                    }
                  >
                    <option value="">Produto base</option>
                    {selectableProducts.map((product) => (
                      <option key={product.id} value={String(product.id)}>
                        {product.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="h-10 w-full min-w-0 rounded-md border px-2 text-sm"
                    value={rule.target_product_id}
                    onChange={(e) =>
                      setCrossSellRules((prev) =>
                        prev.map((item) =>
                          item.id === rule.id ? { ...item, target_product_id: e.target.value } : item
                        )
                      )
                    }
                  >
                    <option value="">Produto sugerido</option>
                    {selectableProducts.map((product) => (
                      <option key={product.id} value={String(product.id)}>
                        {product.name}
                      </option>
                    ))}
                  </select>

                  <Input
                    type="number"
                    min={1}
                    value={rule.priority}
                    onChange={(e) =>
                      setCrossSellRules((prev) =>
                        prev.map((item) =>
                          item.id === rule.id
                            ? { ...item, priority: Number(e.target.value || idx + 1) }
                            : item
                        )
                      )
                    }
                  />

                  <label className="flex h-10 items-center justify-between rounded-md border border-slate-200 px-2">
                    <span className="text-xs font-medium text-slate-600">Ativo</span>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(v) =>
                        setCrossSellRules((prev) =>
                          prev.map((item) => (item.id === rule.id ? { ...item, is_active: v } : item))
                        )
                      }
                    />
                  </label>

                  <Button
                    variant="outline"
                    className="md:w-auto w-full"
                    onClick={() =>
                      setCrossSellRules((prev) => prev.filter((item) => item.id !== rule.id))
                    }
                  >
                    Remover
                  </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecommendationEditor({
  title,
  ids,
  productsById,
  selectableProducts,
  onAdd,
  onRemove,
}: {
  title: string;
  ids: string[];
  productsById: Map<string, Product>;
  selectableProducts: Product[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [nextId, setNextId] = useState("");

  return (
    <Card className="rounded-3xl border-white/80 bg-white/85 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-base md:text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {ids.length === 0 ? <p className="text-sm text-slate-500">Sem produtos selecionados.</p> : null}
          {ids.map((id) => {
            const product = productsById.get(String(id));
            if (!product) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onRemove(id)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
              >
                <img
                  src={product.images?.[0] || product.image_path || FALLBACK_IMG}
                  alt={product.name}
                  className="h-5 w-5 rounded-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                  }}
                />
                <span className="max-w-[140px] truncate">{product.name}</span>
                <span className="text-slate-400">x</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <select
            className="h-10 w-full min-w-0 rounded-md border px-2 text-sm"
            value={nextId}
            onChange={(e) => setNextId(e.target.value)}
          >
            <option value="">Selecionar produto</option>
            {selectableProducts.map((product) => (
              <option key={product.id} value={String(product.id)}>
                {product.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              if (!nextId) return;
              onAdd(nextId);
              setNextId("");
            }}
          >
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
