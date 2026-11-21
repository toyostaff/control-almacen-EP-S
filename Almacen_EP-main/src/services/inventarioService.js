
import { inventarioInicial } from "../data/inventarioSeed";
import { ubicacionesAlmacen } from "../data/ubicaciones";
import { registrarEvento } from "./historialService";

const STORAGE_KEY = "almacen_inventario";

function usuarioActual() {
  const perfil = localStorage.getItem("almacen_perfil");
  return perfil === "almacen"
    ? "Personal de almacén"
    : "Administrador";
}

function guardarInventario(inventario) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
}

function limpiarCamposCantidad(registros) {
  return registros.map(({ cantidad, medida, unidadMedida, ...resto }) => resto);
}

export function obtenerInventario() {
  const almacenado = localStorage.getItem(STORAGE_KEY);

  if (!almacenado) {
    guardarInventario(inventarioInicial);
    return inventarioInicial;
  }

  try {
    const registros = JSON.parse(almacenado);
    const limpios = limpiarCamposCantidad(registros);

    if (JSON.stringify(registros) !== JSON.stringify(limpios)) {
      guardarInventario(limpios);
    }

    return limpios;
  } catch {
    guardarInventario(inventarioInicial);
    return inventarioInicial;
  }
}


function validarDatos(datos, inventario, idExcluir = null) {
  if (!datos.skuId) {
    throw new Error(
      "Debes seleccionar un material del Catálogo Maestro."
    );
  }

  const codigo = datos.codigo?.trim() || "";

  // El código solo es obligatorio cuando el usuario responde SÍ.
  // Si está vacío, se permite registrar el material sin código.

  if (!datos.ubicacion) {
    throw new Error("Selecciona una ubicación.");
  }

  const ubicacion = ubicacionesAlmacen.find(
    (item) => item.nombre === datos.ubicacion
  );

  if (!ubicacion) {
    throw new Error("La ubicación seleccionada no existe.");
  }

  if (ubicacion.tieneSubdivisiones && !datos.subdivision) {
    throw new Error("Selecciona una división interna.");
  }

  if (
    datos.subdivision &&
    !ubicacion.subdivisiones.some(
      (division) => division.id === datos.subdivision
    )
  ) {
    throw new Error("La división seleccionada no es válida.");
  }

  if (!ubicacion.tieneSubdivisiones && datos.subdivision) {
    throw new Error("Esta jaba no utiliza subdivisiones.");
  }

  // Evitar códigos duplicados, pero permitir varios registros
  // que no tengan código.
  if (codigo) {
    const codigoNormalizado = codigo.toLowerCase();

    const duplicado = inventario.some(
      (registro) =>
        registro.id !== idExcluir &&
        registro.codigo?.trim().toLowerCase() === codigoNormalizado
    );

    if (duplicado) {
      throw new Error(
        "Ya existe otro registro con este código."
      );
    }
  }

  // Evitar asignar dos materiales activos al mismo espacio interno.
  if (ubicacion.tieneSubdivisiones) {
    const divisionOcupada = inventario.some(
      (registro) =>
        registro.id !== idExcluir &&
        registro.estado === "Activo" &&
        registro.ubicacion === datos.ubicacion &&
        registro.subdivision === datos.subdivision
    );

    if (divisionOcupada) {
      throw new Error(
        "Esta división ya tiene un componente asignado."
      );
    }
  }

  return codigo;
}


export function crearRegistroInventario(datos) {
  const inventario = obtenerInventario();
  const codigo = validarDatos(datos, inventario);

  const nuevoRegistro = {
    id: Date.now(),
    skuId: datos.skuId,
    sku: datos.sku,
    descripcion: datos.descripcion,
    codigo,
    tieneCodigo: Boolean(codigo),
    codigoReemplazo: datos.codigoReemplazo?.trim() || "",
    ubicacion: datos.ubicacion,
    subdivision: datos.subdivision || "",
    observacion: datos.observacion?.trim() || "",
    foto: datos.foto || "",
    estado: "Activo",
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: null,
  };

  guardarInventario([...inventario, nuevoRegistro]);

  registrarEvento({
    modulo: "Inventario",
    accion: "Creación",
    descripcion: `Se registró ${nuevoRegistro.descripcion} en ${nuevoRegistro.ubicacion}${nuevoRegistro.subdivision ? `, división ${nuevoRegistro.subdivision}` : ""}.`,
    referencia: nuevoRegistro.codigo || nuevoRegistro.sku,
    usuario: usuarioActual(),
  });

  return nuevoRegistro;
}

export function editarRegistroInventario(id, datos) {
  const inventario = obtenerInventario();

  const existente = inventario.find(
    (registro) => registro.id === id
  );

  if (!existente) {
    throw new Error(
      "No se encontró el registro que deseas editar."
    );
  }

  const codigo = validarDatos(datos, inventario, id);

  const actualizado = inventario.map((registro) =>
    registro.id === id
      ? {
          ...registro,
          codigo,
          tieneCodigo: Boolean(codigo),
          codigoReemplazo: datos.codigoReemplazo?.trim() || "",
          ubicacion: datos.ubicacion,
          subdivision: datos.subdivision || "",
          observacion: datos.observacion?.trim() || "",

          // Conservar o actualizar fotografía
          foto: datos.foto ?? existente.foto ?? "",

          fechaActualizacion: new Date().toISOString(),
        }
      : registro
  );

  guardarInventario(actualizado);

  registrarEvento({
    modulo: "Inventario",
    accion: "Edición",
    descripcion: `Se actualizaron los datos de ${existente.descripcion}. Ubicación: ${datos.ubicacion}${datos.subdivision ? `, división ${datos.subdivision}` : ""}.`,
    referencia: codigo || existente.sku,
    usuario: usuarioActual(),
  });

  return actualizado;
}


export function cambiarEstadoRegistro(id) {
  const inventario = obtenerInventario();
  const existente = inventario.find((registro) => registro.id === id);

  if (!existente) {
    throw new Error("No se encontró el registro.");
  }

  const nuevoEstado =
    existente.estado === "Activo" ? "Inactivo" : "Activo";

  const actualizado = inventario.map((registro) =>
    registro.id === id
      ? {
          ...registro,
          estado: nuevoEstado,
          fechaActualizacion: new Date().toISOString(),
        }
      : registro
  );

  guardarInventario(actualizado);

  registrarEvento({
    modulo: "Inventario",
    accion: nuevoEstado === "Activo" ? "Activación" : "Desactivación",
    descripcion: `Se ${nuevoEstado === "Activo" ? "activó" : "desactivó"} el registro ${existente.descripcion}.`,
    referencia: existente.codigo || existente.sku,
    usuario: usuarioActual(),
  });

  return actualizado;
}
