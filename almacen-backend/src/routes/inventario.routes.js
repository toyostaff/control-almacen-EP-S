
import { Router } from "express";

import { pool } from "../config/db.js";
import { autenticar } from "../middleware/auth.js";
import { registrarEvento } from "../services/auditoria.js";
import { guardarFoto, eliminarFoto } from "../services/fotos.js";
import { HttpError } from "../utils/httpError.js";

const router = Router();

router.use(autenticar);

// =============================================
// UTILIDADES
// =============================================

function validarId(id) {
  if (!/^[1-9]\d*$/.test(String(id))) {
    throw new HttpError(400, "El identificador no es válido.");
  }
}

function fechaActual() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

// =============================================
// MAPEAR REGISTROS DE MYSQL
// =============================================

function mapRow(r) {
  return {
    id: r.id,
    skuId: r.sku_id,
    sku: r.sku,
    descripcion: r.descripcion,
    codigo: r.codigo || "",
    tieneCodigo: Boolean(r.tiene_codigo),
    codigoReemplazo: r.codigo_reemplazo || "",
    ubicacion: r.ubicacion_id,
    subdivision: r.subdivision_codigo || "",
    observacion: r.observacion || "",
    foto: r.foto_url || "",
    estado: r.estado,
    fechaCreacion: r.fecha_creacion || "",
    fechaActualizacion: r.fecha_actualizacion || "",
  };
}

// =============================================
// VALIDAR DATOS DEL INVENTARIO
// =============================================

async function validar(conn, d, id = null) {

  // -------------------------------------------
  // VALIDAR MATERIAL DEL CATÁLOGO
  // -------------------------------------------

  const skuId = Number(d.skuId);

  if (!Number.isInteger(skuId) || skuId <= 0) {
    throw new HttpError(
      400,
      "Debes seleccionar un material del Catálogo Maestro."
    );
  }

  const [mat] = await conn.execute(
    `SELECT id, sku, descripcion, estado
     FROM catalogo
     WHERE id = ?
     LIMIT 1`,
    [skuId]
  );

  if (!mat.length || mat[0].estado !== "Activo") {
    throw new HttpError(
      400,
      "El material seleccionado no existe o está inactivo."
    );
  }

  // -------------------------------------------
  // VALIDAR UBICACIÓN
  // -------------------------------------------

  const ubicacion = String(d.ubicacion || "").trim();

  if (!ubicacion) {
    throw new HttpError(400, "Selecciona una ubicación.");
  }

  // Bloquear ubicación durante la transacción.
  // Evita asignaciones simultáneas en la misma ubicación.

  const [loc] = await conn.execute(
    `SELECT *
     FROM ubicaciones
     WHERE id = ?
     FOR UPDATE`,
    [ubicacion]
  );

  if (!loc.length) {
    throw new HttpError(
      400,
      "La ubicación seleccionada no existe."
    );
  }

  const tieneSubdivisiones = Boolean(
    loc[0].tiene_subdivisiones
  );

  // -------------------------------------------
  // VALIDAR SUBDIVISIÓN
  // -------------------------------------------

  const sub = String(d.subdivision || "").trim();

  if (tieneSubdivisiones && !sub) {
    throw new HttpError(
      400,
      "Selecciona una división interna."
    );
  }

  if (!tieneSubdivisiones && sub) {
    throw new HttpError(
      400,
      "Esta jaba no utiliza subdivisiones."
    );
  }

  if (sub) {
    const [subdivision] = await conn.execute(
      `SELECT id
       FROM subdivisiones
       WHERE ubicacion_id = ?
       AND codigo = ?
       LIMIT 1`,
      [ubicacion, sub]
    );

    if (!subdivision.length) {
      throw new HttpError(
        400,
        "La división seleccionada no es válida."
      );
    }
  }

  // -------------------------------------------
  // VALIDAR CÓDIGO DEL REPUESTO
  // -------------------------------------------

  const codigo = String(d.codigo || "").trim();

  if (codigo.length > 255) {
    throw new HttpError(
      400,
      "El código no puede superar los 255 caracteres."
    );
  }

  if (d.tieneCodigo && !codigo) {
    throw new HttpError(
      400,
      "Debes ingresar el código del repuesto."
    );
  }

  if (codigo) {
    const [duplicado] = await conn.execute(
      `SELECT id
       FROM inventario
       WHERE LOWER(codigo) = LOWER(?)
       AND id <> COALESCE(?, 0)
       LIMIT 1`,
      [codigo, id]
    );

    if (duplicado.length) {
      throw new HttpError(
        409,
        "Ya existe otro registro con este código."
      );
    }
  }

  // -------------------------------------------
  // VALIDAR CÓDIGO DE REEMPLAZO
  // -------------------------------------------

  const codigoReemplazo = String(
    d.codigoReemplazo || ""
  ).trim();

  if (codigoReemplazo.length > 255) {
    throw new HttpError(
      400,
      "El código de reemplazo no puede superar los 255 caracteres."
    );
  }

  // -------------------------------------------
  // VALIDAR OCUPACIÓN DE UBICACIÓN
  // -------------------------------------------

  let consultaOcupacion;
  let parametros;

  if (tieneSubdivisiones) {
    consultaOcupacion = `
      SELECT id
      FROM inventario
      WHERE estado = 'Activo'
      AND ubicacion_id = ?
      AND subdivision_codigo = ?
      AND id <> COALESCE(?, 0)
      LIMIT 1
    `;

    parametros = [ubicacion, sub, id];

  } else {
    consultaOcupacion = `
      SELECT id
      FROM inventario
      WHERE estado = 'Activo'
      AND ubicacion_id = ?
      AND (
        subdivision_codigo IS NULL
        OR subdivision_codigo = ''
      )
      AND id <> COALESCE(?, 0)
      LIMIT 1
    `;

    parametros = [ubicacion, id];
  }

  const [ocupada] = await conn.execute(
    consultaOcupacion,
    parametros
  );

  if (ocupada.length) {
    throw new HttpError(
      409,
      tieneSubdivisiones
        ? "Esta división ya tiene un componente asignado."
        : "Esta ubicación ya está ocupada."
    );
  }

  return {
    mat: mat[0],
    codigo,
    codigoReemplazo,
    ubicacion,
    sub,
  };
}

// =============================================
// VALIDAR Y GUARDAR FOTOGRAFÍA NUEVA
// =============================================

async function procesarFotoNueva(dataUri) {
  if (!dataUri) {
    return null;
  }

  if (
    typeof dataUri !== "string" ||
    !/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(dataUri)
  ) {
    throw new HttpError(
      400,
      "La fotografía debe ser una imagen válida."
    );
  }

  return await guardarFoto(dataUri);
}

// =============================================
// CONSULTAR TODO EL INVENTARIO
// =============================================

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT *
       FROM inventario
       ORDER BY id DESC`
    );

    return res.json({
      ok: true,
      data: rows.map(mapRow),
    });

  } catch (error) {
    next(error);
  }
});

// =============================================
// CONSULTAR INVENTARIO POR ID
// =============================================

router.get("/:id", async (req, res, next) => {
  try {
    validarId(req.params.id);

    const [rows] = await pool.execute(
      `SELECT *
       FROM inventario
       WHERE id = ?
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows.length) {
      throw new HttpError(
        404,
        "No se encontró el registro."
      );
    }

    return res.json({
      ok: true,
      data: mapRow(rows[0]),
    });

  } catch (error) {
    next(error);
  }
});

// =============================================
// REGISTRAR NUEVO COMPONENTE
// =============================================

router.post("/", async (req, res, next) => {
  let conn = null;
  let fotoUrl = null;
  let transaccionActiva = false;
  let confirmado = false;

  try {
    const d = req.body || {};

    conn = await pool.getConnection();

    await conn.beginTransaction();
    transaccionActiva = true;

    // Validar información
    const v = await validar(conn, d);

    // Guardar fotografía si existe
    fotoUrl = await procesarFotoNueva(d.foto);

    // Registrar inventario.
    // fecha_creacion es TEXT NOT NULL en MySQL.
    // Por eso se proporciona expresamente.

    const [resultado] = await conn.execute(
      `INSERT INTO inventario (
        sku_id,
        sku,
        descripcion,
        codigo,
        tiene_codigo,
        codigo_reemplazo,
        ubicacion_id,
        subdivision_codigo,
        observacion,
        foto_url,
        estado,
        fecha_creacion
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo', ?)`,
      [
        v.mat.id,
        v.mat.sku,
        v.mat.descripcion,
        v.codigo,
        Boolean(v.codigo),
        v.codigoReemplazo,
        v.ubicacion,
        v.sub || null,
        String(d.observacion || "").trim(),
        fotoUrl,
        fechaActual(),
      ]
    );

    // Registrar auditoría
    await registrarEvento(conn, {
      modulo: "Inventario",
      accion: "Creación",
      descripcion:
        `Se registró ${v.mat.descripcion} en ${v.ubicacion}` +
        `${v.sub ? `, división ${v.sub}` : ""}.`,
      referencia: v.codigo || v.mat.sku,
      usuarioId: req.usuario.sub,
      usuario: req.usuario.nombre,
    });

    await conn.commit();
    transaccionActiva = false;
    confirmado = true;

    const [rows] = await conn.execute(
      `SELECT *
       FROM inventario
       WHERE id = ?`,
      [resultado.insertId]
    );

    return res.status(201).json({
      ok: true,
      data: mapRow(rows[0]),
    });

  } catch (error) {
    if (conn && transaccionActiva) {
      await conn.rollback().catch(() => {});
    }

    if (fotoUrl && !confirmado) {
      await eliminarFoto(fotoUrl).catch((e) =>
        console.warn(
          "No se pudo limpiar la fotografía nueva:",
          e.message
        )
      );
    }

    next(error);

  } finally {
    if (conn) {
      conn.release();
    }
  }
});

// =============================================
// EDITAR COMPONENTE
// =============================================

router.put("/:id", async (req, res, next) => {
  let conn = null;
  let nuevaFoto = null;
  let fotoNuevaSubida = false;
  let transaccionActiva = false;
  let confirmado = false;

  try {
    validarId(req.params.id);

    conn = await pool.getConnection();

    await conn.beginTransaction();
    transaccionActiva = true;

    // Obtener registro original

    const [oldRows] = await conn.execute(
      `SELECT *
       FROM inventario
       WHERE id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (!oldRows.length) {
      throw new HttpError(
        404,
        "No se encontró el registro que deseas editar."
      );
    }

    const registroAnterior = oldRows[0];
    const d = req.body || {};

    // Validar datos

    const v = await validar(
      conn,
      d,
      Number(req.params.id)
    );

    const fotoAnterior = registroAnterior.foto_url;

    // -----------------------------------------
    // GESTIÓN DE FOTOGRAFÍAS
    // -----------------------------------------

    if (d.foto === null || d.foto === "") {
      // El usuario decidió eliminar la fotografía.
      nuevaFoto = null;

    } else if (
      typeof d.foto === "string" &&
      d.foto.startsWith("data:image/")
    ) {
      // Se seleccionó una fotografía nueva.

      nuevaFoto = await procesarFotoNueva(d.foto);
      fotoNuevaSubida = Boolean(nuevaFoto);

    } else if (
      d.foto === undefined ||
      d.foto === fotoAnterior
    ) {
      // Conservar fotografía anterior.
      nuevaFoto = fotoAnterior;

    } else {
      throw new HttpError(
        400,
        "La fotografía enviada no es válida."
      );
    }

    // -----------------------------------------
    // ACTUALIZAR INVENTARIO
    // -----------------------------------------

    await conn.execute(
      `UPDATE inventario
       SET
         codigo = ?,
         tiene_codigo = ?,
         codigo_reemplazo = ?,
         ubicacion_id = ?,
         subdivision_codigo = ?,
         observacion = ?,
         foto_url = ?,
         fecha_actualizacion = ?
       WHERE id = ?`,
      [
        v.codigo,
        Boolean(v.codigo),
        v.codigoReemplazo,
        v.ubicacion,
        v.sub || null,
        String(d.observacion || "").trim(),
        nuevaFoto,
        fechaActual(),
        req.params.id,
      ]
    );

    // -----------------------------------------
    // REGISTRAR AUDITORÍA
    // -----------------------------------------

    await registrarEvento(conn, {
      modulo: "Inventario",
      accion: "Edición",
      descripcion:
        `Se actualizaron los datos de ${registroAnterior.descripcion}. ` +
        `Ubicación: ${v.ubicacion}` +
        `${v.sub ? `, división ${v.sub}` : ""}.`,
      referencia: v.codigo || registroAnterior.sku,
      usuarioId: req.usuario.sub,
      usuario: req.usuario.nombre,
    });

    await conn.commit();
    transaccionActiva = false;
    confirmado = true;

    // -----------------------------------------
    // ELIMINAR FOTO ANTERIOR
    // -----------------------------------------

    if (fotoAnterior && fotoAnterior !== nuevaFoto) {
      await eliminarFoto(fotoAnterior).catch((error) =>
        console.warn(
          "No se pudo eliminar la fotografía anterior:",
          error.message
        )
      );
    }

    const [rows] = await conn.execute(
      `SELECT *
       FROM inventario
       WHERE id = ?`,
      [req.params.id]
    );

    return res.json({
      ok: true,
      data: mapRow(rows[0]),
    });

  } catch (error) {
    if (conn && transaccionActiva) {
      await conn.rollback().catch(() => {});
    }

    // Limpiar solamente la fotografía nueva
    // si la transacción no se confirmó.

    if (fotoNuevaSubida && nuevaFoto && !confirmado) {
      await eliminarFoto(nuevaFoto).catch((e) =>
        console.warn(
          "No se pudo eliminar la fotografía nueva:",
          e.message
        )
      );
    }

    next(error);

  } finally {
    if (conn) {
      conn.release();
    }
  }
});

// =============================================
// ACTIVAR / DESACTIVAR COMPONENTE
// =============================================

router.patch("/:id/estado", async (req, res, next) => {
  let conn = null;
  let transaccionActiva = false;

  try {
    validarId(req.params.id);

    conn = await pool.getConnection();

    await conn.beginTransaction();
    transaccionActiva = true;

    const [rows] = await conn.execute(
      `SELECT *
       FROM inventario
       WHERE id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      throw new HttpError(
        404,
        "No se encontró el registro."
      );
    }

    const registro = rows[0];

    const nuevoEstado =
      registro.estado === "Activo" ? "Inactivo" : "Activo";

    // Si se reactiva, comprobar nuevamente
    // que el material y la ubicación estén disponibles.

    if (nuevoEstado === "Activo") {
      await validar(
        conn,
        {
          skuId: registro.sku_id,
          ubicacion: registro.ubicacion_id,
          subdivision: registro.subdivision_codigo,
          codigo: registro.codigo,
          tieneCodigo: registro.tiene_codigo,
          codigoReemplazo: registro.codigo_reemplazo,
        },
        Number(req.params.id)
      );
    }

    // Actualizar estado

    await conn.execute(
      `UPDATE inventario
       SET
         estado = ?,
         fecha_actualizacion = ?
       WHERE id = ?`,
      [
        nuevoEstado,
        fechaActual(),
        req.params.id,
      ]
    );

    // Registrar auditoría

    await registrarEvento(conn, {
      modulo: "Inventario",
      accion:
        nuevoEstado === "Activo"
          ? "Activación"
          : "Desactivación",
      descripcion:
        `Se ${nuevoEstado === "Activo" ? "activó" : "desactivó"} ` +
        `el registro ${registro.descripcion}.`,
      referencia: registro.codigo || registro.sku,
      usuarioId: req.usuario.sub,
      usuario: req.usuario.nombre,
    });

    await conn.commit();
    transaccionActiva = false;

    const [actualizado] = await conn.execute(
      `SELECT *
       FROM inventario
       WHERE id = ?`,
      [req.params.id]
    );

    return res.json({
      ok: true,
      data: mapRow(actualizado[0]),
    });

  } catch (error) {
    if (conn && transaccionActiva) {
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
// ELIMINAR FOTOGRAFÍA DEL COMPONENTE
// =============================================

router.delete("/:id/foto", async (req, res, next) => {
  let conn = null;
  let transaccionActiva = false;
  let fotoAnterior = null;

  try {
    validarId(req.params.id);

    conn = await pool.getConnection();

    await conn.beginTransaction();
    transaccionActiva = true;

    // Consultar registro

    const [rows] = await conn.execute(
      `SELECT *
       FROM inventario
       WHERE id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      throw new HttpError(
        404,
        "No se encontró el registro."
      );
    }

    fotoAnterior = rows[0].foto_url;

    if (!fotoAnterior) {
      throw new HttpError(
        404,
        "Este registro no tiene una fotografía."
      );
    }

    // Eliminar referencia en MySQL

    await conn.execute(
      `UPDATE inventario
       SET
         foto_url = NULL,
         fecha_actualizacion = ?
       WHERE id = ?`,
      [
        fechaActual(),
        req.params.id,
      ]
    );

    // Registrar auditoría

    await registrarEvento(conn, {
      modulo: "Inventario",
      accion: "Eliminación de fotografía",
      descripcion:
        `Se eliminó la fotografía del componente ${rows[0].descripcion}.`,
      referencia: rows[0].codigo || rows[0].sku,
      usuarioId: req.usuario.sub,
      usuario: req.usuario.nombre,
    });

    await conn.commit();
    transaccionActiva = false;

    // Eliminar fotografía de Cloudinary
    // después de confirmar MySQL.

    let advertencia = null;

    try {
      await eliminarFoto(fotoAnterior);

    } catch (error) {
      console.warn(
        "No se pudo eliminar la fotografía de Cloudinary:",
        error.message
      );

      advertencia =
        "La fotografía se desvinculó del inventario, pero no se pudo eliminar del almacenamiento.";
    }

    return res.json({
      ok: true,
      mensaje: "Fotografía eliminada.",
      ...(advertencia ? { advertencia } : {}),
    });

  } catch (error) {
    if (conn && transaccionActiva) {
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
// EXPORTAR RUTAS
// =============================================

export default router;
