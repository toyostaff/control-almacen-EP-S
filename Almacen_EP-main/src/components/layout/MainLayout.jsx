
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";

function MainLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  const location = useLocation();

  // =========================================
  // CERRAR MENÚ AL CAMBIAR DE PANTALLA
  // =========================================

  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  // =========================================
  // CERRAR MENÚ CON ESCAPE
  // =========================================

  useEffect(() => {
    function manejarTecla(event) {
      if (event.key === "Escape") {
        setMenuAbierto(false);
      }
    }

    document.addEventListener("keydown", manejarTecla);

    return () => {
      document.removeEventListener("keydown", manejarTecla);
    };
  }, []);

  // =========================================
  // CONTROLAR DESPLAZAMIENTO DEL FONDO
  // =========================================

  useEffect(() => {
    if (menuAbierto) {
      document.body.classList.add("mobile-menu-open");
    } else {
      document.body.classList.remove("mobile-menu-open");
    }

    return () => {
      document.body.classList.remove("mobile-menu-open");
    };
  }, [menuAbierto]);

  // =========================================
  // CERRAR MENÚ AL CAMBIAR DE PESTAÑA
  // =========================================

  useEffect(() => {
    function manejarVisibilidad() {
      if (document.hidden) {
        setMenuAbierto(false);
      }
    }

    document.addEventListener(
      "visibilitychange",
      manejarVisibilidad
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        manejarVisibilidad
      );
    };
  }, []);

  // =========================================
  // INTERFAZ PRINCIPAL
  // =========================================

  return (
    <div className="app-shell">

      {/* FONDO OSCURO DEL MENÚ MÓVIL */}

      {menuAbierto && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* MENÚ LATERAL */}

      <Sidebar
        abierto={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
      />

      {/* CONTENIDO PRINCIPAL */}

      <div className="app-main">

        <Header
          onMenuClick={() =>
            setMenuAbierto((actual) => !actual)
          }
          menuAbierto={menuAbierto}
        />

        <main className="page-content">
          <Outlet />
        </main>

      </div>

    </div>
  );
}

export default MainLayout;
