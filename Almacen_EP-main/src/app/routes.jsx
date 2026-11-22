
import { createBrowserRouter, Navigate } from "react-router-dom";

import { useUser } from "../context/UserContext";

import MainLayout from "../components/layout/MainLayout";
import LoginPage from "../features/auth/LoginPage";

import DashboardPage from "../features/dashboard/DashboardPage";
import CatalogoPage from "../features/catalogo/CatalogoPage";
import InventarioPage from "../features/inventario/InventarioPage";
import UbicacionesPage from "../features/ubicaciones/UbicacionesPage";
import HistorialPage from "../features/historial/HistorialPage";

// Protección general
function RequireAuth({ children }) {
  const { autenticado } = useUser();

  return autenticado
    ? children
    : <Navigate to="/login" replace />;
}

// Solo administrador
function RequireAdmin({ children }) {
  const { autenticado, esAdministrador } = useUser();

  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }

  return esAdministrador
    ? children
    : <Navigate to="/" replace />;
}

// Pantalla de inicio de sesión
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

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginRoute />,
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "catalogo",
        element: (
          <RequireAdmin>
            <CatalogoPage />
          </RequireAdmin>
        ),
      },
      {
        path: "inventario",
        element: <InventarioPage />,
      },
      {
        path: "ubicaciones",
        element: <UbicacionesPage />,
      },
      {
        path: "historial",
        element: <HistorialPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
