
import { apiFetch } from "./api";

// Consultar todas las ubicaciones y subdivisiones
export async function obtenerUbicaciones() {
  return await apiFetch("/api/ubicaciones");
}

// Consultar ocupación real del almacén
export async function obtenerOcupacion() {
  return await apiFetch("/api/ubicaciones/ocupacion");
}
