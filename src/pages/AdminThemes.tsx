import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Palette, Save } from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";
import {
  APP_THEMES,
  type AppThemeKey,
  applyTheme,
  getLocalTheme,
  saveTheme,
} from "@/lib/appTheme";
import PageLoader from "@/components/PageLoader";

/* ------------------------------------------------------------------
   Theme visual metadata — drives the in-card preview
------------------------------------------------------------------ */
const THEME_META: Record<
  AppThemeKey,
  {
    colors: [string, string, string, string];
    previewBg: string;
    previewCard: string;
    previewBtn: string;
    previewBtnText: string;
    previewTextColor: string;
    icon: string;
    season: string;
    dark?: boolean;
  }
> = {
  default: {
    colors: ["#dc2626", "#ef4444", "#f3f6fb", "#334155"],
    previewBg: "linear-gradient(135deg, #fff1f2 0%, #f3f6fb 100%)",
    previewCard: "rgba(255,255,255,0.92)",
    previewBtn: "#dc2626",
    previewBtnText: "#ffffff",
    previewTextColor: "#1e293b",
    icon: "🛍️",
    season: "Padrão",
  },
  junino: {
    colors: ["#c2410c", "#ea580c", "#facc15", "#f97316"],
    previewBg: "linear-gradient(135deg, #fff9f0 0%, #fff4e0 100%)",
    previewCard: "rgba(255,255,255,0.90)",
    previewBtn: "#c2410c",
    previewBtnText: "#ffffff",
    previewTextColor: "#431407",
    icon: "🪔",
    season: "Junho",
  },
  natal: {
    colors: ["#1B4D3E", "#2d6a4f", "#9b2335", "#c9a84c"],
    previewBg: "linear-gradient(135deg, #f0f7f4 0%, #fefcf5 100%)",
    previewCard: "rgba(255,255,255,0.92)",
    previewBtn: "#1B4D3E",
    previewBtnText: "#ffffff",
    previewTextColor: "#1B4D3E",
    icon: "🎄",
    season: "Dezembro",
  },
  blackfriday: {
    colors: ["#0d0d10", "#27272a", "#f59e0b", "#d97706"],
    previewBg: "linear-gradient(135deg, #0d0d10 0%, #18181b 100%)",
    previewCard: "rgba(30,30,36,0.95)",
    previewBtn: "#f59e0b",
    previewBtnText: "#0d0d10",
    previewTextColor: "#f8fafc",
    icon: "⚡",
    season: "Novembro",
    dark: true,
  },
  pascoa: {
    colors: ["#9333ea", "#a855f7", "#ec4899", "#fde68a"],
    previewBg: "linear-gradient(135deg, #fdf4ff 0%, #fce7f3 100%)",
    previewCard: "rgba(255,255,255,0.92)",
    previewBtn: "#7e22ce",
    previewBtnText: "#ffffff",
    previewTextColor: "#581c87",
    icon: "🌸",
    season: "Abril",
  },
  anonovo: {
    colors: ["#c9971a", "#f7d97b", "#fde68a", "#fffaf0"],
    previewBg: "linear-gradient(135deg, #fffdf7 0%, #fdf5e4 100%)",
    previewCard: "rgba(255,255,255,0.90)",
    previewBtn: "#c9971a",
    previewBtnText: "#ffffff",
    previewTextColor: "#92400e",
    icon: "🎆",
    season: "Janeiro",
  },
  copa: {
    colors: ["#16a34a", "#15803d", "#facc15", "#2563eb"],
    previewBg: "linear-gradient(135deg, #f0fdf4 0%, #fefce8 100%)",
    previewCard: "rgba(255,255,255,0.90)",
    previewBtn: "#16a34a",
    previewBtnText: "#ffffff",
    previewTextColor: "#14532d",
    icon: "⚽",
    season: "Junho",
  },
};

/* ------------------------------------------------------------------
   Utilities
------------------------------------------------------------------ */
async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function buildApiUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

/* ------------------------------------------------------------------
   Component
------------------------------------------------------------------ */
export default function AdminThemes() {
  const navigate = useNavigate();
  const [selectedTheme, setSelectedTheme] = useState<AppThemeKey>(getLocalTheme());
  const [savedTheme, setSavedTheme] = useState<AppThemeKey>(getLocalTheme());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageMode, setStorageMode] = useState<"supabase" | "local">("supabase");

  const hasChanges = selectedTheme !== savedTheme;

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const response = await fetch(buildApiUrl("/api/admin-theme"), {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });

        const payload = await readJson<{ theme?: AppThemeKey; error?: string }>(response);
        if (!response.ok) throw new Error(payload.error || "Erro ao carregar tema.");

        const theme = payload.theme ?? getLocalTheme();
        if (!mounted) return;
        setSelectedTheme(theme);
        setSavedTheme(theme);
        applyTheme(theme);
        setStorageMode("supabase");
      } catch {
        if (!mounted) return;
        const local = getLocalTheme();
        setSelectedTheme(local);
        setSavedTheme(local);
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
      setSavedTheme(selectedTheme);
      toast.success(
        result === "supabase"
          ? "Tema publicado para todos os usuários"
          : "Tema salvo localmente"
      );
    } catch (error: unknown) {
      toast.error("Não foi possível salvar o tema", {
        description:
          error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="Carregando tema..." />;

  const selectedMeta = THEME_META[selectedTheme];
  const selectedLabel = APP_THEMES.find((t) => t.key === selectedTheme)?.label ?? "";

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* ── Sticky header ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: "1px solid #e2e8f0",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "0 24px",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          {/* Back link */}
          <button
            type="button"
            onClick={() => navigate("/catalogo")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#64748b",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.color = "#0f172a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#64748b";
            }}
          >
            <ArrowLeft size={15} />
            Voltar ao catálogo
          </button>

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {storageMode === "local" && (
              <span
                style={{
                  borderRadius: 999,
                  padding: "3px 10px",
                  background: "#fef3c7",
                  color: "#92400e",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                Modo offline
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 16px",
                borderRadius: 8,
                border: "none",
                background: hasChanges && !saving ? "#0f172a" : "#94a3b8",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: hasChanges && !saving ? "pointer" : "not-allowed",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (hasChanges && !saving) e.currentTarget.style.background = "#1e293b";
              }}
              onMouseLeave={(e) => {
                if (hasChanges && !saving) e.currentTarget.style.background = "#0f172a";
              }}
            >
              {saving ? (
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Save size={14} />
              )}
              {saving ? "Publicando…" : "Publicar tema"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Page body ── */}
      <main
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "40px 24px 80px",
        }}
      >
        {/* Page title */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
              color: "#94a3b8",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            <Palette size={13} />
            Aparência
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            Temas do site
          </h1>
          <p
            style={{
              marginTop: 6,
              fontSize: 14,
              color: "#64748b",
              lineHeight: 1.6,
            }}
          >
            Escolha o tema visual aplicado ao catálogo, carrinho e checkout.
            A mudança é aplicada para todos os usuários ao publicar.
          </p>
        </div>

        {/* ── Theme grid ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {APP_THEMES.map((theme) => {
            const meta = THEME_META[theme.key];
            const isSelected = selectedTheme === theme.key;
            const isSaved = savedTheme === theme.key;

            return (
              <button
                key={theme.key}
                type="button"
                onClick={() => setSelectedTheme(theme.key)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  textAlign: "left",
                  borderRadius: 16,
                  border: isSelected ? "2px solid #0f172a" : "1.5px solid #e2e8f0",
                  background: "#ffffff",
                  overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: isSelected
                    ? "0 0 0 3px rgba(15,23,42,0.08), 0 8px 24px rgba(15,23,42,0.10)"
                    : "0 1px 4px rgba(15,23,42,0.06)",
                  transition: "box-shadow 0.18s, border-color 0.18s, transform 0.12s",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.boxShadow =
                      "0 4px 16px rgba(15,23,42,0.10)";
                    e.currentTarget.style.borderColor = "#94a3b8";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.boxShadow = "0 1px 4px rgba(15,23,42,0.06)";
                    e.currentTarget.style.borderColor = "#e2e8f0";
                  }
                }}
              >
                {/* ── Color palette strip ── */}
                <div style={{ display: "flex", height: 6, width: "100%", flexShrink: 0 }}>
                  {meta.colors.map((color, i) => (
                    <span key={i} style={{ flex: 1, background: color }} />
                  ))}
                </div>

                {/* ── Mini theme preview ── */}
                <div
                  style={{
                    position: "relative",
                    height: 96,
                    flexShrink: 0,
                    background: meta.previewBg,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    padding: "0 16px 14px",
                    overflow: "hidden",
                  }}
                >
                  {/* Mock product card */}
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: meta.previewCard,
                      border: "1px solid rgba(0,0,0,0.07)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                    }}
                  >
                    <div
                      style={{
                        height: 6,
                        width: 52,
                        borderRadius: 99,
                        background: `${meta.previewTextColor}28`,
                      }}
                    />
                    <div
                      style={{
                        height: 4,
                        width: 36,
                        borderRadius: 99,
                        background: `${meta.previewTextColor}16`,
                      }}
                    />
                    <div
                      style={{
                        height: 4,
                        width: 44,
                        borderRadius: 99,
                        background: `${meta.previewTextColor}16`,
                      }}
                    />
                  </div>

                  {/* Mock CTA button */}
                  <div
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      background: meta.previewBtn,
                      color: meta.previewBtnText,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.03em",
                      boxShadow: `0 4px 14px ${meta.previewBtn}55`,
                    }}
                  >
                    Pedir
                  </div>

                  {/* Selected checkmark on preview area */}
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 12,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: "#0f172a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                      }}
                    >
                      <Check size={12} color="#ffffff" strokeWidth={3} />
                    </div>
                  )}
                </div>

                {/* ── Info section ── */}
                <div
                  style={{
                    padding: "14px 16px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {/* Name row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>{meta.icon}</span>
                      <span
                        style={{ fontSize: 14, fontWeight: 650, color: "#0f172a", lineHeight: 1 }}
                      >
                        {theme.label}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#94a3b8",
                        background: "#f1f5f9",
                        borderRadius: 999,
                        padding: "2px 8px",
                        letterSpacing: "0.02em",
                        flexShrink: 0,
                      }}
                    >
                      {meta.season}
                    </span>
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "#64748b",
                      lineHeight: 1.55,
                    }}
                  >
                    {theme.subtitle}
                  </p>

                  {/* Status badges */}
                  <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                    {isSaved && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          borderRadius: 999,
                          padding: "3px 9px",
                          background: "#0f172a",
                          color: "#ffffff",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                        }}
                      >
                        <Check size={9} strokeWidth={3} />
                        Publicado
                      </span>
                    )}
                    {isSelected && !isSaved && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: 999,
                          padding: "3px 9px",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          border: "1px solid #bfdbfe",
                        }}
                      >
                        Selecionado
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Bottom change hint ── */}
        {hasChanges && (
          <div
            style={{
              marginTop: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "14px 20px",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
              Tema{" "}
              <strong style={{ color: "#0f172a", fontWeight: 700 }}>
                {selectedLabel}
              </strong>{" "}
              selecionado — clique em{" "}
              <em style={{ fontStyle: "normal", color: "#0f172a", fontWeight: 600 }}>
                Publicar tema
              </em>{" "}
              para aplicar.
            </p>

            {/* Live preview pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 999,
                background: selectedMeta.previewBtn,
                color: selectedMeta.previewBtnText,
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: `0 4px 12px ${selectedMeta.previewBtn}44`,
              }}
            >
              <span style={{ fontSize: 14 }}>{selectedMeta.icon}</span>
              {selectedLabel}
            </div>
          </div>
        )}
      </main>

      {/* Spin keyframe for loader */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
