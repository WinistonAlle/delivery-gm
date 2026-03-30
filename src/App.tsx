// src/App.tsx
import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { CartProvider } from "@/contexts/CartContext";

// Páginas base
import EscolhaUsuario from "./pages/EscolhaUsuario";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { applyTheme, getLocalTheme, loadTheme } from "./lib/appTheme";
import { trackCustomerEventOnce } from "./lib/customerInsights";
import { getCustomerSession } from "./lib/customerAuth";

const Avisos = lazy(() => import("./pages/Avisos"));
const Checkout = lazy(() => import("./pages/Checkout"));
const MyOrdersPage = lazy(() => import("./pages/MyOrdersPage"));
const FavoritesPage = lazy(() => import("./pages/Favorites"));
const Destaques = lazy(() => import("./pages/Destaques"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminOffers = lazy(() => import("./pages/AdminOffers"));
const ReportsDashboard = lazy(() => import("./pages/ReportsDashboard"));
const DeliveryOps = lazy(() => import("./pages/DeliveryOps"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));

const queryClient = new QueryClient();

type AppRole = "admin" | "customer" | string;

type AppSession = {
  id: string;
  full_name: string;
  phone?: string;
  cpf?: string;
  role: AppRole;
};

function getAppSession(): AppSession | null {
  const session = getCustomerSession();
  if (!session || typeof session !== "object") return null;
  if (!session.role) return null;
  if (!session.phone && !session.cpf) return null;
  return session as AppSession;
}

/* --------------------------------------------------------
   ROUTE GUARDS
-------------------------------------------------------- */

function RequireAuth({ children }: { children: JSX.Element }) {
  const sess = getAppSession();
  if (!sess) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({
  allow,
  redirectTo = "/catalogo",
  children,
}: {
  allow: AppRole[];
  redirectTo?: string;
  children: JSX.Element;
}) {
  const sess = getAppSession();
  if (!sess) return <Navigate to="/login" replace />;

  if (!allow.includes(sess.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/" && location.pathname !== "/catalogo") return;
    trackCustomerEventOnce("site_visit", {
      eventName: "site_visit",
      path: location.pathname,
    });
  }, [location.pathname]);

  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
        Carregando...
      </div>
    </div>
  );
}

/* --------------------------------------------------------
   APP
-------------------------------------------------------- */

function App() {
  useEffect(() => {
    applyTheme(getLocalTheme());

    let mounted = true;
    (async () => {
      const theme = await loadTheme();
      if (!mounted) return;
      applyTheme(theme);
    })();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "gm_app_theme_v1") return;
      applyTheme(getLocalTheme());
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <CartProvider>
          <BrowserRouter>
            <RouteTracker />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Home */}
                <Route path="/" element={<Navigate to="/catalogo" replace />} />
                <Route path="/entrada" element={<EscolhaUsuario />} />

                {/* Login */}
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Cadastro />} />

                {/* Catálogo */}
                <Route path="/catalogo" element={<Index />} />

                {/* Favoritos */}
                <Route
                  path="/favoritos"
                  element={
                    <RequireAuth>
                      <FavoritesPage />
                    </RequireAuth>
                  }
                />

                {/* Avisos */}
                <Route
                  path="/avisos"
                  element={
                    <RequireAuth>
                      <Avisos />
                    </RequireAuth>
                  }
                />

                {/* ✅ Destaques (Admin) */}
                <Route
                  path="/destaques"
                  element={
                    <RequireRole allow={["admin"]} redirectTo="/catalogo">
                      <Destaques />
                    </RequireRole>
                  }
                />

                {/* Meus pedidos */}
                <Route
                  path="/meus-pedidos"
                  element={
                    <RequireAuth>
                      <MyOrdersPage />
                    </RequireAuth>
                  }
                />

                {/* Checkout */}
                <Route
                  path="/checkout"
                  element={
                    <RequireAuth>
                      <Checkout />
                    </RequireAuth>
                  }
                />

                {/* Admin */}
                <Route
                  path="/admin"
                  element={
                    <RequireRole allow={["admin"]} redirectTo="/catalogo">
                      <Admin />
                    </RequireRole>
                  }
                />

                <Route
                  path="/admin/ofertas"
                  element={
                    <RequireRole allow={["admin"]} redirectTo="/catalogo">
                      <AdminOffers />
                    </RequireRole>
                  }
                />

                {/* ✅ NOVO: Admin - Pedidos (cancelar/editar + histórico) */}
                <Route
                  path="/admin/pedidos"
                  element={
                    <RequireRole allow={["admin"]} redirectTo="/catalogo">
                      <AdminOrders />
                    </RequireRole>
                  }
                />

                <Route
                  path="/operacao-delivery"
                  element={
                    <RequireRole allow={["admin"]} redirectTo="/catalogo">
                      <DeliveryOps />
                    </RequireRole>
                  }
                />

                {/* Relatórios (Admin + RH) */}
                <Route
                  path="/relatorios"
                  element={
                    <RequireRole allow={["admin"]} redirectTo="/catalogo">
                      <ReportsDashboard />
                    </RequireRole>
                  }
                />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
