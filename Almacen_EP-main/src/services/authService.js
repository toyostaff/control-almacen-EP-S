
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
// PROCESAR RESPUESTA
// =============================================

async function procesarRespuesta(response) {
  let resultado;

  try {
    resultado = await response.json();
  } catch {
    throw new Error(
      "El servidor devolvió una respuesta inválida."
    );
  }

  if (!response.ok) {
    throw new Error(
      resultado?.mensaje ||
      resultado?.error ||
      "Error al comunicarse con el servidor."
    );
  }

  return resultado;
}

// =============================================
// INICIAR SESIÓN
// =============================================

export async function iniciarSesion(usuario, password) {
  let response;

  try {
    response = await fetch(
      `${obtenerURL()}/api/auth/login`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usuario,
          password
        })
      }
    );
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor."
    );
  }

  const resultado = await procesarRespuesta(response);

  if (!resultado.usuario) {
    throw new Error(
      "El servidor no devolvió los datos del usuario."
    );
  }

  return {
    usuario: resultado.usuario
  };
}

// =============================================
// RECUPERAR SESIÓN DEL NAVEGADOR
// =============================================

export async function obtenerSesion() {
  let response;

  try {
    response = await fetch(
      `${obtenerURL()}/api/auth/me`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      }
    );
  } catch {
    throw new Error(
      "No se pudo verificar la sesión con el servidor."
    );
  }

  if (response.status === 401) {
    return null;
  }

  const resultado = await procesarRespuesta(response);

  return resultado.usuario || null;
}

// =============================================
// CERRAR SESIÓN
// =============================================

export async function cerrarSesionServidor() {
  let response;

  try {
    response = await fetch(
      `${obtenerURL()}/api/auth/logout`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      }
    );
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor para cerrar sesión."
    );
  }

  return await procesarRespuesta(response);
}
