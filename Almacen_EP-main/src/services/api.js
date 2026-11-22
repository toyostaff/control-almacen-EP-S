
const API_URL = import.meta.env.VITE_API_URL;

// =============================================
// CONFIGURACIÓN CENTRAL DE LA API
// =============================================

const TOKEN_KEY = "almacen_token";
const USER_KEY = "almacen_usuario";

// =============================================
// COMUNICACIÓN CON RAILWAY
// =============================================

export async function apiFetch(endpoint, options = {}) {
  if (!API_URL) {
    throw new Error(
      "No se ha configurado la URL del backend."
    );
  }

  const token = localStorage.getItem(TOKEN_KEY);

  const url = `${API_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor. Verifica tu conexión a internet."
    );
  }

  // ===========================================
  // PROCESAR RESPUESTA
  // ===========================================

  let resultado;

  try {
    resultado = await response.json();
  } catch {
    throw new Error(
      "El servidor devolvió una respuesta inválida."
    );
  }

  // ===========================================
  // SESIÓN EXPIRADA O NO AUTORIZADA
  // ===========================================

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

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
