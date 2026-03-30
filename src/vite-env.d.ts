/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ADMIN_PHONES?: string;
  readonly VITE_ALLOW_CLIENT_SIDE_ORDER_WRITE?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
