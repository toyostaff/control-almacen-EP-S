
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const usuarios = [
  {
    nombre: 'Administrador',
    usuario: 'admin',
    password: '12345',
    rol: 'admin'
  },
  {
    nombre: 'Personal de Motores',
    usuario: 'motores',
    password: 'pistones',
    rol: 'almacen'
  }
];

try {
  for (const usuario of usuarios) {
    const hash = await bcrypt.hash(usuario.password, 12);

    await pool.execute(
      `INSERT INTO usuarios
       (nombre, usuario, password_hash, rol, estado)
       VALUES (?, ?, ?, ?, ?)`,
      [
        usuario.nombre,
        usuario.usuario,
        hash,
        usuario.rol,
        'Activo'
      ]
    );

    console.log(`Usuario creado: ${usuario.usuario}`);
  }

  console.log('Usuarios registrados correctamente.');

} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;

} finally {
  await pool.end();
}
