
import { Router } from "express";

import { pool } from "../config/db.js";
import { autenticar } from "../middleware/auth.js";

const router = Router();

router.use(autenticar);

// =============================================
// CONSULTAR UBICACIONES Y SUBDIVISIONES
// =============================================

router.get("/", async (req, res, next) => {
  try {

    // Consultar ubicaciones
    const [ubicaciones] = await pool.query(`
      SELECT
        id,
        estante,
        piso,
        columna_num,
        tiene_subdivisiones,
        tipo_division
      FROM ubicaciones
      ORDER BY estante, piso, columna_num
    `);

    // Consultar subdivisiones
    const [subdivisiones] = await pool.query(`
      SELECT
        id,
        ubicacion_id,
        codigo,
        nombre,
        fila_num,
        columna_num
      FROM subdivisiones
      ORDER BY ubicacion_id, fila_num, columna_num
    `);

    // Consultar ocupación por ubicación y subdivisión
    const [inventario] = await pool.query(`
      SELECT
        ubicacion_id,
        subdivision_codigo,
        COUNT(*) AS cantidad
      FROM inventario
      WHERE estado = 'Activo'
      GROUP BY ubicacion_id, subdivision_codigo
    `);

    // Agrupar subdivisiones por ubicación
    const subdivisionesPorUbicacion = new Map();

    for (const subdivision of subdivisiones) {

      const clave = String(subdivision.ubicacion_id);

      if (!subdivisionesPorUbicacion.has(clave)) {
        subdivisionesPorUbicacion.set(clave, []);
      }

      subdivisionesPorUbicacion.get(clave).push(
        subdivision
      );
    }

    // Agrupar ocupación por ubicación
    const ocupacionPorUbicacion = new Map();

    for (const registro of inventario) {

      const clave = String(registro.ubicacion_id);

      if (!ocupacionPorUbicacion.has(clave)) {
        ocupacionPorUbicacion.set(clave, []);
      }

      ocupacionPorUbicacion.get(clave).push(registro);
    }

    // Construir respuesta
    const data = ubicaciones.map((ubicacion) => {

      const id = String(ubicacion.id);

      const tieneSubdivisiones = Boolean(
        ubicacion.tiene_subdivisiones
      );

      const subdivisionesUbicacion =
        subdivisionesPorUbicacion.get(id) || [];

      const registrosInventario =
        ocupacionPorUbicacion.get(id) || [];

      const subdivisionesData = subdivisionesUbicacion.map(
        (subdivision) => {

          const registro = registrosInventario.find(
            (item) =>
              String(item.subdivision_codigo || "") ===
              String(subdivision.codigo)
          );

          const cantidad = Number(registro?.cantidad || 0);

          return {
            id: subdivision.codigo,
            nombre: subdivision.nombre,
            fila: Number(subdivision.fila_num),
            columna: Number(subdivision.columna_num),
            ocupada: cantidad > 0,
            componentes: cantidad,
          };
        }
      );

      const ocupados = tieneSubdivisiones
        ? subdivisionesData.filter(
            (subdivision) => subdivision.ocupada
          ).length
        : registrosInventario.reduce(
            (total, registro) =>
              total + Number(registro.cantidad),
            0
          );

      const capacidad = tieneSubdivisiones
        ? subdivisionesData.length
        : 1;

      return {
        id: ubicacion.id,
        estante: ubicacion.estante,
        piso: Number(ubicacion.piso),
        columna: Number(ubicacion.columna_num),

        // Se conserva por compatibilidad con el frontend
        fila: ubicacion.estante,

        nombre: ubicacion.id,

        tieneSubdivisiones,

        tipoDivision: ubicacion.tipo_division,

        subdivisiones: subdivisionesData,

        ocupados,

        capacidad,

        disponibles: Math.max(0, capacidad - ocupados),
      };
    });

    return res.status(200).json({
      ok: true,
      data,
    });

  } catch (error) {
    next(error);
  }
});

// =============================================
// CONSULTAR OCUPACIÓN REAL DEL ALMACÉN
// =============================================

router.get("/ocupacion", async (req, res, next) => {
  try {

    const [rows] = await pool.query(`
      SELECT
        u.id AS ubicacion,
        u.tiene_subdivisiones,

        (
          SELECT COUNT(*)
          FROM subdivisiones s
          WHERE s.ubicacion_id = u.id
        ) AS capacidad_divisiones,

        (
          SELECT COUNT(
            DISTINCT
            CASE
              WHEN u.tiene_subdivisiones = 1
                THEN NULLIF(i.subdivision_codigo, '')
              ELSE CAST(i.id AS CHAR)
            END
          )
          FROM inventario i
          WHERE i.ubicacion_id = u.id
            AND i.estado = 'Activo'
        ) AS ocupados

      FROM ubicaciones u

      ORDER BY
        u.estante,
        u.piso,
        u.columna_num
    `);

    const data = rows.map((registro) => {

      const tieneSubdivisiones = Boolean(
        registro.tiene_subdivisiones
      );

      const ocupados = Number(registro.ocupados || 0);

      const capacidad = tieneSubdivisiones
        ? Number(registro.capacidad_divisiones)
        : 1;

      return {
        ubicacion: registro.ubicacion,

        ocupados,

        capacidad,

        disponibles: Math.max(
          0,
          capacidad - ocupados
        ),
      };
    });

    return res.status(200).json({
      ok: true,
      data,
    });

  } catch (error) {
    next(error);
  }
});

export default router;
