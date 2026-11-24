import { obtenerInventario } from "./inventarioService";
import { obtenerUbicaciones } from "./ubicacionesService";

// =============================================
// CONFIGURACIÓN DE BÚSQUEDA
// =============================================

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
  "por",
  "favor",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "hay",
  "tienes",
  "tienen",
  "me",
  "puedes",
  "indica",
  "repuesto",
  "material",
];

// =============================================
// NORMALIZAR TEXTO
// =============================================

export function normalizarTexto(texto = "") {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// =============================================
// LIMPIAR CONSULTA DE VOZ
// =============================================

export function limpiarConsultaVoz(consulta = "") {
  const texto = normalizarTexto(consulta);

  return texto
    .split(" ")
    .filter((palabra) => palabra && !PALABRAS_IGNORADAS.includes(palabra))
    .join(" ")
    .trim();
}

// =============================================
// EXTRAER DATOS DE LA RESPUESTA API
// =============================================

function extraerLista(respuesta, nombre) {
  if (Array.isArray(respuesta)) {
    return respuesta;
  }

  if (Array.isArray(respuesta?.data)) {
    return respuesta.data;
  }

  throw new Error(`La API no devolvió una lista válida de ${nombre}.`);
}

// =============================================
// CONSULTAR INFORMACIÓN DESDE RAILWAY
// =============================================

async function obtenerDatosAlmacen() {
  const [respuestaInventario, respuestaUbicaciones] = await Promise.all([
    obtenerInventario(),
    obtenerUbicaciones(),
  ]);

  const inventario = extraerLista(respuestaInventario, "inventario");

  const ubicaciones = extraerLista(respuestaUbicaciones, "ubicaciones");

  return {
    inventario,
    ubicaciones,
  };
}

// =============================================
// OBTENER INFORMACIÓN DE UBICACIÓN
// =============================================

function obtenerDatosUbicacion(registro, ubicaciones) {
  const codigoUbicacion = String(registro.ubicacion || "").trim();

  const ubicacion = ubicaciones.find(
    (item) => String(item.id || item.nombre).trim() === codigoUbicacion,
  );

  if (!ubicacion) {
    return null;
  }

  let subdivision = null;

  const codigoSubdivision = String(registro.subdivision || "").trim();

  if (codigoSubdivision) {
    subdivision = (ubicacion.subdivisiones || []).find(
      (item) => String(item.id || "").trim() === codigoSubdivision,
    );

    if (!subdivision) {
      return null;
    }
  }

  return {
    estante: ubicacion.estante,
    piso: Number(ubicacion.piso),
    columna: Number(ubicacion.columna),
    codigo: ubicacion.nombre || ubicacion.id,

    tieneSubdivisiones: Boolean(ubicacion.tieneSubdivisiones),

    subdivision: subdivision
      ? {
          id: subdivision.id,
          nombre: subdivision.nombre,
          fila: Number(subdivision.fila),
          columna: Number(subdivision.columna),
          ocupada: Boolean(subdivision.ocupada),
        }
      : null,
  };
}

// =============================================
// GENERAR RESPUESTA HABLADA
// =============================================

export function generarRespuestaUbicacion(registro, ubicacion) {
  const nombreRepuesto = registro.descripcion || registro.sku || "El repuesto";

  let respuesta =
    `${nombreRepuesto} se encuentra en el ` +
    `estante ${ubicacion.estante}, ` +
    `piso ${ubicacion.piso}, ` +
    `columna ${ubicacion.columna}`;

  if (ubicacion.subdivision) {
    respuesta +=
      `. Tiene subdivisión ${ubicacion.subdivision.id}, ` +
      `fila ${ubicacion.subdivision.fila}, ` +
      `columna ${ubicacion.subdivision.columna}`;
  }

  return respuesta + ".";
}

// =============================================
// CALCULAR COINCIDENCIA
// =============================================

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

    const coincidencias = palabrasConsulta.filter((palabra) =>
      palabrasCampo.includes(palabra),
    ).length;

    const porcentaje = coincidencias / palabrasConsulta.length;

    if (porcentaje === 1) {
      mejorPuntuacion = Math.max(mejorPuntuacion, 60);
    } else if (porcentaje >= 0.6) {
      mejorPuntuacion = Math.max(mejorPuntuacion, 40);
    }
  }

  return mejorPuntuacion;
}

// =============================================
// BUSCAR REPUESTO EN INVENTARIO DE RAILWAY
// =============================================

export async function buscarRepuestoPorVoz(consultaOriginal) {
  const consulta = limpiarConsultaVoz(consultaOriginal);

  if (!consulta) {
    return {
      encontrado: false,
      respuesta: "Por favor, indica el nombre del repuesto que necesitas.",
      registro: null,
      ubicacion: null,
    };
  } // Consultar inventario y ubicaciones reales.

  const { inventario, ubicaciones } = await obtenerDatosAlmacen(); // Considerar únicamente registros activos.

  const registrosActivos = inventario.filter(
    (registro) => registro.estado === "Activo",
  ); // Calcular coincidencias.

  const resultados = registrosActivos
    .map((registro, index) => ({
      registro,
      index,
      puntuacion: calcularCoincidencia(consulta, registro),
    }))
    .filter((resultado) => resultado.puntuacion > 0)
    .sort((a, b) => b.puntuacion - a.puntuacion || a.index - b.index);

  if (resultados.length === 0) {
    return {
      encontrado: false,
      respuesta: "No se encuentra el repuesto que estás buscando.",
      registro: null,
      ubicacion: null,
    };
  } // Seleccionar la coincidencia más exacta.

  const registro = resultados[0].registro; // Consultar su ubicación real en Railway.

  const ubicacion = obtenerDatosUbicacion(registro, ubicaciones);

  if (!ubicacion) {
    return {
      encontrado: false,
      respuesta:
        "Encontré el repuesto, pero no pude identificar su ubicación. Consulta con el personal de almacén.",
      registro,
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
