
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { pool } from "../config/db.js";
import { config } from "../config/env.js";
import { autenticar } from "../middleware/auth.js";
import { HttpError } from "../utils/httpError.js";

const router = Router();

const COOKIE_NAME = "almacen_session";

// =============================================
// CONFIGURACIÓN DE DURACIÓN DE SESIÓN
// =============================================

// 8 horas en milisegundos.

const DURACION_SESION = 8 * 60 * 60 * 1000;

// =============================================
// CONFIGURACIÓN DE LA COOKIE
// =============================================

const cookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === "production",
  sameSite: config.nodeEnv === "production" ? "none" : "lax",
  path: "/",
};

// Opciones para eliminar la cookie.
// Deben coincidir con las utilizadas al crearla.

const clearCookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === "production",
  sameSite: config.nodeEnv === "production" ? "none" : "lax",
  path: "/",
};

// =============================================
// INICIAR SESIÓN
// =============================================

router.post("/login", async (req, res, next) => {
  try {
    if (!config.jwtSecret) {
      throw new HttpError(
        503,
        "La autenticación no está configurada."
      );
    }

    const { usuario, password } = req.body || {};

    // Validar datos recibidos.

    if (
      typeof usuario !== "string" ||
      typeof password !== "string" ||
      !usuario.trim() ||
      !password
    ) {
      throw new HttpError(
        400,
        "Usuario y contraseña son obligatorios."
      );
    }

    const nombreUsuario = usuario.trim().toLowerCase();

    // Buscar usuario en MySQL.

    const [rows] = await pool.execute(
      `SELECT
        id,
        nombre,
        usuario,
        password_hash,
        rol,
        estado
       FROM usuarios
       WHERE usuario = ?
       LIMIT 1`,
      [nombreUsuario]
    );

    const user = rows[0];

    // Validar usuario y contraseña.

    if (
      !user ||
      user.estado !== "Activo" ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      throw new HttpError(
        401,
        "Usuario o contraseña incorrectos."
      );
    }

    // Validar perfil.

    if (!["admin", "almacen"].includes(user.rol)) {
      throw new HttpError(
        403,
        "El perfil de usuario no está autorizado."
      );
    }

    // =========================================
    // GENERAR TOKEN JWT
    // =========================================

    const token = jwt.sign(
      {
        sub: user.id,
        nombre: user.nombre,
        rol: user.rol,
      },
      config.jwtSecret,
      {
        expiresIn: "8h",
        algorithm: "HS256",
      }
    );

    // =========================================
    // GUARDAR COOKIE EN EL NAVEGADOR
    // =========================================

    res.cookie(
      COOKIE_NAME,
      token,
      {
        ...cookieOptions,
        maxAge: DURACION_SESION,
      }
    );

    // =========================================
    // RESPUESTA AL FRONTEND
    // =========================================

    return res.status(200).json({
      ok: true,
      mensaje: "Sesión iniciada correctamente.",

      usuario: {
        id: user.id,
        nombre: user.nombre,
        username: user.usuario,
        rol: user.rol,
      },
    });

  } catch (error) {
    return next(error);
  }
});

// =============================================
// RECUPERAR SESIÓN ACTUAL
// =============================================

router.get("/me", autenticar, (req, res) => {
  return res.status(200).json({
    ok: true,

    usuario: {
      id: req.usuario.sub,
      nombre: req.usuario.nombre,
      rol: req.usuario.rol,
    },
  });
});

// =============================================
// CERRAR SESIÓN VOLUNTARIAMENTE
// =============================================

router.post("/logout", (req, res) => {

  // Eliminar cookie de autenticación.

  res.clearCookie(
    COOKIE_NAME,
    clearCookieOptions
  );

  return res.status(200).json({
    ok: true,
    mensaje: "Sesión cerrada correctamente.",
  });
});

// =============================================
// EXPORTAR RUTAS
// =============================================

export default router;
