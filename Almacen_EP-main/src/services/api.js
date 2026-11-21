
const API_URL = import.meta.env.VITE_API_URL;

export async function apiFetch(endpoint, options = {}) {
  if (!API_URL) {
    throw new Error("No se ha configurado la URL del backend.");
  }

  const response = await fetch(
    `${API_URL.replace(/\/$/, "")}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    }
  );

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(
      resultado.mensaje || "Error al comunicarse con el servidor."
    );
  }

  return resultado.data;
}
