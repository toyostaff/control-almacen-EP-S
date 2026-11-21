
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  ChevronDown,
  ShieldCheck,
  Warehouse,
  Menu,
  X,
} from "lucide-react";

import { PERFILES, useUser } from "../../context/UserContext";

function Header({ onMenuClick, menuAbierto }) {
  const { perfil, cambiarPerfil, esAdministrador } = useUser();

  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false);

  const selectorRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Cerrar el selector de perfiles al hacer clic fuera
  useEffect(() => {
    function cerrarAlHacerClickFuera(event) {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(event.target)
      ) {
        setMenuPerfilAbierto(false);
      }
    }

    document.addEventListener("mousedown", cerrarAlHacerClickFuera);

    return () => {
      document.removeEventListener(
        "mousedown",
        cerrarAlHacerClickFuera
      );
    };
  }, []);

  // Cambiar perfil simulado
  function seleccionarPerfil(nuevoPerfil) {
    cambiarPerfil(nuevoPerfil);

    setMenuPerfilAbierto(false);

    if (
      nuevoPerfil === PERFILES.ALMACEN &&
      location.pathname.startsWith("/catalogo")
    ) {
      navigate("/", { replace: true });
    }
  }

  return (
    <header className="header">

      {/* BOTÓN MENÚ MÓVIL */}
      <button
        type="button"
        className="mobile-menu-button"
        onClick={onMenuClick}
        aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={menuAbierto}
      >
        {menuAbierto ? <X size={23} /> : <Menu size={23} />}
      </button>

      {/* TÍTULO DEL SISTEMA */}
      <div className="header-title">
        <span>Sistema de Control</span>
        <strong>Gestión de Almacén</strong>
      </div>

      {/* SELECTOR DE PERFIL */}
      <div
        className="profile-selector"
        ref={selectorRef}
      >
        <button
          type="button"
          className="profile-button"
          onClick={() =>
            setMenuPerfilAbierto((actual) => !actual)
          }
          aria-expanded={menuPerfilAbierto}
        >
          {/* ICONO */}
          <div className="profile-avatar">
            {esAdministrador ? (
              <ShieldCheck size={20} />
            ) : (
              <Warehouse size={20} />
            )}
          </div>

          {/* INFORMACIÓN */}
          <div className="profile-current-info">
            <strong>
              {esAdministrador
                ? "Administrador"
                : "Personal de almacén"}
            </strong>

            <span>
              {esAdministrador
                ? "Gestión completa"
                : "Operación de inventario"}
            </span>
          </div>

          {/* FLECHA */}
          <ChevronDown
            size={17}
            className={
              menuPerfilAbierto
                ? "profile-chevron open"
                : "profile-chevron"
            }
          />
        </button>

        {/* DESPLEGABLE DE PERFILES */}
        {menuPerfilAbierto && (
          <div className="profile-dropdown">

            <div className="profile-dropdown-header">
              <span>Cambiar vista</span>
              <small>Modo demostración</small>
            </div>

            {/* ADMINISTRADOR */}
            <button
              type="button"
              className={`profile-dropdown-option ${
                perfil === PERFILES.ADMIN ? "active" : ""
              }`}
              onClick={() =>
                seleccionarPerfil(PERFILES.ADMIN)
              }
            >
              <div className="profile-option-icon">
                <ShieldCheck size={19} />
              </div>

              <div>
                <strong>Administrador</strong>
                <span>
                  Acceso al Catálogo Maestro y operación
                </span>
              </div>

              {perfil === PERFILES.ADMIN && (
                <span className="profile-selected-dot" />
              )}
            </button>

            {/* PERSONAL DE ALMACÉN */}
            <button
              type="button"
              className={`profile-dropdown-option ${
                perfil === PERFILES.ALMACEN ? "active" : ""
              }`}
              onClick={() =>
                seleccionarPerfil(PERFILES.ALMACEN)
              }
            >
              <div className="profile-option-icon">
                <Warehouse size={19} />
              </div>

              <div>
                <strong>Personal de almacén</strong>
                <span>
                  Inventario, ubicaciones e historial
                </span>
              </div>

              {perfil === PERFILES.ALMACEN && (
                <span className="profile-selected-dot" />
              )}
            </button>

            <div className="profile-dropdown-footer">
              Los perfiles son simulados en esta versión.
            </div>

          </div>
        )}
      </div>

    </header>
  );
}

export default Header;
