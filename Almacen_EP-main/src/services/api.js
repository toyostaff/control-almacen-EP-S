
const API_URL = import.meta.env.VITE_API_URL;

// =============================================
// CONFIGURACIÓN CENTRAL DE LA API
// =============================================

// Evitar notificaciones repetidas.

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
// RESTABLECER ESTADO DE AUTENTICACIÓN
// =============================================

// Se ejecuta después de iniciar sesión correctamente.

export function restablecerNotificacionSesion() {
  sesionExpiradaNotificada = false;
}

// =============================================
// PROCESAR RESPUESTA DEL SERVIDOR
// =============================================

async function procesarRespuesta(response) {

  if (response.status === 204) {
    return {};
  }

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

  if (sesionExpiradaNotificada) {
    return;
  }

  sesionExpiradaNotificada = true;

  // Avisar al UserContext.
  // El contexto sincroniza las demás pestañas.

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

  const url =
    `${obtenerURL()}/${endpoint.replace(/^\/+/, "")}`;

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

      // Enviar automáticamente la cookie HttpOnly.
      credentials: "include",
    });

  } catch {

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
