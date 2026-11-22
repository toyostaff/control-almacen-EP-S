
import { apiFetch } from "./api";

// =========================================
// CONSULTAR HISTORIAL CENTRALIZADO
// =========================================

export async function obtenerHistorial(limit = 200) {
  const limite = Math.min(
    Math.max(Number(limit) || 200, 1),
    500
  );

  return await apiFetch(
    `/api/historial?limit=${limite}`
  );
}

// =========================================
// LIMPIAR HISTORIAL
// SOLO ADMINISTRADOR
// =========================================

export async function limpiarHistorial() {
  return await apiFetch("/api/historial", {
    method: "DELETE",
  });
}
