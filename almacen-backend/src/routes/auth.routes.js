import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();
router.post('/login', async (req, res, next) => {
  try {
    if (!config.jwtSecret) throw new HttpError(503, 'Configura JWT_SECRET en las variables del hosting.');
    const { email, password } = req.body || {};
    if (!email || !password) throw new HttpError(400, 'Correo y contraseña son obligatorios.');
    const [rows] = await pool.execute('SELECT id,nombre,email,password_hash,rol,estado FROM usuarios WHERE email=? LIMIT 1', [String(email).toLowerCase().trim()]);
    const user = rows[0];
    if (!user || user.estado !== 'Activo' || !(await bcrypt.compare(password, user.password_hash))) throw new HttpError(401, 'Credenciales incorrectas.');
    const token = jwt.sign({ sub: user.id, nombre: user.nombre, rol: user.rol }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    res.json({ ok: true, token, usuario: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
  } catch (e) { next(e); }
});
export default router;
