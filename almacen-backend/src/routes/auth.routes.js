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
// CONFIGURACIÓN DE LA COOKIE
// =============================================

const cookieOptions = {
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
      throw new HttpError(503, "La autenticación no está configurada.");
    }

    const { usuario, password } = req.body || {};

    if (
      typeof usuario !== "string" ||
      typeof password !== "string" ||
      !usuario.trim() ||
      !password
    ) {
      throw new HttpError(400, "Usuario y contraseña son obligatorios.");
    }

    const nombreUsuario = usuario.trim().toLowerCase();

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
      [nombreUsuario],
    );

    const user = rows[0];

    if (
      !user ||
      user.estado !== "Activo" ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      throw new HttpError(401, "Usuario o contraseña incorrectos.");
    }

    if (!["admin", "almacen"].includes(user.rol)) {
      throw new HttpError(403, "El perfil de usuario no está autorizado.");
    }

    // Generar JWT con expiración configurada (8 horas).
    const token = jwt.sign(
      {
        sub: user.id,
        nombre: user.nombre,
        rol: user.rol,
      },
      config.jwtSecret,
      {
        expiresIn: config.jwtExpiresIn,
      },
    );

    // El navegador recibe la cookie, no el JavaScript.
    res.cookie(COOKIE_NAME, token, cookieOptions);

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
  return res.json({
    ok: true,
    usuario: {
      id: req.usuario.sub,
      nombre: req.usuario.nombre,
      rol: req.usuario.rol,
    },
  });
});

// =============================================
// CERRAR SESIÓN
// =============================================

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);

  return res.json({
    ok: true,
    mensaje: "Sesión cerrada correctamente.",
  });
});

export default router;
