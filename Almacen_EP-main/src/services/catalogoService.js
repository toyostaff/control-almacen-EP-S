
import { apiFetch } from "./api";

// =========================================
// CONSULTAR CATÁLOGO MAESTRO
// =========================================

export async function obtenerCatalogo() {
  return await apiFetch("/api/catalogo");
}

// =========================================
// CREAR MATERIAL
// =========================================

export async function crearMaterial(descripcion) {
  return await apiFetch("/api/catalogo", {
    method: "POST",
    body: JSON.stringify({ descripcion }),
  });
}

// =========================================
// EDITAR MATERIAL
// =========================================

export async function editarMaterial(id, descripcion) {
  return await apiFetch(`/api/catalogo/${id}`, {
    method: "PUT",
    body: JSON.stringify({ descripcion }),
  });
}

// =========================================
// ACTIVAR / DESACTIVAR MATERIAL
// =========================================

export async function cambiarEstadoMaterial(id) {
  return await apiFetch(`/api/catalogo/${id}/estado`, {
    method: "PATCH",
  });
}
