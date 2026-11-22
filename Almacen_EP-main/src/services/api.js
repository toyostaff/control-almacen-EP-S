
const API_URL = import.meta.env.VITE_API_URL;

// =============================================
// CONFIGURACIÓN CENTRAL DE LA API
// =============================================

// Evitar notificaciones repetidas durante
// múltiples solicitudes que fallen simultáneamente.
let sesionExpiradaNotificada = false;

// =============================================
// URL CENTRAL DEL BACKEND
// =============================================

function obtenerURL() {
  if (!API_URL) {
    throw new Error(
      "No se ha configurado la URL del backend."
    );
  }

  return API_URL.replace(/\/+$/, "");
}

// =============================================
// PROCESAR RESPUESTA DEL SERVIDOR
// =============================================

async function procesarRespuesta(response) {
  // Respuesta sin contenido.
  if (response.status === 204) {
    return {};
  }

  // Leer respuesta JSON.
  try {
    return await response.json();
  } catch {
    throw new Error(
      "El servidor devolvió una respuesta inválida."
    );
  }
}

// =============================================
// GESTIONAR SESIÓN EXPIRADA
// =============================================

function gestionarSesionExpirada() {
  // Evitar múltiples eventos simultáneos.
  if (sesionExpiradaNotificada) {
    return;
  }

  sesionExpiradaNotificada = true;

  // Avisar al UserContext.
  // El contexto se encarga de actualizar el estado,
  // sincronizar las demás pestañas y redirigir al login.

  window.dispatchEvent(
    new Event("almacen:session-expired")
  );
}

// =============================================
// COMUNICACIÓN CON RAILWAY
// =============================================

export async function apiFetch(endpoint, options = {}) {

  // ===========================================
  // VALIDAR ENDPOINT
  // ===========================================

  if (
    typeof endpoint !== "string" ||
    !endpoint.trim()
  ) {
    throw new Error(
      "La dirección del servicio no es válida."
    );
  }

  const url = `${obtenerURL()}/${endpoint.replace(/^\/+/, "")}`;

  // ===========================================
  // DETECTAR FORM DATA
  // ===========================================

  const esFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  // ===========================================
  // CONFIGURAR ENCABEZADOS
  // ===========================================

  const headers = {
    Accept: "application/json",

    ...(
      options.body !== undefined && !esFormData
        ? { "Content-Type": "application/json" }
        : {}
    ),

    ...options.headers,
  };

  // ===========================================
  // REALIZAR SOLICITUD
  // ===========================================

  let response;

  try {

    response = await fetch(url, {
      ...options,

      headers,

      // IMPORTANTE:
      // Enviar automáticamente la cookie HttpOnly.
      // No utilizar JWT en Authorization.
      credentials: "include",
    });

  } catch (error) {

    throw new Error(
      "No se pudo conectar con el servidor. Verifica tu conexión a internet."
    );

  }

  // ===========================================
  // PROCESAR RESPUESTA
  // ===========================================

  const resultado = await procesarRespuesta(response);

  // ===========================================
  // SESIÓN EXPIRADA O NO AUTORIZADA
  // ===========================================

  if (response.status === 401) {

    gestionarSesionExpirada();

    throw new Error(
      "Tu sesión ha expirado o no es válida. Inicia sesión nuevamente."
    );

  }

  // ===========================================
  // ERRORES DEL SERVIDOR
  // ===========================================

  if (!response.ok) {

    throw new Error(
      resultado?.mensaje ||
      resultado?.error ||
      `Error al comunicarse con el servidor (${response.status}).`
    );

  }

  // ===========================================
  // DEVOLVER INFORMACIÓN
  // ===========================================

  return resultado?.data ?? resultado;

}
