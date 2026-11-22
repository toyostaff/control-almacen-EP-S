import bcrypt from "bcryptjs";
import { pool } from "../src/config/db.js";
const [, , nombre, email, password] = process.argv;
if (!nombre || !email || !password) {
  console.error(
    'Uso: node scripts/crear-admin.js "Nombre" correo@dominio.com "contraseña-segura"',
  );
  process.exit(1);
}
try {
  const hash = await bcrypt.hash(password, 12);
  await pool.execute(
    `INSERT INTO usuarios(nombre,email,password_hash,rol,estado) VALUES(?,?,?,'admin','Activo') ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),password_hash=VALUES(password_hash),rol='admin',estado='Activo'`,
    [nombre, email.toLowerCase().trim(), hash],
  );
  console.log(`Administrador creado/actualizado: ${email}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
