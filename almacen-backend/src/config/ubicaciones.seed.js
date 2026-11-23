
import { pool } from "./db.js";

const estantes = ["A", "B"];
const pisos = [1, 2, 3, 4];
const columnas = [1, 2, 3];

// Jabas que tienen seis subdivisiones.
const jabasConDivisiones = [
  "A-02-01",
  "A-02-02",
  "A-02-03",
  "A-03-01",
  "A-03-03",

  "B-02-01",
  "B-02-02",
  "B-02-03",
  "B-03-01",
  "B-03-03",
];

function crearSubdivisiones() {
  return Array.from({ length: 6 }, (_, index) => {
    const numero = index + 1;

    return {
      codigo: `D-${String(numero).padStart(2, "0")}`,
      nombre: `División ${numero}`,
      fila: Math.ceil(numero / 3),
      columna: ((numero - 1) % 3) + 1,
    };
  });
}

export async function inicializarUbicaciones() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let totalUbicaciones = 0;
    let totalSubdivisiones = 0;

    for (const estante of estantes) {
      for (const piso of pisos) {
        for (const columna of columnas) {

          const id = `${estante}-${String(piso).padStart(2, "0")}-${String(columna).padStart(2, "0")}`;

          const tieneSubdivisiones =
            jabasConDivisiones.includes(id);

          // Registrar o actualizar ubicación.
          await connection.execute(
            `INSERT INTO ubicaciones
              (id, estante, piso, columna_num,
               tiene_subdivisiones, tipo_division)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               estante = VALUES(estante),
               piso = VALUES(piso),
               columna_num = VALUES(columna_num),
               tiene_subdivisiones = VALUES(tiene_subdivisiones),
               tipo_division = VALUES(tipo_division)`,
            [
              id,
              estante,
              piso,
              columna,
              tieneSubdivisiones ? 1 : 0,
              tieneSubdivisiones ? "3x2" : null,
            ]
          );

          totalUbicaciones++;

          // Registrar las seis subdivisiones.
          if (tieneSubdivisiones) {
            for (const division of crearSubdivisiones()) {

              await connection.execute(
                `INSERT INTO subdivisiones
                  (ubicacion_id, codigo, nombre,
                   fila_num, columna_num)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   nombre = VALUES(nombre),
                   fila_num = VALUES(fila_num),
                   columna_num = VALUES(columna_num)`,
                [
                  id,
                  division.codigo,
                  division.nombre,
                  division.fila,
                  division.columna,
                ]
              );

              totalSubdivisiones++;
            }
          }
        }
      }
    }

    await connection.commit();

    console.log("--------------------------------");
    console.log("INICIALIZACIÓN DE UBICACIONES");
    console.log("--------------------------------");
    console.log(`Ubicaciones verificadas: ${totalUbicaciones}`);
    console.log(`Subdivisiones verificadas: ${totalSubdivisiones}`);
    console.log("Proceso completado correctamente.");
    console.log("--------------------------------");

    return {
      ubicaciones: totalUbicaciones,
      subdivisiones: totalSubdivisiones,
    };

  } catch (error) {
    await connection.rollback();

    console.error(
      "Error inicializando ubicaciones:",
      error.message
    );

    throw error;

  } finally {
    connection.release();
  }
}



