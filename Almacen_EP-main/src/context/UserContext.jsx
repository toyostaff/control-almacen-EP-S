
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import {
  iniciarSesion,
  obtenerSesion,
  cerrarSesionServidor,
} from "../services/authService";

// =============================================
// CONTEXTO DE USUARIO
// =============================================

const UserContext = createContext(null);

// =============================================
// CONFIGURACIÓN DE SINCRONIZACIÓN
// =============================================

const EVENTO_STORAGE = "almacen_session_event";
const CANAL_SESION = "almacen_session_channel";

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
// PROVEEDOR DE USUARIO
// =============================================

export function UserProvider({ children }) {
  const [usuario, setUsuario] = useState(null);

  const [verificandoSesion, setVerificandoSesion] = useState(true);

  const [cargando, setCargando] = useState(false);

  const canalRef = useRef(null);

  const montadoRef = useRef(false);

  const solicitudRef = useRef(0);

  // ===========================================
  // DATOS DE AUTENTICACIÓN
  // ===========================================

  const autenticado = Boolean(usuario);

  const perfil = usuario?.rol || null;

  const esAdministrador = perfil === PERFILES.ADMIN;

  // ===========================================
  // NOTIFICAR A OTRAS PESTAÑAS
  // ===========================================

  const notificarOtrasPestanas = useCallback((tipo) => {
    const mensaje = {
      tipo,
      fecha: Date.now(),
    };

    // Comunicación mediante BroadcastChannel.
    if (canalRef.current) {
      canalRef.current.postMessage(mensaje);
      return;
    }

    // Alternativa mediante localStorage.
    try {
      localStorage.setItem(
        EVENTO_STORAGE,
        JSON.stringify(mensaje)
      );
    } catch (error) {
      console.warn(
        "No se pudo notificar a otras pestañas:",
        error.message
      );
    }
  }, []);

  // ===========================================
  // VERIFICAR SESIÓN CON EL BACKEND
  // ===========================================

  const verificarSesion = useCallback(async () => {
    const solicitudActual = ++solicitudRef.current;

    try {
      // El navegador envía automáticamente
      // la cookie HttpOnly al backend.

      const usuarioServidor = await obtenerSesion();

      // Evitar actualizar un componente desmontado
      // o una respuesta que ya quedó obsoleta.

      if (
        !montadoRef.current ||
        solicitudActual !== solicitudRef.current
      ) {
        return null;
      }

      if (!usuarioValido(usuarioServidor)) {
        setUsuario(null);
        return null;
      }

      setUsuario(usuarioServidor);

      return usuarioServidor;

    } catch (error) {
      if (
        montadoRef.current &&
        solicitudActual === solicitudRef.current
      ) {
        setUsuario(null);
      }

      throw error;
    }
  }, []);

  // ===========================================
  // CERRAR SESIÓN LOCAL
  // ===========================================

  const cerrarSesionLocal = useCallback(() => {
    // Invalidar verificaciones pendientes.
    solicitudRef.current++;

    // Eliminar usuario del estado de React.
    if (montadoRef.current) {
      setUsuario(null);
    }
  }, []);

  // ===========================================
  // INICIALIZAR COMPONENTE
  // ===========================================

  useEffect(() => {
    montadoRef.current = true;

    return () => {
      montadoRef.current = false;
      solicitudRef.current++;
    };
  }, []);

  // ===========================================
  // COMPROBAR SESIÓN AL ABRIR LA APLICACIÓN
  // ===========================================

  useEffect(() => {
    let cancelado = false;

    async function inicializarSesion() {
      try {
        await verificarSesion();

      } catch (error) {
        console.error(
          "No se pudo comprobar la sesión:",
          error.message
        );

      } finally {
        if (!cancelado && montadoRef.current) {
          setVerificandoSesion(false);
        }
      }
    }

    inicializarSesion();

    return () => {
      cancelado = true;
    };
  }, [verificarSesion]);

  // ===========================================
  // SINCRONIZACIÓN ENTRE PESTAÑAS
  // ===========================================

  useEffect(() => {
    let canal = null;

    // Crear canal si el navegador lo permite.
    if ("BroadcastChannel" in window) {
      canal = new BroadcastChannel(CANAL_SESION);
      canalRef.current = canal;
    }

    // =========================================
    // PROCESAR MENSAJES RECIBIDOS
    // =========================================

    async function manejarEvento(mensaje) {
      if (!mensaje?.tipo) {
        return;
      }

      // Otra pestaña cerró sesión.
      if (mensaje.tipo === "logout") {
        cerrarSesionLocal();

        setVerificandoSesion(false);

        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }

        return;
      }

      // Otra pestaña inició sesión.
      if (mensaje.tipo === "login") {
        try {
          const usuarioServidor = await verificarSesion();

          if (!usuarioServidor && montadoRef.current) {
            setVerificandoSesion(false);
          }

        } catch (error) {
          console.error(
            "No se pudo sincronizar la sesión:",
            error.message
          );

          setVerificandoSesion(false);
        }
      }
    }

    // =========================================
    // BROADCAST CHANNEL
    // =========================================

    function manejarMensaje(event) {
      manejarEvento(event.data);
    }

    canal?.addEventListener(
      "message",
      manejarMensaje
    );

    // =========================================
    // ALTERNATIVA LOCALSTORAGE
    // =========================================

    function manejarStorage(event) {
      if (
        event.key !== EVENTO_STORAGE ||
        !event.newValue
      ) {
        return;
      }

      try {
        const mensaje = JSON.parse(event.newValue);
        manejarEvento(mensaje);

      } catch {
        // Ignorar mensajes inválidos.
      }
    }

    window.addEventListener(
      "storage",
      manejarStorage
    );

    // =========================================
    // DETECTAR SESIÓN EXPIRADA
    // =========================================

    function manejarSesionExpirada() {
      cerrarSesionLocal();

      notificarOtrasPestanas("logout");

      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    window.addEventListener(
      "almacen:session-expired",
      manejarSesionExpirada
    );

    // =========================================
    // LIMPIAR EVENTOS
    // =========================================

    return () => {
      canal?.removeEventListener(
        "message",
        manejarMensaje
      );

      canal?.close();

      if (canalRef.current === canal) {
        canalRef.current = null;
      }

      window.removeEventListener(
        "storage",
        manejarStorage
      );

      window.removeEventListener(
        "almacen:session-expired",
        manejarSesionExpirada
      );
    };
  }, [
    verificarSesion,
    cerrarSesionLocal,
    notificarOtrasPestanas,
  ]);

  // ===========================================
  // COMPROBAR SESIÓN AL VOLVER A LA PESTAÑA
  // ===========================================

  useEffect(() => {
    async function comprobarSesionActual() {
      if (document.hidden || !montadoRef.current) {
        return;
      }

      try {
        const usuarioServidor = await verificarSesion();

        if (
          !usuarioServidor &&
          montadoRef.current &&
          window.location.pathname !== "/login"
        ) {
          window.location.replace("/login");
        }

      } catch (error) {
        console.error(
          "Error verificando la sesión:",
          error.message
        );
      }
    }

    document.addEventListener(
      "visibilitychange",
      comprobarSesionActual
    );

    window.addEventListener(
      "focus",
      comprobarSesionActual
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        comprobarSesionActual
      );

      window.removeEventListener(
        "focus",
        comprobarSesionActual
      );
    };
  }, [verificarSesion]);

  // ===========================================
  // INICIAR SESIÓN
  // ===========================================

  const login = useCallback(
    async (nombreUsuario, password) => {
      setCargando(true);

      try {
        // El backend valida las credenciales
        // y establece la cookie HttpOnly.

        const resultado = await iniciarSesion(
          nombreUsuario,
          password
        );

        const nuevoUsuario = resultado?.usuario;

        // Ya no se espera resultado.token.
        // Tampoco se guarda ningún JWT en React.

        if (!usuarioValido(nuevoUsuario)) {
          throw new Error(
            "El servidor no devolvió un usuario válido."
          );
        }

        // Invalidar verificaciones anteriores.
        solicitudRef.current++;

        // Actualizar usuario autenticado.
        setUsuario(nuevoUsuario);

        setVerificandoSesion(false);

        // Sincronizar las demás pestañas.
        notificarOtrasPestanas("login");

        return nuevoUsuario;

      } finally {
        setCargando(false);
      }
    },
    [notificarOtrasPestanas]
  );

  // ===========================================
  // CERRAR SESIÓN
  // ===========================================

  const logout = useCallback(async () => {
    // Cerrar inmediatamente la sesión visual.
    cerrarSesionLocal();

    // Avisar a las demás pestañas.
    notificarOtrasPestanas("logout");

    try {
      // El backend elimina la cookie HttpOnly.
      await cerrarSesionServidor();

    } catch (error) {
      console.error(
        "No se pudo confirmar el cierre de sesión:",
        error.message
      );
    }
  }, [
    cerrarSesionLocal,
    notificarOtrasPestanas,
  ]);

  // ===========================================
  // VALORES DEL CONTEXTO
  // ===========================================

  const valor = {
    usuario,
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
