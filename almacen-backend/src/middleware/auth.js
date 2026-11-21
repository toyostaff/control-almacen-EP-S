
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export function autenticar(req, res, next) {
  // MODO DEMOSTRACIÓN SIN LOGIN
  if (config.demoMode) {
    req.usuario = {
      sub: null,
      nombre: "Usuario de demostración",
      rol: "admin",
    };

    return next();
  }

  // AUTENTICACIÓN NORMAL
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token) {
    return next(
      new HttpError(401, "Debes iniciar sesión.")
    );
  }

  if (!config.jwtSecret) {
    return next(
      new HttpError(
        503,
        "La autenticación aún no está configurada en el hosting."
      )
    );
  }

  try {
    req.usuario = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    next(
      new HttpError(
        401,
        "La sesión no es válida o ha vencido."
      )
    );
  }
}

export function exigirAdmin(req, res, next) {
  if (req.usuario?.rol !== "admin") {
    return next(
      new HttpError(
        403,
        "No tienes permisos para esta operación."
      )
    );
  }

  next();
}
