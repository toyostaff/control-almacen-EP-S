
const API_URL = import.meta.env.VITE_API_URL;

// =============================================
// URL CENTRAL DEL BACKEND
// =============================================

function obtenerURL() {
  if (!API_URL) {
    throw new Error(
      "No se ha configurado la URL del servidor."
    );
  }

  return API_URL.replace(/\/+$/, "");
}

// =============================================
// PROCESAR RESPUESTA DEL SERVIDOR
// =============================================

async function procesarRespuesta(response) {
  let resultado = {};

  try {
    if (response.status !== 204) {
      resultado = await response.json();
    }
  } catch {
    throw new Error(
      "El servidor devolvió una respuesta inválida."
    );
  }

  if (!response.ok) {
    throw new Error(
      resultado?.mensaje ||
      resultado?.error ||
      `Error del servidor (${response.status}).`
    );
  }

  return resultado;
}

// =============================================
// INICIAR SESIÓN
// =============================================

export async function iniciarSesion(usuario, password) {

  if (!usuario || !password) {
    throw new Error(
      "Usuario y contraseña son obligatorios."
    );
  }

  let response;

  try {
    response = await fetch(
      `${obtenerURL()}/api/auth/login`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify({
          usuario: String(usuario).trim(),
          password: String(password),
        }),
      }
    );

  } catch {
    throw new Error(
      "No se pudo conectar con el servidor. Verifica tu conexión a internet."
    );
  }

  const resultado = await procesarRespuesta(response);

  // ===========================================
  // VALIDAR TOKEN Y USUARIO
  // ===========================================

  if (!resultado.token || !resultado.usuario) {
    throw new Error(
      "El servidor no devolvió una sesión válida."
    );
  }

  return {
    token: resultado.token,
    usuario: resultado.usuario,
  };
}
