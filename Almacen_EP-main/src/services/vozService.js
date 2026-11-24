
import { obtenerInventario } from "./inventarioService";
import { obtenerUbicaciones } from "./ubicacionesService";

// =============================================
// CONFIGURACIÓN
// =============================================

const PALABRAS_IGNORADAS = [
  "necesito", "busco", "buscar", "quiero", "dame",
  "donde", "esta", "encuentra", "encuentro",
  "ubicacion", "localiza", "encontrar", "por",
  "favor", "el", "la", "los", "las", "un", "una",
  "de", "del", "hay", "tienes", "tienen", "me",
  "puedes", "indica", "repuesto", "material"
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
// LIMPIAR CONSULTA
// =============================================

export function limpiarConsultaVoz(consulta = "") {
  return normalizarTexto(consulta)
    .split(" ")
    .filter(
      palabra =>
        palabra && !PALABRAS_IGNORADAS.includes(palabra)
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
  const [respuestaInventario, respuestaUbicaciones] =
    await Promise.all([
      obtenerInventario(),
      obtenerUbicaciones()
    ]);

  return {
    inventario: extraerLista(
      respuestaInventario,
      "inventario"
    ),
    ubicaciones: extraerLista(
      respuestaUbicaciones,
      "ubicaciones"
    )
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
    item =>
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
    subdivision = (ubicacion.subdivisiones || []).find(
      item =>
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
          ocupada: Boolean(subdivision.ocupada)
        }
      : null
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
    registro.descripcion || registro.sku || "El repuesto";

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
  // CORRECCIÓN: no permitir redirección
  // cuando no existe una ubicación válida.

  if (!ubicacion) {
    return {
      encontrado: false,
      requiereSeleccion: false,
      respuesta: registro
        ? "Encontré el repuesto, pero no pude identificar su ubicación. Consulta con el personal de almacén."
        : "No se encuentra el repuesto que estás buscando.",
      registro: null,
      ubicacion: null
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
    ubicacion
  };
}


// =============================================
// CALCULAR COINCIDENCIA
// =============================================

function calcularCoincidencia(consulta, registro) {
  const campos = [
    registro.descripcion,
    registro.sku,
    registro.codigo,
    registro.codigoReemplazo
  ]
    .filter(Boolean)
    .map(normalizarTexto);

  let mejorPuntuacion = 0;

  for (const campo of campos) {
    if (campo === consulta) {
      mejorPuntuacion = Math.max(
        mejorPuntuacion, 100
      );
      continue;
    }

    if (campo.startsWith(consulta)) {
      mejorPuntuacion = Math.max(
        mejorPuntuacion, 85
      );
      continue;
    }

    if (campo.includes(consulta)) {
      mejorPuntuacion = Math.max(
        mejorPuntuacion, 70
      );
      continue;
    }

    const palabrasConsulta = consulta.split(" ");
    const palabrasCampo = campo.split(" ");

    const coincidencias = palabrasConsulta.filter(
      palabra => palabrasCampo.includes(palabra)
    ).length;

    const porcentaje =
      coincidencias / palabrasConsulta.length;

    if (porcentaje === 1) {
      mejorPuntuacion = Math.max(
        mejorPuntuacion, 60
      );
    } else if (porcentaje >= 0.6) {
      mejorPuntuacion = Math.max(
        mejorPuntuacion, 40
      );
    }
  }

  return mejorPuntuacion;
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
      opciones: []
    };
  }

  const { inventario, ubicaciones } =
    await obtenerDatosAlmacen();

  const registrosActivos = inventario.filter(
    registro => registro.estado === "Activo"
  );

  // 1. BUSCAR COINCIDENCIA EXACTA

  const coincidenciaExacta = registrosActivos.find(
    registro => {
      const campos = [
        registro.descripcion,
        registro.sku,
        registro.codigo,
        registro.codigoReemplazo
      ]
        .filter(Boolean)
        .map(normalizarTexto);

      return campos.includes(consulta);
    }
  );

  // Si existe coincidencia exacta, no mostrar opciones.

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

  // 2. BUSCAR OPCIONES POR PRIMERA PALABRA

  const palabras = consulta.split(" ");

  if (palabras.length === 1) {
    const opcionesIniciales = registrosActivos.filter(
      registro => {
        const descripcion = normalizarTexto(
          registro.descripcion
        );

        return descripcion.startsWith(
          consulta + " "
        );
      }
    );

    // Mostrar opciones solamente cuando existan 2 o más.

    if (opcionesIniciales.length >= 2) {
      const opciones = opcionesIniciales.map(
        registro => ({
          registro,
          ubicacion: obtenerDatosUbicacion(
            registro,
            ubicaciones
          )
        })
      );

      return {
        encontrado: false,
        requiereSeleccion: true,
        respuesta:
          "Tengo estas opciones con el mismo nombre. Puedes elegir cuál estás buscando.",
        registro: null,
        ubicacion: null,
        opciones
      };
    }
  }

  // 3. BÚSQUEDA GENERAL

  const resultados = registrosActivos
    .map((registro, index) => ({
      registro,
      index,
      puntuacion: calcularCoincidencia(
        consulta,
        registro
      )
    }))
    .filter(resultado => resultado.puntuacion > 0)
    .sort(
      (a, b) =>
        b.puntuacion - a.puntuacion ||
        a.index - b.index
    );

  if (resultados.length === 0) {
    return {
      encontrado: false,
      requiereSeleccion: false,
      respuesta:
        "No se encuentra el repuesto que estás buscando.",
      registro: null,
      ubicacion: null,
      opciones: []
    };
  }

  const registro = resultados[0].registro;

  const ubicacion = obtenerDatosUbicacion(
    registro,
    ubicaciones
  );

  return construirResultado(registro, ubicacion);
}

// =============================================
// SELECCIONAR UNA OPCIÓN
// =============================================

export function seleccionarOpcionRepuesto(opcion) {
  if (!opcion?.registro) {
    return {
      encontrado: false,
      respuesta: "La opción seleccionada no es válida.",
      registro: null,
      ubicacion: null
    };
  }

  return construirResultado(
    opcion.registro,
    opcion.ubicacion
  );
}
