import { supabase } from "@/lib/supabase";

export type AppThemeKey =
  | "default"
  | "junino"
  | "natal"
  | "aniversario"
  | "blackfriday"
  | "pascoa"
  | "anonovo"
  | "copa";

export const APP_THEMES: { key: AppThemeKey; label: string; subtitle: string }[] = [
  { key: "default", label: "Padrão", subtitle: "Visual atual do delivery" },
  { key: "junino", label: "Junino", subtitle: "Cores quentes e clima de arraial" },
  { key: "natal", label: "Natal", subtitle: "Verde e vermelho natalino" },
  { key: "aniversario", label: "Aniversário", subtitle: "Tema comemorativo da empresa" },
  { key: "blackfriday", label: "Black Friday", subtitle: "Preto, contraste e energia de oferta" },
  { key: "pascoa", label: "Páscoa", subtitle: "Paleta suave e acolhedora" },
  { key: "anonovo", label: "Ano Novo", subtitle: "Dourado e clima de celebração" },
  { key: "copa", label: "Copa do Mundo", subtitle: "Brasil: verde, amarelo e azul" },
];

const LS_THEME_KEY = "gm_app_theme_v1";

const isThemeKey = (value: string): value is AppThemeKey =>
  APP_THEMES.some((theme) => theme.key === value);

export function getLocalTheme(): AppThemeKey {
  try {
    const raw = localStorage.getItem(LS_THEME_KEY);
    if (raw && isThemeKey(raw)) return raw;
  } catch {
    // ignore localStorage errors
  }
  return "default";
}

export function applyTheme(theme: AppThemeKey) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-app-theme", theme);
}

export async function loadTheme(): Promise<AppThemeKey> {
  try {
    const { data, error } = await supabase
      .from("app_theme_settings")
      .select("theme_key")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    const remote = String(data?.theme_key ?? "");
    if (isThemeKey(remote)) {
      localStorage.setItem(LS_THEME_KEY, remote);
      return remote;
    }
  } catch {
    // fallback local
  }

  return getLocalTheme();
}

export async function saveTheme(theme: AppThemeKey): Promise<"supabase" | "local"> {
  localStorage.setItem(LS_THEME_KEY, theme);
  applyTheme(theme);

  try {
    const { error } = await supabase
      .from("app_theme_settings")
      .upsert(
        {
          id: 1,
          theme_key: theme,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) throw error;
    return "supabase";
  } catch {
    return "local";
  }
}

