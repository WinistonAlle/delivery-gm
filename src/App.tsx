// src/App.tsx
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import styled, { keyframes } from "styled-components";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { CartProvider } from "@/contexts/CartContext";

import { applyTheme, getLocalTheme, loadTheme } from "./lib/appTheme";
import { trackCustomerEventOnce } from "./lib/customerInsights";
import { getCustomerSession, syncCustomerSessionFromServer } from "./lib/customerAuth";

const EscolhaUsuario = lazy(() => import("./pages/EscolhaUsuario"));
const Login = lazy(() => import("./pages/Login"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Avisos = lazy(() => import("./pages/Avisos"));
const Checkout = lazy(() => import("./pages/Checkout"));
const MyOrdersPage = lazy(() => import("./pages/MyOrdersPage"));
const FavoritesPage = lazy(() => import("./pages/Favorites"));
const Destaques = lazy(() => import("./pages/Destaques"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminOffers = lazy(() => import("./pages/AdminOffers"));
const AdminThemes = lazy(() => import("./pages/AdminThemes"));
const ReportsDashboard = lazy(() => import("./pages/ReportsDashboard"));
const DeliveryOps = lazy(() => import("./pages/DeliveryOps"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const PreparationGuides = lazy(() => import("./pages/PreparationGuides"));
const AdminCoupons = lazy(() => import("./pages/AdminCoupons"));
import { COUPONS_ENABLED } from "@/lib/featureFlags";

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

const shimmer = keyframes`
  0%, 70% {
    box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.18);
    transform: scale(0);
  }
  100% {
    box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.28);
    transform: scale(1);
  }
`;

const shimmerMid = keyframes`
  0%, 40% {
    box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.18);
    transform: scale(0);
  }
  100% {
    box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.28);
    transform: scale(1);
  }
`;

const shimmerBase = keyframes`
  0%, 10% {
    box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.18);
    transform: scale(0);
  }
  100% {
    box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.28);
    transform: scale(1);
  }
`;

const LoadingShell = styled.div`
  min-height: 100vh;
  background: radial-gradient(circle at top left, #f8d7da 0%, #fdf2f2 42%, #ffffff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Frame = styled.div`
  position: relative;
  width: 220px;
  height: 220px;
`;

const Dot = styled.div<{ $size: number; $top: number; $left: number; $bg: string; $z: number; $anim: ReturnType<typeof keyframes>; }>`
  position: absolute;
  z-index: ${({ $z }) => $z};
  width: ${({ $size }) => `${$size}px`};
  height: ${({ $size }) => `${$size}px`};
  top: ${({ $top }) => `${$top}px`};
  left: ${({ $left }) => `${$left}px`};
  background: ${({ $bg }) => $bg};
  border-radius: 999px;
  animation: ${({ $anim }) => $anim} 2s cubic-bezier(0.21, 0.98, 0.6, 0.99)
    infinite alternate;
`;

const LoadingText = styled.div`
  position: absolute;
  bottom: -36px;
  width: 100%;
  text-align: center;
  color: #7d1717;
  font-size: 0.95rem;
  font-weight: 700;
`;

function RouteFallback() {
  return (
    <LoadingShell>
      <Frame aria-label="Carregando aplicativo">
        <Dot $size={90} $top={65} $left={65} $bg="#d33100" $z={1} $anim={shimmerBase} />
        <Dot $size={60} $top={80} $left={80} $bg="#f0be00" $z={2} $anim={shimmerMid} />
        <Dot $size={30} $top={95} $left={95} $bg="#ffffff" $z={3} $anim={shimmer} />
        <LoadingText>Carregando...</LoadingText>
      </Frame>
    </LoadingShell>
  );
}

/* --------------------------------------------------------
   APP
-------------------------------------------------------- */

function App() {
  const [authReady, setAuthReady] = useState(false);

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

  useEffect(() => {
    let mounted = true;

    (async () => {
      await syncCustomerSessionFromServer();
      if (mounted) setAuthReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!authReady) {
    return <RouteFallback />;
  }

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

                <Route
                  path="/modos-de-preparo"
                  element={
                    <RequireAuth>
                      <PreparationGuides />
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

                <Route
                  path="/admin/temas"
                  element={
                    <RequireRole allow={["admin"]} redirectTo="/catalogo">
                      <AdminThemes />
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

                {COUPONS_ENABLED && (
                  <Route
                    path="/admin/cupons"
                    element={
                      <RequireRole allow={["admin"]} redirectTo="/catalogo">
                        <AdminCoupons />
                      </RequireRole>
                    }
                  />
                )}

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
