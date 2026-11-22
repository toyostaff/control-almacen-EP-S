
import mysql from "mysql2/promise";

import { config } from "./env.js";

// =============================================
// CONFIGURACIÓN DEL POOL MYSQL
// =============================================

export const pool = mysql.createPool({

  // Conexión
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,

  // Credenciales
  user: config.db.user,
  password: config.db.password,

  // Gestión de conexiones
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,

  // Formato de datos
  charset: "utf8mb4",
  timezone: "Z",
  decimalNumbers: true,

  // Evitar conexiones inactivas indefinidamente
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  // Tiempo máximo de espera de conexión
  connectTimeout: 15000,

  // Formato de fechas
  dateStrings: false,

});

// =============================================
// COMPROBAR CONEXIÓN MYSQL
// =============================================

export async function comprobarConexion() {

  let connection;

  try {

    connection = await pool.getConnection();

    await connection.ping();

    return true;

  } catch (error) {

    console.error(
      "Error de conexión MySQL:",
      error.message
    );

    throw error;

  } finally {

    if (connection) {
      connection.release();
    }

  }

}

// =============================================
// CERRAR POOL DE CONEXIONES
// =============================================

export async function cerrarConexion() {

  try {

    await pool.end();

    console.log(
      "Pool de conexiones MySQL cerrado correctamente."
    );

  } catch (error) {

    console.error(
      "Error cerrando el pool MySQL:",
      error.message
    );

    throw error;

  }

}
