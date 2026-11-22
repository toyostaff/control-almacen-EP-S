
const API_URL = import.meta.env.VITE_API_URL;

// =============================================
// CONFIGURACIÓN CENTRAL DE LA API
// =============================================

const TOKEN_KEY = "almacen_token";
const USER_KEY = "almacen_usuario";

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
// OBTENER TOKEN DE LA SESIÓN ACTUAL
// =============================================

function obtenerToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

// =============================================
// PROCESAR RESPUESTA DEL SERVIDOR
// =============================================

async function procesarRespuesta(response) {
  if (response.status === 204) {
    return {};
  }

  try {
    const resultado = await response.json();

    return resultado;

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

  // Eliminar credenciales de esta pestaña.
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);

  // Avisar al contexto de usuario.
  window.dispatchEvent(
    new Event("almacen:session-expired")
  );

  // Regresar al inicio de sesión.
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

// =============================================
// COMUNICACIÓN CON RAILWAY
// =============================================

export async function apiFetch(endpoint, options = {}) {

  if (typeof endpoint !== "string" || !endpoint.trim()) {
    throw new Error(
      "La dirección del servicio no es válida."
    );
  }

  const url =
    `${obtenerURL()}/${endpoint.replace(/^\/+/, "")}`;

  const token = obtenerToken();

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

    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),

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

      // No utilizamos cookies.
      // La autenticación se realiza mediante JWT.
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
