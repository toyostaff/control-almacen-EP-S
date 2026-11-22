
import {
  createContext,
  useContext,
  useState,
} from "react";

import { iniciarSesion } from "../services/authService";

const UserContext = createContext(null);

const TOKEN_KEY = "almacen_token";
const USER_KEY = "almacen_usuario";

export const PERFILES = {
  ADMIN: "admin",
  ALMACEN: "almacen",
};

export function UserProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const guardado = localStorage.getItem(USER_KEY);
      return guardado ? JSON.parse(guardado) : null;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  });

  const [token, setToken] = useState(() =>
    localStorage.getItem(TOKEN_KEY)
  );

  const [cargando, setCargando] = useState(false);

  const autenticado = Boolean(token && usuario);

  const perfil = usuario?.rol || null;

  const esAdministrador = perfil === PERFILES.ADMIN;

  async function login(nombreUsuario, password) {
    setCargando(true);

    try {
      const resultado = await iniciarSesion(
        nombreUsuario,
        password
      );

      const nuevoUsuario = resultado.usuario;

      if (
        !nuevoUsuario ||
        !Object.values(PERFILES).includes(nuevoUsuario.rol)
      ) {
        throw new Error("El perfil recibido no es válido.");
      }

      localStorage.setItem(TOKEN_KEY, resultado.token);
      localStorage.setItem(
        USER_KEY,
        JSON.stringify(nuevoUsuario)
      );

      setToken(resultado.token);
      setUsuario(nuevoUsuario);

      return nuevoUsuario;
    } finally {
      setCargando(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setToken(null);
    setUsuario(null);
  }

  return (
    <UserContext.Provider
      value={{
        usuario,
        token,
        perfil,
        esAdministrador,
        autenticado,
        cargando,
        login,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error(
      "useUser debe utilizarse dentro de UserProvider."
    );
  }

  return context;
}
