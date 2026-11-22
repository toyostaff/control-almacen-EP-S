
const API_URL = import.meta.env.VITE_API_URL;

export async function iniciarSesion(usuario, password) {
  if (!API_URL) {
    throw new Error("No se ha configurado la URL del servidor.");
  }

  const response = await fetch(
    `${API_URL.replace(/\/$/, "")}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usuario,
        password,
      }),
    }
  );

  const resultado = await response.json();

  if (!response.ok) {
    throw new Error(
      resultado.mensaje ||
      resultado.error ||
      "Usuario o contraseña incorrectos."
    );
  }

  if (!resultado.token || !resultado.usuario) {
    throw new Error("El servidor no devolvió una sesión válida.");
  }

  return resultado;
}
