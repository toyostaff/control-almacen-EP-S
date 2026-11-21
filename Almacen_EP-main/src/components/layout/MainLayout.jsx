
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";

function MainLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const location = useLocation();

  // Cerrar el menú al cambiar de pantalla
  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  // Cerrar el menú con Escape
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

  // Evitar desplazamiento del fondo cuando el menú está abierto
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
          onMenuClick={() => setMenuAbierto((actual) => !actual)}
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
