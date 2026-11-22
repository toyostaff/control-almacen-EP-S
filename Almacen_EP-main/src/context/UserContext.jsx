
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
// CONFIGURACIÓN
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

    // Comunicación principal entre pestañas.
    if (canalRef.current) {
      canalRef.current.postMessage(mensaje);
    }

    // Alternativa para navegadores sin BroadcastChannel.
    try {
      localStorage.setItem(
        EVENTO_STORAGE,
        JSON.stringify(mensaje)
      );
    } catch {
      // La sesión sigue funcionando aunque
      // el almacenamiento de señales no esté disponible.
    }

  }, []);

  // ===========================================
  // RECUPERAR SESIÓN DESDE EL BACKEND
  // ===========================================

  const verificarSesion = useCallback(async () => {

    try {

      const usuarioServidor = await obtenerSesion();

      if (!montadoRef.current) {
        return null;
      }

      if (!usuarioValido(usuarioServidor)) {
        setUsuario(null);
        return null;
      }

      setUsuario(usuarioServidor);

      return usuarioServidor;

    } catch (error) {

      if (montadoRef.current) {
        setUsuario(null);
      }

      throw error;
    }

  }, []);

  // ===========================================
  // COMPROBAR SESIÓN AL ABRIR LA APLICACIÓN
  // ===========================================

  useEffect(() => {

    montadoRef.current = true;

    async function inicializarSesion() {

      try {

        await verificarSesion();

      } catch (error) {

        console.error(
          "No se pudo comprobar la sesión:",
          error.message
        );

      } finally {

        if (montadoRef.current) {
          setVerificandoSesion(false);
        }

      }
    }

    inicializarSesion();

    return () => {
      montadoRef.current = false;
    };

  }, [verificarSesion]);

  // ===========================================
  // SINCRONIZACIÓN ENTRE PESTAÑAS
  // ===========================================

  useEffect(() => {

    // Crear canal de comunicación.
    if ("BroadcastChannel" in window) {

      canalRef.current = new BroadcastChannel(CANAL_SESION);

    }

    // Procesar eventos recibidos.
    async function manejarEvento(mensaje) {

      if (!mensaje?.tipo) return;

      if (mensaje.tipo === "logout") {

        setUsuario(null);

        return;
      }

      if (mensaje.tipo === "login") {

        try {
          await verificarSesion();
        } catch (error) {
          console.error(
            "No se pudo sincronizar la sesión:",
            error.message
          );
        }

      }

    }

    // BroadcastChannel.
    function manejarMensaje(event) {
      manejarEvento(event.data);
    }

    canalRef.current?.addEventListener(
      "message",
      manejarMensaje
    );

    // Alternativa mediante localStorage.
    function manejarStorage(event) {

      if (event.key !== EVENTO_STORAGE || !event.newValue) {
        return;
      }

      try {

        const mensaje = JSON.parse(event.newValue);

        manejarEvento(mensaje);

      } catch {
        // Ignorar señales inválidas.
      }
    }

    window.addEventListener(
      "storage",
      manejarStorage
    );

    // Cierre por sesión expirada.
    function manejarSesionExpirada() {

      setUsuario(null);

      notificarOtrasPestanas("logout");

    }

    window.addEventListener(
      "almacen:session-expired",
      manejarSesionExpirada
    );

    return () => {

      canalRef.current?.removeEventListener(
        "message",
        manejarMensaje
      );

      canalRef.current?.close();

      canalRef.current = null;

      window.removeEventListener(
        "storage",
        manejarStorage
      );

      window.removeEventListener(
        "almacen:session-expired",
        manejarSesionExpirada
      );

    };

  }, [verificarSesion, notificarOtrasPestanas]);

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

      if (!usuarioValido(nuevoUsuario)) {

        throw new Error(
          "El servidor no devolvió un usuario válido."
        );

      }

      // La cookie ya fue guardada por el backend.
      setUsuario(nuevoUsuario);

      // Avisar a las otras pestañas.
      notificarOtrasPestanas("login");

      return nuevoUsuario;

    } finally {

      setCargando(false);

    }

  }, [notificarOtrasPestanas]);

  // ===========================================
  // CERRAR SESIÓN
  // ===========================================

  const logout = useCallback(async () => {

    // Cerrar inmediatamente la sesión visual.
    setUsuario(null);

    // Sincronizar el cierre con otras pestañas.
    notificarOtrasPestanas("logout");

    try {

      // Eliminar la cookie en el servidor.
      await cerrarSesionServidor();

    } catch (error) {

      console.error(
        "No se pudo confirmar el cierre de sesión:",
        error.message
      );

    }

  }, [notificarOtrasPestanas]);

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
