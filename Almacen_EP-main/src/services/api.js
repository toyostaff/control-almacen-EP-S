
const API_URL = import.meta.env.VITE_API_URL;

// =============================================
// CONFIGURACIÓN CENTRAL DE LA API
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
// COMUNICACIÓN CON RAILWAY
// =============================================

export async function apiFetch(endpoint, options = {}) {

  const url = `${obtenerURL()}/${endpoint.replace(/^\/+/, "")}`;

  const esFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const headers = {
    Accept: "application/json",

    ...(!esFormData && options.body !== undefined
      ? { "Content-Type": "application/json" }
      : {}),

    ...options.headers,
  };

  let response;

  try {
    response = await fetch(url, {
      ...options,

      // Enviar automáticamente la cookie HttpOnly.
      credentials: "include",

      headers,
    });

  } catch {
    throw new Error(
      "No se pudo conectar con el servidor. Verifica tu conexión a internet."
    );
  }

  // ===========================================
  // PROCESAR RESPUESTA
  // ===========================================

  let resultado = {};

  if (response.status !== 204) {
    try {
      resultado = await response.json();
    } catch {
      throw new Error(
        "El servidor devolvió una respuesta inválida."
      );
    }
  }

  // ===========================================
  // SESIÓN EXPIRADA O NO AUTORIZADA
  // ===========================================

  if (response.status === 401) {

    // Avisar al contexto de usuario.
    window.dispatchEvent(
      new Event("almacen:session-expired")
    );

    // Regresar al inicio de sesión.
    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }

    throw new Error(
      "Tu sesión ha expirado. Inicia sesión nuevamente."
    );
  }

  // ===========================================
  // ERRORES DEL SERVIDOR
  // ===========================================

  if (!response.ok) {
    throw new Error(
      resultado?.mensaje ||
      resultado?.error ||
      `Error del servidor (${response.status}).`
    );
  }

  // ===========================================
  // DEVOLVER DATOS
  // ===========================================

  return resultado?.data ?? resultado;
}
