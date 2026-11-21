import { catalogoInicial } from "../data/catalogoSeed";
import { registrarEvento } from "./historialService";

const STORAGE_KEY = "almacen_catalogo";

function usuarioActual() {
  return localStorage.getItem("almacen_perfil") === "almacen"
    ? "Personal de almacén"
    : "Administrador";
}

function guardarCatalogo(catalogo) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalogo));
}

export function obtenerCatalogo() {
  const almacenado = localStorage.getItem(STORAGE_KEY);
  if (!almacenado) {
    guardarCatalogo(catalogoInicial);
    return catalogoInicial;
  }
  try {
    return JSON.parse(almacenado);
  } catch {
    guardarCatalogo(catalogoInicial);
    return catalogoInicial;
  }
}

function obtenerSiguienteSku(catalogo) {
  const numeros = catalogo.map((item) => {
    const numero = Number(item.sku?.replace("SKU-", ""));
    return Number.isNaN(numero) ? 0 : numero;
  });
  const mayor = numeros.length > 0 ? Math.max(...numeros) : 0;
  return `SKU-${String(mayor + 1).padStart(4, "0")}`;
}

export function crearMaterial(descripcion) {
  const catalogo = obtenerCatalogo();
  const descripcionLimpia = descripcion.trim();
  if (!descripcionLimpia) throw new Error("La descripción es obligatoria.");

  const duplicado = catalogo.some(
    (item) => item.descripcion.trim().toLowerCase() === descripcionLimpia.toLowerCase(),
  );
  if (duplicado) throw new Error("Ya existe un material con esta descripción.");

  const nuevoMaterial = {
    id: Date.now(),
    sku: obtenerSiguienteSku(catalogo),
    descripcion: descripcionLimpia,
    fechaCreacion: new Date().toISOString().split("T")[0],
    estado: "Activo",
  };
  guardarCatalogo([...catalogo, nuevoMaterial]);
  registrarEvento({
    modulo: "Catálogo Maestro",
    accion: "Creación",
    descripcion: `Se creó el material ${nuevoMaterial.descripcion}.`,
    referencia: nuevoMaterial.sku,
    usuario: usuarioActual(),
  });
  return nuevoMaterial;
}

export function editarMaterial(id, descripcion) {
  const catalogo = obtenerCatalogo();
  const descripcionLimpia = descripcion.trim();
  if (!descripcionLimpia) throw new Error("La descripción es obligatoria.");

  const existente = catalogo.find((item) => item.id === id);
  if (!existente) throw new Error("No se encontró el material.");

  const duplicado = catalogo.some(
    (item) => item.id !== id && item.descripcion.trim().toLowerCase() === descripcionLimpia.toLowerCase(),
  );
  if (duplicado) throw new Error("Ya existe otro material con esta descripción.");

  const actualizado = catalogo.map((item) =>
    item.id === id ? { ...item, descripcion: descripcionLimpia } : item,
  );
  guardarCatalogo(actualizado);
  registrarEvento({
    modulo: "Catálogo Maestro",
    accion: "Edición",
    descripcion: `Se modificó el material ${existente.descripcion} por ${descripcionLimpia}.`,
    referencia: existente.sku,
    usuario: usuarioActual(),
  });
  return actualizado;
}

export function cambiarEstadoMaterial(id) {
  const catalogo = obtenerCatalogo();
  const existente = catalogo.find((item) => item.id === id);
  if (!existente) throw new Error("No se encontró el material.");

  const nuevoEstado = existente.estado === "Activo" ? "Inactivo" : "Activo";
  const actualizado = catalogo.map((item) =>
    item.id === id ? { ...item, estado: nuevoEstado } : item,
  );
  guardarCatalogo(actualizado);
  registrarEvento({
    modulo: "Catálogo Maestro",
    accion: nuevoEstado === "Activo" ? "Activación" : "Desactivación",
    descripcion: `Se ${nuevoEstado === "Activo" ? "activó" : "desactivó"} el material ${existente.descripcion}.`,
    referencia: existente.sku,
    usuario: usuarioActual(),
  });
  return actualizado;
}
