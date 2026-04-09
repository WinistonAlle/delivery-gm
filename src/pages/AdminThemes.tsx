import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner-toast";
import { APP_THEMES, type AppThemeKey, applyTheme, getLocalTheme, saveTheme } from "@/lib/appTheme";
import PageLoader from "@/components/PageLoader";

const THEME_SWATCHES: Record<AppThemeKey, [string, string, string]> = {
  default: ["#dc2626", "#f3f6fb", "#334155"],
  junino: ["#f97316", "#facc15", "#ea580c"],
  natal: ["#059669", "#dc2626", "#ecfdf5"],
  blackfriday: ["#000000", "#27272a", "#f59e0b"],
  pascoa: ["#ec4899", "#a78bfa", "#fbcfe8"],
  anonovo: ["#f59e0b", "#1e293b", "#fef3c7"],
  copa: ["#16a34a", "#facc15", "#2563eb"],
};

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function buildApiUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export default function AdminThemes() {
  const navigate = useNavigate();
  const [selectedTheme, setSelectedTheme] = useState<AppThemeKey>(getLocalTheme());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageMode, setStorageMode] = useState<"supabase" | "local">("supabase");

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const response = await fetch(buildApiUrl("/api/admin-theme"), {
          method: "GET",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        });

        const payload = await readJson<{ theme?: AppThemeKey; error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload.error || "Não foi possível carregar o tema.");
        }

        const theme = payload.theme ?? getLocalTheme();
        if (!mounted) return;
        setSelectedTheme(theme);
        applyTheme(theme);
        setStorageMode("supabase");
      } catch {
        if (!mounted) return;
        setSelectedTheme(getLocalTheme());
        setStorageMode("local");
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveTheme(selectedTheme);
      setStorageMode(result);
      toast.success(
        result === "supabase" ? "Tema salvo no Supabase" : "Tema salvo apenas localmente"
      );
    } catch (error: unknown) {
      toast.error("Não foi possível salvar o tema", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoader label="Carregando tema..." />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffe4e6_0%,#f8fafc_40%,#eef2ff_100%)] p-4 pb-24 md:p-6">
      <div className="mx-auto w-full max-w-[1180px] space-y-4 md:space-y-6">
        <header className="rounded-3xl border border-white/80 bg-white/85 p-4 backdrop-blur-xl shadow-[0_18px_46px_rgba(15,23,42,0.14)] md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl">Temas do Site</h1>
              <p className="text-xs text-slate-500 md:text-sm max-w-2xl">
                Escolha o visual global do catálogo, carrinho e checkout.
              </p>
              <p className="mt-1 text-[11px] font-semibold text-red-600">
                Modo de persistência: {storageMode === "supabase" ? "Supabase" : "Local (fallback)"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button variant="outline" onClick={() => navigate("/catalogo")}>
                Voltar ao Catálogo
              </Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar tema"}
              </Button>
            </div>
          </div>
        </header>

        <Card className="rounded-3xl border-white/80 bg-white/85 backdrop-blur-xl">
          <CardContent className="space-y-4 p-4 md:p-6">
            <p className="text-sm text-slate-500">
              O tema selecionado é aplicado para todos os usuários quando salvo no Supabase.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {APP_THEMES.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => setSelectedTheme(theme.key)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedTheme === theme.key
                      ? "border-red-400 bg-red-50 shadow-sm"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="mb-3 flex items-center gap-1.5">
                    {THEME_SWATCHES[theme.key].map((color) => (
                      <span
                        key={`${theme.key}-${color}`}
                        className="h-3.5 w-3.5 rounded-full border border-white/70 shadow-sm"
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
      </div>
    </div>
  );
}
