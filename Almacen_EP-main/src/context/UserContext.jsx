
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import { iniciarSesion } from "../services/authService";

// =============================================
// CONTEXTO DE USUARIO
// =============================================

const UserContext = createContext(null);

// =============================================
// ALMACENAMIENTO DE SESIÓN
// =============================================

const TOKEN_KEY = "almacen_token";
const USER_KEY = "almacen_usuario";

// =============================================
// PERFILES DEL SISTEMA
// =============================================

export const PERFILES = {
  ADMIN: "admin",
  ALMACEN: "almacen",
};

// =============================================
// LEER SESIÓN DESDE LOCALSTORAGE
// =============================================

function obtenerSesionGuardada() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const usuarioGuardado = localStorage.getItem(USER_KEY);

    if (!token || !usuarioGuardado) {
      return {
        token: null,
        usuario: null,
      };
    }

    const usuario = JSON.parse(usuarioGuardado);

    if (
      !usuario ||
      !usuario.id ||
      !Object.values(PERFILES).includes(usuario.rol)
    ) {
      throw new Error("Sesión inválida.");
    }

    return {
      token,
      usuario,
    };

  } catch {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    return {
      token: null,
      usuario: null,
    };
  }
}

// =============================================
// PROVEEDOR DE USUARIO
// =============================================

export function UserProvider({ children }) {

  const [sesion, setSesion] = useState(() =>
    obtenerSesionGuardada()
  );

  const [cargando, setCargando] = useState(false);

  // ===========================================
  // DATOS DEL USUARIO
  // ===========================================

  const usuario = sesion.usuario;
  const token = sesion.token;

  const autenticado = Boolean(token && usuario);

  const perfil = usuario?.rol || null;

  const esAdministrador = perfil === PERFILES.ADMIN;

  // ===========================================
  // SINCRONIZACIÓN ENTRE PESTAÑAS
  // ===========================================

  useEffect(() => {

    function sincronizarSesion(event) {

      // Solo reaccionar a cambios relacionados con la sesión.
      if (
        event.key !== null &&
        event.key !== TOKEN_KEY &&
        event.key !== USER_KEY
      ) {
        return;
      }

      const nuevaSesion = obtenerSesionGuardada();

      setSesion(nuevaSesion);
    }

    window.addEventListener("storage", sincronizarSesion);

    return () => {
      window.removeEventListener("storage", sincronizarSesion);
    };

  }, []);

  // ===========================================
  // INICIAR SESIÓN
  // ===========================================

  const login = useCallback(async (nombreUsuario, password) => {

    setCargando(true);

    try {

      const resultado = await iniciarSesion(
        nombreUsuario,
        password
      );

      const nuevoUsuario = resultado?.usuario;
      const nuevoToken = resultado?.token;

      // Validar respuesta del servidor
      if (!nuevoToken || !nuevoUsuario) {
        throw new Error(
          "El servidor no devolvió una sesión válida."
        );
      }

      if (
        !nuevoUsuario.id ||
        !Object.values(PERFILES).includes(nuevoUsuario.rol)
      ) {
        throw new Error(
          "El perfil recibido no es válido."
        );
      }

      // Guardar sesión compartida
      localStorage.setItem(TOKEN_KEY, nuevoToken);

      localStorage.setItem(
        USER_KEY,
        JSON.stringify(nuevoUsuario)
      );

      // Actualizar inmediatamente esta pestaña
      setSesion({
        token: nuevoToken,
        usuario: nuevoUsuario,
      });

      return nuevoUsuario;

    } catch (error) {

      throw error;

    } finally {

      setCargando(false);

    }

  }, []);

  // ===========================================
  // CERRAR SESIÓN
  // ===========================================

  const logout = useCallback(() => {

    // Eliminar credenciales compartidas
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    // Actualizar inmediatamente esta pestaña
    setSesion({
      token: null,
      usuario: null,
    });

  }, []);

  // ===========================================
  // VALORES DEL CONTEXTO
  // ===========================================

  const valor = {
    usuario,
    token,
    perfil,
    esAdministrador,
    autenticado,
    cargando,
    login,
    logout,
  };

  return (
    <UserContext.Provider value={valor}>
      {children}
    </UserContext.Provider>
  );
}

// =============================================
// HOOK PERSONALIZADO
// =============================================

export function useUser() {

  const context = useContext(UserContext);

  if (!context) {
    throw new Error(
      "useUser debe utilizarse dentro de UserProvider."
    );
  }

  return context;
}
