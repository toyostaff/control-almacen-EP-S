
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import { iniciarSesion } from "../services/authService";

// =============================================
// CONTEXTO DE USUARIO
// =============================================

const UserContext = createContext(null);

// =============================================
// CONFIGURACIÓN DE SESIÓN
// =============================================

const TOKEN_KEY = "almacen_token";
const USER_KEY = "almacen_usuario";

const CANAL_SESION = "almacen_session_channel";

const TIEMPO_ESPERA_SINCRONIZACION = 1000;

// =============================================
// PERFILES DEL SISTEMA
// =============================================

export const PERFILES = {
  ADMIN: "admin",
  ALMACEN: "almacen",
};

// =============================================
// VALIDAR USUARIO
// =============================================

function usuarioValido(usuario) {
  return Boolean(
    usuario &&
    usuario.id &&
    usuario.nombre &&
    Object.values(PERFILES).includes(usuario.rol)
  );
}

// =============================================
// DECODIFICAR JWT
// =============================================

function obtenerExpiracionToken(token) {
  try {
    if (typeof token !== "string") {
      return null;
    }

    const partes = token.split(".");

    if (partes.length !== 3) {
      return null;
    }

    const base64 = partes[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(
        Math.ceil(partes[1].length / 4) * 4,
        "="
      );

    const binario = atob(base64);

    const bytes = Uint8Array.from(
      binario,
      caracter => caracter.charCodeAt(0)
    );

    const payload = JSON.parse(
      new TextDecoder().decode(bytes)
    );

    if (
      !payload.exp ||
      !Number.isFinite(payload.exp)
    ) {
      return null;
    }

    return payload.exp * 1000;

  } catch {
    return null;
  }
}

// =============================================
// VALIDAR TOKEN JWT
// =============================================

function tokenValido(token) {
  if (!token || typeof token !== "string") {
    return false;
  }

  const expiracion = obtenerExpiracionToken(token);

  if (!expiracion) {
    return false;
  }

  return Date.now() < expiracion;
}

// =============================================
// LEER SESIÓN DE LA PESTAÑA ACTUAL
// =============================================

function obtenerSesionGuardada() {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);

    const usuarioGuardado = sessionStorage.getItem(USER_KEY);

    if (!token || !usuarioGuardado) {
      return {
        token: null,
        usuario: null,
      };
    }

    const usuario = JSON.parse(usuarioGuardado);

    if (
      !tokenValido(token) ||
      !usuarioValido(usuario)
    ) {
      throw new Error("Sesión inválida o expirada.");
    }

    return {
      token,
      usuario,
    };

  } catch {
    eliminarSesion();

    return {
      token: null,
      usuario: null,
    };
  }
}

// =============================================
// GUARDAR SESIÓN
// =============================================

function guardarSesion(token, usuario) {
  if (
    !tokenValido(token) ||
    !usuarioValido(usuario)
  ) {
    throw new Error(
      "No se puede guardar una sesión inválida."
    );
  }

  sessionStorage.setItem(TOKEN_KEY, token);

  sessionStorage.setItem(
    USER_KEY,
    JSON.stringify(usuario)
  );
}

// =============================================
// ELIMINAR SESIÓN
// =============================================

function eliminarSesion() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

// =============================================
// PROVEEDOR DE USUARIO
// =============================================

export function UserProvider({ children }) {

  const [sesion, setSesion] = useState({
    token: null,
    usuario: null,
  });

  const [verificandoSesion, setVerificandoSesion] = useState(true);

  const [cargando, setCargando] = useState(false);

  const canalRef = useRef(null);

  const temporizadorRef = useRef(null);

  const montadoRef = useRef(false);

  // ===========================================
  // DATOS DE AUTENTICACIÓN
  // ===========================================

  const token = sesion.token;

  const usuario = sesion.usuario;

  const autenticado = Boolean(token && usuario);

  const perfil = usuario?.rol || null;

  const esAdministrador = perfil === PERFILES.ADMIN;

  // ===========================================
  // NOTIFICAR A OTRAS PESTAÑAS
  // ===========================================

  const notificarOtrasPestanas = useCallback((mensaje) => {

    if (canalRef.current) {
      canalRef.current.postMessage(mensaje);
    }

  }, []);

  // ===========================================
  // CERRAR SESIÓN LOCAL
  // ===========================================

  const cerrarSesionLocal = useCallback(() => {

    eliminarSesion();

    if (temporizadorRef.current) {
      clearTimeout(temporizadorRef.current);
      temporizadorRef.current = null;
    }

    if (montadoRef.current) {
      setSesion({
        token: null,
        usuario: null,
      });
    }

  }, []);

  // ===========================================
  // PROGRAMAR EXPIRACIÓN AUTOMÁTICA
  // ===========================================

  const programarExpiracion = useCallback((tokenActual) => {

    if (temporizadorRef.current) {
      clearTimeout(temporizadorRef.current);
      temporizadorRef.current = null;
    }

    const expiracion = obtenerExpiracionToken(tokenActual);

    if (!expiracion) {
      cerrarSesionLocal();

      notificarOtrasPestanas({
        tipo: "logout",
      });

      return;
    }

    const tiempoRestante = expiracion - Date.now();

    if (tiempoRestante <= 0) {
      cerrarSesionLocal();

      notificarOtrasPestanas({
        tipo: "logout",
      });

      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }

      return;
    }

    temporizadorRef.current = setTimeout(() => {

      cerrarSesionLocal();

      notificarOtrasPestanas({
        tipo: "logout",
      });

      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }

    }, Math.min(tiempoRestante, 2147483647));

  }, [
    cerrarSesionLocal,
    notificarOtrasPestanas,
  ]);

  // ===========================================
  // RESTAURAR SESIÓN EN ESTA PESTAÑA
  // ===========================================

  const restaurarSesion = useCallback((tokenRecibido, usuarioRecibido) => {

    if (
      !tokenValido(tokenRecibido) ||
      !usuarioValido(usuarioRecibido)
    ) {
      return false;
    }

    try {

      guardarSesion(tokenRecibido, usuarioRecibido);

      if (montadoRef.current) {

        setSesion({
          token: tokenRecibido,
          usuario: usuarioRecibido,
        });

        programarExpiracion(tokenRecibido);

        setVerificandoSesion(false);
      }

      return true;

    } catch {
      return false;
    }

  }, [programarExpiracion]);

  // ===========================================
  // INICIALIZAR SESIÓN
  // ===========================================

  useEffect(() => {

    montadoRef.current = true;

    const sesionGuardada = obtenerSesionGuardada();

    if (sesionGuardada.token) {

      setSesion(sesionGuardada);

      programarExpiracion(sesionGuardada.token);

      setVerificandoSesion(false);

    } else {

      // Esperar una posible sesión de otra pestaña.

      const temporizador = setTimeout(() => {

        if (montadoRef.current) {
          setVerificandoSesion(false);
        }

      }, TIEMPO_ESPERA_SINCRONIZACION);

      return () => {

        clearTimeout(temporizador);

        montadoRef.current = false;

        if (temporizadorRef.current) {
          clearTimeout(temporizadorRef.current);
          temporizadorRef.current = null;
        }

      };
    }

    return () => {

      montadoRef.current = false;

      if (temporizadorRef.current) {
        clearTimeout(temporizadorRef.current);
        temporizadorRef.current = null;
      }

    };

  }, [programarExpiracion]);

  // ===========================================
  // SINCRONIZACIÓN ENTRE PESTAÑAS
  // ===========================================

  useEffect(() => {

    if (!("BroadcastChannel" in window)) {
      console.warn(
        "Este navegador no admite sincronización mediante BroadcastChannel."
      );

      return;
    }

    const canal = new BroadcastChannel(CANAL_SESION);

    canalRef.current = canal;

    function manejarMensaje(event) {

      const mensaje = event.data;

      if (!mensaje?.tipo) {
        return;
      }

      // Solicitud de sesión de otra pestaña.

      if (mensaje.tipo === "session-request") {

        const actual = obtenerSesionGuardada();

        if (actual.token && actual.usuario) {

          canal.postMessage({
            tipo: "session-response",
            token: actual.token,
            usuario: actual.usuario,
          });

        }

        return;
      }

      // Recibir sesión de otra pestaña.

      if (
        mensaje.tipo === "session-response" ||
        mensaje.tipo === "login"
      ) {

        const restaurada = restaurarSesion(
          mensaje.token,
          mensaje.usuario
        );

        if (restaurada) {
          setVerificandoSesion(false);
        }

        return;
      }

      // Cierre de sesión desde otra pestaña.

      if (mensaje.tipo === "logout") {

        cerrarSesionLocal();

        setVerificandoSesion(false);

        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }

      }

    }

    canal.addEventListener(
      "message",
      manejarMensaje
    );

    // Solicitar sesión a las pestañas activas.

    const actual = obtenerSesionGuardada();

    if (!actual.token) {

      canal.postMessage({
        tipo: "session-request",
      });

    }

    return () => {

      canal.removeEventListener(
        "message",
        manejarMensaje
      );

      canal.close();

      if (canalRef.current === canal) {
        canalRef.current = null;
      }

    };

  }, [
    restaurarSesion,
    cerrarSesionLocal,
  ]);

  // ===========================================
  // DETECTAR SESIÓN EXPIRADA DESDE api.js
  // ===========================================

  useEffect(() => {

    function manejarSesionExpirada() {

      cerrarSesionLocal();

      notificarOtrasPestanas({
        tipo: "logout",
      });

    }

    window.addEventListener(
      "almacen:session-expired",
      manejarSesionExpirada
    );

    return () => {

      window.removeEventListener(
        "almacen:session-expired",
        manejarSesionExpirada
      );

    };

  }, [
    cerrarSesionLocal,
    notificarOtrasPestanas,
  ]);

  // ===========================================
  // COMPROBAR EXPIRACIÓN AL VOLVER A LA PESTAÑA
  // ===========================================

  useEffect(() => {

    function comprobarExpiracion() {

      if (document.hidden || !token) {
        return;
      }

      if (!tokenValido(token)) {

        cerrarSesionLocal();

        notificarOtrasPestanas({
          tipo: "logout",
        });

        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }

      } else {

        programarExpiracion(token);

      }

    }

    document.addEventListener(
      "visibilitychange",
      comprobarExpiracion
    );

    window.addEventListener(
      "focus",
      comprobarExpiracion
    );

    return () => {

      document.removeEventListener(
        "visibilitychange",
        comprobarExpiracion
      );

      window.removeEventListener(
        "focus",
        comprobarExpiracion
      );

    };

  }, [
    token,
    cerrarSesionLocal,
    notificarOtrasPestanas,
    programarExpiracion,
  ]);

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

      const nuevoToken = resultado?.token;

      const nuevoUsuario = resultado?.usuario;

      if (!tokenValido(nuevoToken)) {
        throw new Error(
          "El servidor devolvió un token inválido o expirado."
        );
      }

      if (!usuarioValido(nuevoUsuario)) {
        throw new Error(
          "El servidor no devolvió un usuario válido."
        );
      }

      // Guardar sesión de esta pestaña.

      guardarSesion(nuevoToken, nuevoUsuario);

      setSesion({
        token: nuevoToken,
        usuario: nuevoUsuario,
      });

      // Programar expiración JWT.

      programarExpiracion(nuevoToken);

      // Finalizar verificación.

      setVerificandoSesion(false);

      // Sincronizar con otras pestañas.

      notificarOtrasPestanas({
        tipo: "login",
        token: nuevoToken,
        usuario: nuevoUsuario,
      });

      return nuevoUsuario;

    } finally {

      setCargando(false);

    }

  }, [
    notificarOtrasPestanas,
    programarExpiracion,
  ]);

  // ===========================================
  // CERRAR SESIÓN
  // ===========================================

  const logout = useCallback(() => {

    // Cerrar sesión de esta pestaña.

    cerrarSesionLocal();

    // Avisar a las demás pestañas.

    notificarOtrasPestanas({
      tipo: "logout",
    });

  }, [
    cerrarSesionLocal,
    notificarOtrasPestanas,
  ]);

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
    verificandoSesion,
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
