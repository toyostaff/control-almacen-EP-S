
import { apiFetch } from "./api";

// =========================================
// INVENTARIO CENTRALIZADO EN RAILWAY
// =========================================

export async function obtenerInventario() {
  return await apiFetch("/api/inventario");
}

// =========================================
// REGISTRAR REPUESTO
// =========================================

export async function crearRegistroInventario(datos) {
  return await apiFetch("/api/inventario", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

// =========================================
// EDITAR REPUESTO
// =========================================

export async function editarRegistroInventario(id, datos) {
  return await apiFetch(`/api/inventario/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

// =========================================
// ACTIVAR / DESACTIVAR REPUESTO
// =========================================

export async function cambiarEstadoRegistro(id) {
  return await apiFetch(`/api/inventario/${id}/estado`, {
    method: "PATCH",
  });
}

// =========================================
// ELIMINAR FOTOGRAFÍA
// =========================================

export async function eliminarFotoRegistro(id) {
  return await apiFetch(`/api/inventario/${id}/foto`, {
    method: "DELETE",
  });
}
