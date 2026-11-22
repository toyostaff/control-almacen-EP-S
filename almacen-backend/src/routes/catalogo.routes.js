
import { Router } from "express";
import { pool } from "../config/db.js";
import { autenticar, exigirAdmin } from "../middleware/auth.js";
import { registrarEvento } from "../services/auditoria.js";
import { HttpError } from "../utils/httpError.js";

const router = Router();

router.use(autenticar);

// =============================================
// MAPEAR REGISTROS DEL CATÁLOGO
// =============================================

function mapearMaterial(r) {
  return {
    id: r.id,
    sku: r.sku,
    descripcion: r.descripcion,
    fechaCreacion: r.fechaCreacion,
    estado: r.estado,
  };
}

// =============================================
// VALIDAR ID
// =============================================

function validarId(id) {
  if (!/^[1-9]\d*$/.test(String(id))) {
    throw new HttpError(400, "El identificador del material no es válido.");
  }
}

// =============================================
// CONSULTAR CATÁLOGO MAESTRO
// =============================================

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        sku,
        descripcion,
        DATE_FORMAT(fecha_creacion, '%Y-%m-%d') AS fechaCreacion,
        estado
      FROM catalogo
      ORDER BY id ASC
    `);

    res.json({
      ok: true,
      data: rows.map(mapearMaterial),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// CREAR MATERIAL
// SOLO ADMINISTRADOR
// =============================================

router.post("/", exigirAdmin, async (req, res, next) => {
  let conn;
  let transaccionIniciada = false;
  let bloqueoAdquirido = false;

  try {
    const descripcion = String(req.body.descripcion || "").trim();

    if (!descripcion) {
      throw new HttpError(400, "La descripción es obligatoria.");
    }

    if (descripcion.length > 255) {
      throw new HttpError(
        400,
        "La descripción no puede superar los 255 caracteres."
      );
    }

    conn = await pool.getConnection();

    // Evitar que dos solicitudes generen el mismo SKU
    const [lockRows] = await conn.execute(
      "SELECT GET_LOCK(?, 10) AS adquirido",
      ["control_almacen_catalogo_create"]
    );

    if (Number(lockRows[0].adquirido) !== 1) {
      throw new HttpError(
        503,
        "No se pudo reservar la generación del SKU. Intenta nuevamente."
      );
    }

    bloqueoAdquirido = true;

    await conn.beginTransaction();
    transaccionIniciada = true;

    // Comprobar descripción duplicada
    const [duplicados] = await conn.execute(
      `SELECT id
       FROM catalogo
       WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM(?))
       LIMIT 1
       FOR UPDATE`,
      [descripcion]
    );

    if (duplicados.length) {
      throw new HttpError(
        409,
        "Ya existe un material con esta descripción."
      );
    }

    // Obtener el siguiente número de SKU
    const [maxRows] = await conn.query(`
      SELECT
        COALESCE(
          MAX(CAST(SUBSTRING(sku, 5) AS UNSIGNED)),
          0
        ) + 1 AS siguiente
      FROM catalogo
      WHERE sku REGEXP '^SKU-[0-9]+$'
    `);

    const siguiente = Number(maxRows[0].siguiente);

    if (!Number.isSafeInteger(siguiente) || siguiente < 1) {
      throw new HttpError(
        500,
        "No se pudo generar el siguiente código SKU."
      );
    }

    const sku = `SKU-${String(siguiente).padStart(4, "0")}`;

    // Registrar material y fecha obligatoria
    const [resultado] = await conn.execute(
      `INSERT INTO catalogo (
        sku,
        descripcion,
        fecha_creacion
      )
      VALUES (?, ?, CURDATE())`,
      [sku, descripcion]
    );

    // Registrar actividad
    await registrarEvento(conn, {
      modulo: "Catálogo Maestro",
      accion: "Creación",
      descripcion: `Se creó el material ${descripcion}.`,
      referencia: sku,
      usuarioId: req.usuario.sub,
      usuario: req.usuario.nombre,
    });

    await conn.commit();
    transaccionIniciada = false;

    // Recuperar registro guardado
    const [rows] = await pool.execute(
      `SELECT
        id,
        sku,
        descripcion,
        DATE_FORMAT(fecha_creacion, '%Y-%m-%d') AS fechaCreacion,
        estado
      FROM catalogo
      WHERE id = ?`,
      [resultado.insertId]
    );

    res.status(201).json({
      ok: true,
      data: mapearMaterial(rows[0]),
    });

  } catch (error) {
    if (conn && transaccionIniciada) {
      await conn.rollback().catch(() => {});
    }

    next(error);

  } finally {
    if (conn) {
      if (bloqueoAdquirido) {
        await conn.execute(
          "SELECT RELEASE_LOCK(?)",
          ["control_almacen_catalogo_create"]
        ).catch(() => {});
      }

      conn.release();
    }
  }
});

// =============================================
// EDITAR MATERIAL
// SOLO ADMINISTRADOR
// =============================================

router.put("/:id", exigirAdmin, async (req, res, next) => {
  let conn;
  let transaccionIniciada = false;

  try {
    validarId(req.params.id);

    const descripcion = String(req.body.descripcion || "").trim();

    if (!descripcion) {
      throw new HttpError(400, "La descripción es obligatoria.");
    }

    if (descripcion.length > 255) {
      throw new HttpError(
        400,
        "La descripción no puede superar los 255 caracteres."
      );
    }

    conn = await pool.getConnection();

    await conn.beginTransaction();
    transaccionIniciada = true;

    // Buscar material original y bloquear su registro
    const [oldRows] = await conn.execute(
      `SELECT *
       FROM catalogo
       WHERE id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (!oldRows.length) {
      throw new HttpError(404, "No se encontró el material.");
    }

    const materialAnterior = oldRows[0];

    // Comprobar que no exista otra descripción igual
    const [duplicados] = await conn.execute(
      `SELECT id
       FROM catalogo
       WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM(?))
       AND id <> ?
       LIMIT 1`,
      [descripcion, req.params.id]
    );

    if (duplicados.length) {
      throw new HttpError(
        409,
        "Ya existe otro material con esta descripción."
      );
    }

    // Actualizar descripción y fecha de modificación
    await conn.execute(
      `UPDATE catalogo
       SET
         descripcion = ?,
         actualizado_en = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
       WHERE id = ?`,
      [descripcion, req.params.id]
    );

    await registrarEvento(conn, {
      modulo: "Catálogo Maestro",
      accion: "Edición",
      descripcion:
        `Se modificó el material ${materialAnterior.descripcion} ` +
        `por ${descripcion}.`,
      referencia: materialAnterior.sku,
      usuarioId: req.usuario.sub,
      usuario: req.usuario.nombre,
    });

    await conn.commit();
    transaccionIniciada = false;

    const [rows] = await pool.execute(
      `SELECT
        id,
        sku,
        descripcion,
        DATE_FORMAT(fecha_creacion, '%Y-%m-%d') AS fechaCreacion,
        estado
       FROM catalogo
       WHERE id = ?`,
      [req.params.id]
    );

    res.json({
      ok: true,
      data: mapearMaterial(rows[0]),
    });

  } catch (error) {
    if (conn && transaccionIniciada) {
      await conn.rollback().catch(() => {});
    }

    next(error);

  } finally {
    if (conn) {
      conn.release();
    }
  }
});

// =============================================
// ACTIVAR / DESACTIVAR MATERIAL
// SOLO ADMINISTRADOR
// =============================================

router.patch("/:id/estado", exigirAdmin, async (req, res, next) => {
  let conn;
  let transaccionIniciada = false;

  try {
    validarId(req.params.id);

    conn = await pool.getConnection();

    await conn.beginTransaction();
    transaccionIniciada = true;

    const [rows] = await conn.execute(
      `SELECT *
       FROM catalogo
       WHERE id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      throw new HttpError(404, "No se encontró el material.");
    }

    const material = rows[0];

    const estado =
      material.estado === "Activo" ? "Inactivo" : "Activo";

    await conn.execute(
      `UPDATE catalogo
       SET
         estado = ?,
         actualizado_en = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
       WHERE id = ?`,
      [estado, req.params.id]
    );

    await registrarEvento(conn, {
      modulo: "Catálogo Maestro",
      accion: estado === "Activo" ? "Activación" : "Desactivación",
      descripcion:
        `Se ${estado === "Activo" ? "activó" : "desactivó"} ` +
        `el material ${material.descripcion}.`,
      referencia: material.sku,
      usuarioId: req.usuario.sub,
      usuario: req.usuario.nombre,
    });

    await conn.commit();
    transaccionIniciada = false;

    const [updatedRows] = await pool.execute(
      `SELECT
        id,
        sku,
        descripcion,
        DATE_FORMAT(fecha_creacion, '%Y-%m-%d') AS fechaCreacion,
        estado
       FROM catalogo
       WHERE id = ?`,
      [req.params.id]
    );

    res.json({
      ok: true,
      data: mapearMaterial(updatedRows[0]),
    });

  } catch (error) {
    if (conn && transaccionIniciada) {
      await conn.rollback().catch(() => {});
    }

    next(error);

  } finally {
    if (conn) {
      conn.release();
    }
  }
});

export default router