// src/App.tsx
import { useEffect } from "react";
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
import Avisos from "./pages/Avisos";
import Checkout from "./pages/Checkout";
import MyOrdersPage from "./pages/MyOrdersPage";
import NotFound from "./pages/NotFound";

// ✅ Favoritos
import FavoritesPage from "./pages/Favorites";

// ✅ Destaques (Admin)
import Destaques from "./pages/Destaques";

// Admin / RH / Relatórios / Separação
import Admin from "./pages/Admin";
import AdminOffers from "./pages/AdminOffers";
import RhHome from "./pages/rh/RhHome";
import EmployeesPage from "./pages/rh/EmployeesPage";
import RHSpendingReport from "./pages/rh/RHSpendingReport";
import ReportsDashboard from "./pages/ReportsDashboard";
import SeparationBoard from "./pages/SeparationBoard";
import DeliveryOps from "./pages/DeliveryOps";

// ✅ NOVO: AdminOrders
import AdminOrders from "./pages/AdminOrders"; 
import { applyTheme, getLocalTheme, loadTheme } from "./lib/appTheme";
import { trackCustomerEventOnce } from "./lib/customerInsights";
// Se o seu arquivo estiver em: src/pages/admin/AdminOrders.tsx, use:
// import AdminOrders from "./pages/admin/AdminOrders";

const queryClient = new QueryClient();

type EmployeeRole = "admin" | "rh" | "separacao" | string;

type EmployeeSession = {
  id: string;
  full_name: string;
  cpf: string;
  role: EmployeeRole;
};

function getEmployeeSession(): EmployeeSession | null {
  try {
    const raw = localStorage.getItem("employee_session");
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    if (!parsed.cpf || !parsed.role) return null;

    return parsed as EmployeeSession;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------
   ROUTE GUARDS
-------------------------------------------------------- */

function RequireAuth({ children }: { children: JSX.Element }) {
  const sess = getEmployeeSession();
  if (!sess) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({
  allow,
  redirectTo = "/catalogo",
  children,
}: {
  allow: EmployeeRole[];
  redirectTo?: string;
  children: JSX.Element;
}) {
  const sess = getEmployeeSession();
  if (!sess) return <Navigate to="/login" replace />;

  if (!allow.includes(sess.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

/**
 * Catálogo: se for perfil separação, manda direto pro painel
 */
function CatalogGate({ children }: { children: JSX.Element }) {
  const sess = getEmployeeSession();
  if (!sess) return children;

  if (sess.role === "separacao") {
    return <Navigate to="/painel-separacao" replace />;
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
            <Routes>
              {/* Home */}
              <Route path="/" element={<Navigate to="/catalogo" replace />} />
              <Route path="/entrada" element={<EscolhaUsuario />} />

              {/* Login */}
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Cadastro />} />

              {/* Catálogo */}
              <Route
                path="/catalogo"
                element={
                  <CatalogGate>
                    <Index />
                  </CatalogGate>
                }
              />

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

              {/* Painel de separação (TV) */}
              <Route
                path="/painel-separacao"
                element={
                  <RequireRole allow={["separacao"]} redirectTo="/catalogo">
                    <SeparationBoard />
                  </RequireRole>
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
                  <RequireRole allow={["admin", "rh"]} redirectTo="/catalogo">
                    <DeliveryOps />
                  </RequireRole>
                }
              />

              {/* RH */}
              <Route
                path="/rh"
                element={
                  <RequireRole allow={["rh"]} redirectTo="/catalogo">
                    <RhHome />
                  </RequireRole>
                }
              />

              <Route
                path="/rh/funcionarios"
                element={
                  <RequireRole allow={["rh"]} redirectTo="/catalogo">
                    <EmployeesPage />
                  </RequireRole>
                }
              />

              {/* ✅ Relatório de gastos do RH */}
              <Route
                path="/rh/relatorio-gastos"
                element={
                  <RequireRole allow={["rh"]} redirectTo="/catalogo">
                    <RHSpendingReport />
                  </RequireRole>
                }
              />

              {/* Relatórios (Admin + RH) */}
              <Route
                path="/relatorios"
                element={
                  <RequireRole allow={["admin", "rh"]} redirectTo="/catalogo">
                    <ReportsDashboard />
                  </RequireRole>
                }
              />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
