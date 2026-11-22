
import { useNavigate } from "react-router-dom";

import {
  ShieldCheck,
  Warehouse,
  Menu,
  X,
  LogOut,
} from "lucide-react";

import { useUser } from "../../context/UserContext";

function Header({ onMenuClick, menuAbierto }) {
  const {
    usuario,
    esAdministrador,
    logout,
  } = useUser();

  const navigate = useNavigate();

  function cerrarSesion() {
    logout();
    navigate("/login", { replace: true });
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
        {menuAbierto
          ? <X size={23} />
          : <Menu size={23} />
        }
      </button>

      {/* TÍTULO */}
      <div className="header-title">
        <span>Sistema de Control</span>
        <strong>Gestión de Almacén</strong>
      </div>

      {/* INFORMACIÓN DEL USUARIO */}
      <div className="profile-selector">

        <div className="profile-button">

          <div className="profile-avatar">
            {esAdministrador
              ? <ShieldCheck size={20} />
              : <Warehouse size={20} />
            }
          </div>

          <div className="profile-current-info">
            <strong>
              {usuario?.nombre || "Usuario"}
            </strong>

            <span>
              {esAdministrador
                ? "Administrador"
                : "Personal de Motores"
              }
            </span>
          </div>

        </div>

        {/* CERRAR SESIÓN */}
        <button
          type="button"
          className="header-logout"
          onClick={cerrarSesion}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={19} />
          <span>Salir</span>
        </button>

      </div>

    </header>
  );
}

export default Header;
