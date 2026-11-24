
import { obtenerInventario } from "./inventarioService";
import { obtenerUbicaciones } from "./ubicacionesService";

// =============================================
// CONFIGURACIÓN
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
// NORMALIZAR SINGULAR Y PLURAL
// =============================================

function normalizarComparacion(texto = "") {
  return normalizarTexto(texto)
    .split(" ")
    .map((palabra) => {
      if (palabra.length > 4 && palabra.endsWith("s")) {
        return palabra.slice(0, -1);
      }

      return palabra;
    })
    .join(" ");
}

// =============================================
// LIMPIAR CONSULTA DE VOZ O ESCRITA
// =============================================

export function limpiarConsultaVoz(consulta = "") {
  return normalizarTexto(consulta)
    .split(" ")
    .filter(
      (palabra) =>
        palabra &&
        !PALABRAS_IGNORADAS.includes(palabra)
    )
    .join(" ")
    .trim();
}

// =============================================
// EXTRAER RESPUESTA API
// =============================================

function extraerLista(respuesta, nombre) {
  if (Array.isArray(respuesta)) {
    return respuesta;
  }

  if (Array.isArray(respuesta?.data)) {
    return respuesta.data;
  }

  throw new Error(
    `La API no devolvió una lista válida de ${nombre}.`
  );
}

// =============================================
// CONSULTAR RAILWAY
// =============================================

async function obtenerDatosAlmacen() {
  const [
    respuestaInventario,
    respuestaUbicaciones,
  ] = await Promise.all([
    obtenerInventario(),
    obtenerUbicaciones(),
  ]);

  return {
    inventario: extraerLista(
      respuestaInventario,
      "inventario"
    ),

    ubicaciones: extraerLista(
      respuestaUbicaciones,
      "ubicaciones"
    ),
  };
}

// =============================================
// OBTENER UBICACIÓN REAL
// =============================================

function obtenerDatosUbicacion(registro, ubicaciones) {
  const codigoUbicacion = String(
    registro.ubicacion || ""
  ).trim();

  const ubicacion = ubicaciones.find(
    (item) =>
      String(item.id || item.nombre).trim() ===
      codigoUbicacion
  );

  if (!ubicacion) {
    return null;
  }

  let subdivision = null;

  const codigoSubdivision = String(
    registro.subdivision || ""
  ).trim();

  if (codigoSubdivision) {
    subdivision = (
      ubicacion.subdivisiones || []
    ).find(
      (item) =>
        String(item.id || "").trim() ===
        codigoSubdivision
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

    tieneSubdivisiones: Boolean(
      ubicacion.tieneSubdivisiones
    ),

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

export function generarRespuestaUbicacion(
  registro,
  ubicacion
) {
  const nombreRepuesto =
    registro.descripcion ||
    registro.sku ||
    "El repuesto";

  let respuesta =
    `${nombreRepuesto} se encuentra en el ` +
    `estante ${ubicacion.estante}, ` +
    `piso ${ubicacion.piso}, ` +
    `columna ${ubicacion.columna}`;

  if (ubicacion.subdivision) {
    respuesta +=
      `. División ${ubicacion.subdivision.id}, ` +
      `fila ${ubicacion.subdivision.fila}, ` +
      `columna ${ubicacion.subdivision.columna}`;
  }

  return respuesta + ".";
}

// =============================================
// CONSTRUIR RESULTADO FINAL
// =============================================

function construirResultado(registro, ubicacion) {
  // No permitir redirección sin ubicación válida.

  if (!ubicacion || !ubicacion.estante) {
    return {
      encontrado: false,
      requiereSeleccion: false,

      respuesta: registro
        ? "Encontré el repuesto, pero no pude identificar su ubicación. Consulta con el personal de almacén."
        : "No se encuentra el repuesto que estás buscando.",

      registro,
      ubicacion: null,
      opciones: [],
    };
  }

  return {
    encontrado: true,
    requiereSeleccion: false,

    respuesta: generarRespuestaUbicacion(
      registro,
      ubicacion
    ),

    registro,
    ubicacion,
    opciones: [],
  };
}

// =============================================
// CALCULAR COINCIDENCIA
// =============================================

function calcularCoincidencia(consulta, registro) {
  const consultaNormalizada =
    normalizarComparacion(consulta);

  const campos = [
    registro.descripcion,
    registro.sku,
    registro.codigo,
    registro.codigoReemplazo,
  ]
    .filter(Boolean)
    .map(normalizarComparacion);

  let mejorPuntuacion = 0;

  for (const campo of campos) {
    if (campo === consultaNormalizada) {
      mejorPuntuacion = Math.max(
        mejorPuntuacion,
        100
      );

      continue;
    }

    if (campo.startsWith(consultaNormalizada)) {
      mejorPuntuacion = Math.max(
        mejorPuntuacion,
        85
      );

      continue;
    }

    if (campo.includes(consultaNormalizada)) {
      mejorPuntuacion = Math.max(
        mejorPuntuacion,
        70
      );

      continue;
    }

    const palabrasConsulta =
      consultaNormalizada.split(" ");

    const palabrasCampo = campo.split(" ");

    const coincidencias = palabrasConsulta.filter(
      (palabra) => palabrasCampo.includes(palabra)
    ).length;

    const porcentaje =
      palabrasConsulta.length > 0
        ? coincidencias / palabrasConsulta.length
        : 0;

    if (porcentaje === 1) {
      mejorPuntuacion = Math.max(
        mejorPuntuacion,
        60
      );
    } else if (porcentaje >= 0.6) {
      mejorPuntuacion = Math.max(
        mejorPuntuacion,
        40
      );
    }
  }

  return mejorPuntuacion;
}

// =============================================
// BUSCAR OPCIONES POR PRIMERA PALABRA
// =============================================

function buscarOpcionesPorPrimeraPalabra(
  consulta,
  registrosActivos,
  ubicaciones
) {
  const primeraPalabra = normalizarComparacion(
    consulta.split(" ")[0]
  );

  if (!primeraPalabra) {
    return [];
  }

  const coincidencias = registrosActivos.filter(
    (registro) => {
      const descripcion = normalizarComparacion(
        registro.descripcion || ""
      );

      const primeraPalabraDescripcion =
        descripcion.split(" ")[0];

      return (
        primeraPalabraDescripcion === primeraPalabra
      );
    }
  );

  // Solo mostrar opciones cuando existen dos o más.

  if (coincidencias.length < 2) {
    return [];
  }

  return coincidencias.map((registro) => ({
    registro,

    ubicacion: obtenerDatosUbicacion(
      registro,
      ubicaciones
    ),
  }));
}

// =============================================
// BUSCAR REPUESTO
// =============================================

export async function buscarRepuestoPorVoz(
  consultaOriginal
) {
  const consulta = limpiarConsultaVoz(
    consultaOriginal
  );

  if (!consulta) {
    return {
      encontrado: false,
      requiereSeleccion: false,

      respuesta:
        "Por favor, indica el nombre del repuesto que necesitas.",

      registro: null,
      ubicacion: null,
      opciones: [],
    };
  }

  // Consultar información real de Railway.

  const {
    inventario,
    ubicaciones,
  } = await obtenerDatosAlmacen();

  // Considerar únicamente registros activos.

  const registrosActivos = inventario.filter(
    (registro) => registro.estado === "Activo"
  );

  // ===========================================
  // 1. BUSCAR OPCIONES POR PRIMERA PALABRA
  // ===========================================

  const opciones = buscarOpcionesPorPrimeraPalabra(
    consulta,
    registrosActivos,
    ubicaciones
  );

  // Si el usuario consulta una sola palabra
  // y existen varias opciones, esperar selección.

  if (
    consulta.split(" ").length === 1 &&
    opciones.length >= 2
  ) {
    return {
      encontrado: false,
      requiereSeleccion: true,

      respuesta:
        "Tengo estas opciones con el mismo nombre. Puedes elegir cuál estás buscando.",

      registro: null,
      ubicacion: null,
      opciones,
    };
  }

  // ===========================================
  // 2. BUSCAR COINCIDENCIA EXACTA
  // ===========================================

  const consultaExacta =
    normalizarComparacion(consulta);

  const coincidenciaExacta = registrosActivos.find(
    (registro) => {
      const campos = [
        registro.descripcion,
        registro.sku,
        registro.codigo,
        registro.codigoReemplazo,
      ]
        .filter(Boolean)
        .map(normalizarComparacion);

      return campos.includes(consultaExacta);
    }
  );

  // Si existe coincidencia exacta,
  // ir directamente a su ubicación.

  if (coincidenciaExacta) {
    const ubicacion = obtenerDatosUbicacion(
      coincidenciaExacta,
      ubicaciones
    );

    return construirResultado(
      coincidenciaExacta,
      ubicacion
    );
  }

  // ===========================================
  // 3. BÚSQUEDA GENERAL
  // ===========================================

  const resultados = registrosActivos
    .map((registro, index) => ({
      registro,
      index,

      puntuacion: calcularCoincidencia(
        consulta,
        registro
      ),
    }))
    .filter(
      (resultado) => resultado.puntuacion > 0
    )
    .sort(
      (a, b) =>
        b.puntuacion - a.puntuacion ||
        a.index - b.index
    );

  // ===========================================
  // 4. NO ENCONTRADO
  // ===========================================

  if (resultados.length === 0) {
    return {
      encontrado: false,
      requiereSeleccion: false,

      respuesta:
        "No se encuentra el repuesto que estás buscando.",

      registro: null,
      ubicacion: null,
      opciones: [],
    };
  }

  // ===========================================
  // 5. RESULTADO ENCONTRADO
  // ===========================================

  const registro = resultados[0].registro;

  const ubicacion = obtenerDatosUbicacion(
    registro,
    ubicaciones
  );

  return construirResultado(
    registro,
    ubicacion
  );
}

// =============================================
// BUSCAR POR ESCRITO
// =============================================

// La búsqueda escrita utiliza exactamente
// el mismo motor que la búsqueda por voz.

export async function buscarRepuesto(consulta) {
  return buscarRepuestoPorVoz(consulta);
}

export async function buscarRepuestoPorTexto(
  consulta
) {
  return buscarRepuestoPorVoz(consulta);
}

// =============================================
// SELECCIONAR UNA OPCIÓN
// =============================================

export function seleccionarOpcionRepuesto(opcion) {
  if (!opcion?.registro) {
    return {
      encontrado: false,
      requiereSeleccion: false,

      respuesta:
        "La opción seleccionada no es válida.",

      registro: null,
      ubicacion: null,
      opciones: [],
    };
  }

  // La ubicación solo se devuelve después
  // de que el usuario selecciona una opción.

  return construirResultado(
    opcion.registro,
    opcion.ubicacion
  );
}
