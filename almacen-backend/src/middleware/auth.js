
import jwt from "jsonwebtoken";

import { config } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

// =============================================
// AUTENTICACIÓN DE USUARIOS
// =============================================

export function autenticar(req, res, next) {

  // ===========================================
  // VALIDAR CONFIGURACIÓN JWT
  // ===========================================

  if (!config.jwtSecret) {
    return next(
      new HttpError(
        503,
        "La autenticación no está configurada en el servidor."
      )
    );
  }

  // ===========================================
  // OBTENER TOKEN
  // ===========================================

  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : "";

  if (!token) {
    return next(
      new HttpError(
        401,
        "Debes iniciar sesión para acceder a este recurso."
      )
    );
  }

  // ===========================================
  // VALIDAR TOKEN JWT
  // ===========================================

  try {

    const payload = jwt.verify(
      token,
      config.jwtSecret
    );

    // Verificar estructura del token
    if (
      !payload ||
      typeof payload !== "object" ||
      !payload.sub ||
      !payload.nombre ||
      !["admin", "almacen"].includes(payload.rol)
    ) {
      throw new Error("Token con información inválida.");
    }

    // Guardar usuario autenticado en la petición
    req.usuario = {
      sub: payload.sub,
      nombre: payload.nombre,
      rol: payload.rol,
    };

    return next();

  } catch (error) {

    return next(
      new HttpError(
        401,
        "La sesión no es válida o ha vencido. Inicia sesión nuevamente."
      )
    );

  }
}

// =============================================
// AUTORIZACIÓN EXCLUSIVA PARA ADMINISTRADOR
// =============================================

export function exigirAdmin(req, res, next) {

  if (!req.usuario) {
    return next(
      new HttpError(
        401,
        "Debes iniciar sesión."
      )
    );
  }

  if (req.usuario.rol !== "admin") {
    return next(
      new HttpError(
        403,
        "No tienes permisos para realizar esta operación."
      )
    );
  }

  return next();
}
