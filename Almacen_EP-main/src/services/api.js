
const API_URL = import.meta.env.VITE_API_URL;

export async function apiFetch(endpoint, options = {}) {
  if (!API_URL) {
    throw new Error("No se ha configurado la URL del backend.");
  }

  const token = localStorage.getItem("almacen_token");

  const response = await fetch(
    `${API_URL.replace(/\/$/, "")}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...options.headers,
      },
    }
  );

  let resultado;

  try {
    resultado = await response.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta inválida.");
  }

  if (response.status === 401) {
    localStorage.removeItem("almacen_token");
    localStorage.removeItem("almacen_usuario");

    window.location.href = "/login";

    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  if (!response.ok) {
    throw new Error(
      resultado.mensaje ||
      resultado.error ||
      "Error al comunicarse con el servidor."
    );
  }

  return resultado.data ?? resultado;
}
