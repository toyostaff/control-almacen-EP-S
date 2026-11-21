
import { obtenerInventario } from "./inventarioService";
import { ubicacionesAlmacen } from "../data/ubicaciones";

/* =========================================
   CONFIGURACIÓN DE BÚSQUEDA
========================================= */

const PALABRAS_IGNORADAS = [
  "necesito",
  "busco",
  "buscar",
  "quiero",
  "dame",
  "donde",
  "esta",
  "encuentra",
  "encuentro",
  "ubicacion",
  "localiza",
  "encontrar",
  "por favor",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "por",
  "favor",
  "hay",
  "tienes",
  "tienen",
  "me",
  "puedes",
  "indica",
  "repuesto",
];

/* =========================================
   NORMALIZAR TEXTO
========================================= */

export function normalizarTexto(texto = "") {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================
   LIMPIAR CONSULTA DE VOZ
========================================= */

export function limpiarConsultaVoz(consulta = "") {
  let texto = normalizarTexto(consulta);

  const palabras = texto
    .split(" ")
    .filter(
      (palabra) =>
        palabra &&
        !PALABRAS_IGNORADAS.includes(palabra)
    );

  return palabras.join(" ").trim();
}

/* =========================================
   OBTENER INFORMACIÓN DE UBICACIÓN
========================================= */

function obtenerDatosUbicacion(registro) {
  const ubicacion = ubicacionesAlmacen.find(
    (item) => item.nombre === registro.ubicacion
  );

  if (!ubicacion) {
    return null;
  }

  let subdivision = null;

  if (registro.subdivision) {
    subdivision = ubicacion.subdivisiones.find(
      (item) => item.id === registro.subdivision
    );

    if (!subdivision) {
      return null;
    }
  }

  return {
    estante: ubicacion.estante,
    piso: ubicacion.piso,
    columna: ubicacion.columna,
    codigo: ubicacion.nombre,

    tieneSubdivisiones: ubicacion.tieneSubdivisiones,

    subdivision: subdivision
      ? {
          id: subdivision.id,
          nombre: subdivision.nombre,
          fila: subdivision.fila,
          columna: subdivision.columna,
        }
      : null,
  };
}

/* =========================================
   GENERAR RESPUESTA HABLADA
========================================= */

export function generarRespuestaUbicacion(registro, ubicacion) {
  const nombreRepuesto =
    registro.descripcion || registro.sku || "El repuesto";

  let respuesta =
    `${nombreRepuesto} se encuentra en el estante ${ubicacion.estante}, ` +
    `piso ${ubicacion.piso}, columna ${ubicacion.columna}`;

  if (ubicacion.subdivision) {
    respuesta +=
      `. Tiene subdivisión ${ubicacion.subdivision.id}, ` +
      `fila ${ubicacion.subdivision.fila}, ` +
      `columna ${ubicacion.subdivision.columna}`;
  }

  return respuesta + ".";
}

/* =========================================
   CALCULAR COINCIDENCIA
========================================= */

function calcularCoincidencia(consulta, registro) {
  const campos = [
    registro.descripcion,
    registro.sku,
    registro.codigo,
    registro.codigoReemplazo,
  ]
    .filter(Boolean)
    .map(normalizarTexto);

  let mejorPuntuacion = 0;

  for (const campo of campos) {
    if (campo === consulta) {
      mejorPuntuacion = Math.max(mejorPuntuacion, 100);
      continue;
    }

    if (campo.startsWith(consulta)) {
      mejorPuntuacion = Math.max(mejorPuntuacion, 85);
      continue;
    }

    if (campo.includes(consulta)) {
      mejorPuntuacion = Math.max(mejorPuntuacion, 70);
      continue;
    }

    const palabrasConsulta = consulta.split(" ");
    const palabrasCampo = campo.split(" ");

    const coincidencias = palabrasConsulta.filter(
      (palabra) => palabrasCampo.includes(palabra)
    ).length;

    const porcentaje =
      coincidencias / palabrasConsulta.length;

    if (porcentaje === 1) {
      mejorPuntuacion = Math.max(mejorPuntuacion, 60);
    } else if (porcentaje >= 0.6) {
      mejorPuntuacion = Math.max(mejorPuntuacion, 40);
    }
  }

  return mejorPuntuacion;
}

/* =========================================
   BUSCAR REPUESTO EN INVENTARIO
========================================= */

export function buscarRepuestoPorVoz(consultaOriginal) {
  const consulta = limpiarConsultaVoz(consultaOriginal);

  if (!consulta) {
    return {
      encontrado: false,
      respuesta: "Por favor, indica el nombre del repuesto que necesitas.",
      registro: null,
      ubicacion: null,
    };
  }

  const inventario = obtenerInventario();

  // Solo se consideran registros activos.
  const registrosActivos = inventario.filter(
    (registro) => registro.estado === "Activo"
  );

  // Calcular coincidencias y conservar su orden original.
  const resultados = registrosActivos
    .map((registro, index) => ({
      registro,
      index,
      puntuacion: calcularCoincidencia(consulta, registro),
    }))
    .filter((resultado) => resultado.puntuacion > 0)
    .sort(
      (a, b) =>
        b.puntuacion - a.puntuacion ||
        a.index - b.index
    );

  if (resultados.length === 0) {
    return {
      encontrado: false,
      respuesta: "No se encuentra el repuesto que estás buscando.",
      registro: null,
      ubicacion: null,
    };
  }

  // Seleccionar automáticamente la coincidencia más exacta.
  const registro = resultados[0].registro;

  const ubicacion = obtenerDatosUbicacion(registro);

  if (!ubicacion) {
    return {
      encontrado: false,
      respuesta:
        "Encontré el repuesto, pero no pude identificar su ubicación. Consulta con el personal de almacén.",
      registro: null,
      ubicacion: null,
    };
  }

  return {
    encontrado: true,
    respuesta: generarRespuestaUbicacion(registro, ubicacion),
    registro,
    ubicacion,
  };
}
