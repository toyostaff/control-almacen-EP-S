// =============================================
// CONFIGURACIÓN DEL ENTORNO
// =============================================

const nodeEnv = process.env.NODE_ENV || "production";

const esProduccion = nodeEnv === "production";

// =============================================
// FUNCIONES DE VALIDACIÓN
// =============================================

function obtenerNumero(valor, defecto, minimo = 1) {
  const numero = Number(valor ?? defecto);

  if (!Number.isInteger(numero) || numero < minimo) {
    return defecto;
  }

  return numero;
}

// =============================================
// CONFIGURACIÓN GENERAL
// =============================================

export const config = {
  port: obtenerNumero(process.env.PORT, 3000),

  nodeEnv,

  // El modo demo nunca se activa en producción.
  demoMode: !esProduccion && process.env.DEMO_MODE === "true",

  // ===========================================
  // CORS
  // ===========================================

  corsOrigins: (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),

  // ===========================================
  // AUTENTICACIÓN JWT
  // ===========================================

  jwtSecret: process.env.JWT_SECRET || "",

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",

  // ===========================================
  // BASE DE DATOS MYSQL
  // ===========================================

  db: {
    host: process.env.DB_HOST || "127.0.0.1",

    port: obtenerNumero(process.env.DB_PORT, 3306),

    name: process.env.DB_NAME || "almacen_db",

    user: process.env.DB_USER || "root",

    password: process.env.DB_PASSWORD || "",

    connectionLimit: obtenerNumero(process.env.DB_CONNECTION_LIMIT, 10),
  },

  // ===========================================
  // ALMACENAMIENTO DE IMÁGENES CLOUDINARY
  // ===========================================

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",

    apiKey: process.env.CLOUDINARY_API_KEY || "",

    apiSecret: process.env.CLOUDINARY_API_SECRET || "",

    folder: process.env.CLOUDINARY_FOLDER || "control-almacen",
  },
};
