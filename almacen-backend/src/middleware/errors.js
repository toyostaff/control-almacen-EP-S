import { HttpError } from '../utils/httpError.js';
export function noEncontrado(req, res, next) { next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`)); }
export function manejarError(err, req, res, next) {
  const status = Number(err.status || err.statusCode || 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ ok: false, mensaje: status >= 500 ? 'Ocurrió un error interno.' : err.message });
}
