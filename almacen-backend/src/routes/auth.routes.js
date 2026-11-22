
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

// =========================================
// INICIAR SESIÓN
// =========================================

router.post('/login', async (req, res, next) => {
  try {
    // Verificar configuración JWT
    if (!config.jwtSecret) {
      throw new HttpError(
        503,
        'La autenticación no está configurada.'
      );
    }

    // Recibir credenciales
    const { usuario, password } = req.body || {};

    if (!usuario || !password) {
      throw new HttpError(
        400,
        'Usuario y contraseña son obligatorios.'
      );
    }

    const nombreUsuario = String(usuario)
      .trim()
      .toLowerCase();

    // Buscar usuario en MySQL
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

    // Verificar existencia, estado y contraseña
    if (
      !user ||
      user.estado !== 'Activo' ||
      !(await bcrypt.compare(
        String(password),
        user.password_hash
      ))
    ) {
      throw new HttpError(
        401,
        'Usuario o contraseña incorrectos.'
      );
    }

    // Generar token de autenticación
    const token = jwt.sign(
      {
        sub: user.id,
        nombre: user.nombre,
        rol: user.rol
      },
      config.jwtSecret,
      {
        expiresIn: config.jwtExpiresIn
      }
    );

    // Respuesta al frontend
    res.json({
      ok: true,
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        username: user.usuario,
        rol: user.rol
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router;
