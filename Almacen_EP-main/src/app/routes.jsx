
import { createBrowserRouter, Navigate } from "react-router-dom";

import { useUser } from "../context/UserContext";

import MainLayout from "../components/layout/MainLayout";
import LoginPage from "../features/auth/LoginPage";

import DashboardPage from "../features/dashboard/DashboardPage";
import CatalogoPage from "../features/catalogo/CatalogoPage";
import InventarioPage from "../features/inventario/InventarioPage";
import UbicacionesPage from "../features/ubicaciones/UbicacionesPage";
import HistorialPage from "../features/historial/HistorialPage";

// =============================================
// PROTECCIÓN GENERAL DE RUTAS
// =============================================

function RequireAuth({ children }) {
  const { autenticado } = useUser();

  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// =============================================
// PROTECCIÓN EXCLUSIVA PARA ADMINISTRADOR
// =============================================

function RequireAdmin({ children }) {
  const { autenticado, esAdministrador } = useUser();

  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }

  if (!esAdministrador) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// =============================================
// RUTA DE INICIO DE SESIÓN
// =============================================

function LoginRoute() {
  const { autenticado, login } = useUser();

  if (autenticado) {
    return <Navigate to="/" replace />;
  }

  return (
    <LoginPage
      onLogin={(usuario, password) =>
        login(usuario, password)
      }
    />
  );
}

// =============================================
// CONFIGURACIÓN PRINCIPAL DEL ROUTER
// =============================================

export const router = createBrowserRouter([
  // LOGIN
  {
    path: "/login",
    element: <LoginRoute />,
  },

  // SISTEMA PROTEGIDO
  {
    path: "/",
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),

    children: [
      // DASHBOARD
      {
        index: true,
        element: <DashboardPage />,
      },

      // CATÁLOGO MAESTRO: SOLO ADMINISTRADOR
      {
        path: "catalogo",
        element: (
          <RequireAdmin>
            <CatalogoPage />
          </RequireAdmin>
        ),
      },

      // INVENTARIO
      {
        path: "inventario",
        element: <InventarioPage />,
      },

      // UBICACIONES
      {
        path: "ubicaciones",
        element: <UbicacionesPage />,
      },

      // HISTORIAL
      {
        path: "historial",
        element: <HistorialPage />,
      },
    ],
  },

  // RUTAS NO ENCONTRADAS
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
