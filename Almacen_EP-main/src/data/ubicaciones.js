
const estantes = ["A", "B"];
const pisos = [1, 2, 3, 4];
const columnas = [1, 2, 3];

// Nueve jabas con subdivisiones 3 x 2.
// Distribución fija para conservar las ubicaciones.
const jabasConDivisiones = [
  // Piso 4: distribución existente


  // Piso 3: cuatro jabas intercaladas
  "A-03-01",
  "A-03-03",
  "B-03-01",
  "B-03-03",

  // Piso 2: todas las jabas
  "A-02-01",
  "A-02-02",
  "A-02-03",
  "B-02-01",
  "B-02-02",
  "B-02-03",
];

const crearSubdivisiones = () =>
  Array.from({ length: 6 }, (_, index) => {
    const numero = index + 1;

    return {
      id: `D-${String(numero).padStart(2, "0")}`,
      nombre: `División ${numero}`,
      fila: Math.ceil(numero / 3),
      columna: ((numero - 1) % 3) + 1,
    };
  });

export const ubicacionesAlmacen = estantes.flatMap((estante) =>
  pisos.flatMap((piso) =>
    columnas.map((columna) => {
      const pisoCodigo = String(piso).padStart(2, "0");
      const columnaCodigo = String(columna).padStart(2, "0");
      const nombre = `${estante}-${pisoCodigo}-${columnaCodigo}`;
      const tieneSubdivisiones = jabasConDivisiones.includes(nombre);

      return {
        id: nombre,
        estante,
        piso,
        columna,
        fila: estante,
        nombre,
        tieneSubdivisiones,
        tipoDivision: tieneSubdivisiones ? "3x2" : null,
        subdivisiones: tieneSubdivisiones
          ? crearSubdivisiones()
          : [],
      };
    }),
  ),
);

export const estantesAlmacen = estantes.map((codigo) => ({
  codigo,
  nombre: `Estante ${codigo}`,
  pisos,
  columnas,
}));
