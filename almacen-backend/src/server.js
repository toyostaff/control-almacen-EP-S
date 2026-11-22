
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { config } from "./config/env.js";
import {
  comprobarConexion,
  cerrarConexion,
} from "./config/db.js";

import authRoutes from "./routes/auth.routes.js";
import catalogoRoutes from "./routes/catalogo.routes.js";
import inventarioRoutes from "./routes/inventario.routes.js";
import ubicacionesRoutes from "./routes/ubicaciones.routes.js";
import historialRoutes from "./routes/historial.routes.js";
import vozRoutes from "./routes/voz.routes.js";

import {
  noEncontrado,
  manejarError,
} from "./middleware/errors.js";

// =============================================
// INICIALIZAR APLICACIÓN
// =============================================

const app = express();

app.disable("x-powered-by");

// Configuración del proxy de Railway
app.set("trust proxy", 1);

// =============================================
// VALIDAR CONFIGURACIÓN CORS
// =============================================

if (
  config.nodeEnv === "production" &&
  (
    config.corsOrigins.length === 0 ||
    config.corsOrigins.includes("*")
  )
) {
  throw new Error(
    "Configura CORS_ORIGINS con el dominio autorizado del frontend."
  );
}

// =============================================
// SEGURIDAD HTTP
// =============================================

app.use(helmet());

// =============================================
// CONFIGURACIÓN CORS
// =============================================

app.use(
  cors({
    origin: (origin, callback) => {

      // Permitir solicitudes sin origen
      if (!origin) {
        return callback(null, true);
      }

      // Permitir todos los orígenes solamente
      // fuera de producción si está configurado.

      if (
        config.nodeEnv !== "production" &&
        config.corsOrigins.includes("*")
      ) {
        return callback(null, true);
      }

      // Comprobar dominio autorizado
      if (config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Origen no permitido por CORS.")
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    maxAge: 86400,
  })
);

// =============================================
// PROCESAMIENTO DE SOLICITUDES
// =============================================

app.use(
  express.json({
    limit: "7mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

// =============================================
// REGISTRO DE SOLICITUDES
// =============================================

app.use(
  morgan(
    config.nodeEnv === "production"
      ? "combined"
      : "dev"
  )
);

// =============================================
// LIMITADOR GENERAL DE SOLICITUDES
// =============================================

const limiteGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 600,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    ok: false,
    mensaje:
      "Demasiadas solicitudes. Intenta nuevamente más tarde.",
  },
});

// =============================================
// PROTECCIÓN ADICIONAL DEL LOGIN
// =============================================

const limiteAutenticacion = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 20,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    ok: false,
    mensaje:
      "Demasiados intentos de autenticación. Espera unos minutos.",
  },
});

// =============================================
// APLICAR LIMITADORES
// =============================================

app.use("/api", limiteGeneral);

app.use("/api/auth", limiteAutenticacion);

// =============================================
// COMPROBACIÓN DEL SERVIDOR
// =============================================

app.get("/api/health", async (req, res) => {
  try {

    await comprobarConexion();

    return res.status(200).json({
      ok: true,
      servicio: "API Control de Almacén",
      estado: "operativo",
      baseDatos: "conectada",
    });

  } catch (error) {

    console.error(
      "Error comprobando MySQL:",
      error.message
    );

    return res.status(503).json({
      ok: false,
      servicio: "API Control de Almacén",
      estado: "degradado",
      baseDatos: "desconectada",
    });
  }
});

// =============================================
// RUTAS DE LA API
// =============================================

// AUTENTICACIÓN
app.use("/api/auth", authRoutes);

// CATÁLOGO MAESTRO
app.use("/api/catalogo", catalogoRoutes);

// INVENTARIO
app.use("/api/inventario", inventarioRoutes);

// UBICACIONES
app.use("/api/ubicaciones", ubicacionesRoutes);

// HISTORIAL
app.use("/api/historial", historialRoutes);

// ASISTENTE DE VOZ
app.use("/api/voz", vozRoutes);

// =============================================
// RUTAS NO ENCONTRADAS
// =============================================

app.use(noEncontrado);

// =============================================
// MANEJO CENTRALIZADO DE ERRORES
// =============================================

app.use(manejarError);

// =============================================
// INICIAR SERVIDOR
// =============================================

let servidor;

let cerrando = false;

async function iniciarServidor() {
  try {

    console.log(
      "Iniciando API Control de Almacén..."
    );

    // Comprobar conexión MySQL
    await comprobarConexion();

    console.log(
      "MySQL conectado correctamente."
    );

    // Iniciar servidor
    servidor = app.listen(
      config.port,
      () => {

        console.log(
          `API escuchando en el puerto ${config.port}`
        );

        console.log(
          `Entorno: ${config.nodeEnv}`
        );

      }
    );

    servidor.on("error", (error) => {

      console.error(
        "Error iniciando el servidor:",
        error.message
      );

      process.exitCode = 1;

      cerrarServidor("SERVER_ERROR");
    });

  } catch (error) {

    console.error(
      "No se pudo iniciar el servidor."
    );

    console.error(error.message);

    console.error(
      "Revisa DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD."
    );

    process.exitCode = 1;

    await cerrarConexion().catch(() => {});

    process.exit(1);
  }
}

// =============================================
// CIERRE CONTROLADO DEL SERVIDOR
// =============================================

async function cerrarServidor(signal) {

  if (cerrando) {
    return;
  }

  cerrando = true;

  console.log(
    `Señal ${signal} recibida. Cerrando servidor...`
  );

  try {

    // Detener recepción de nuevas solicitudes
    if (servidor) {

      await new Promise((resolve, reject) => {

        servidor.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });

      });

    }

    // Cerrar conexiones MySQL
    await cerrarConexion();

    console.log(
      "Servidor cerrado correctamente."
    );

    process.exit(0);

  } catch (error) {

    console.error(
      "Error durante el cierre:",
      error.message
    );

    process.exit(1);
  }
}

// =============================================
// SEÑALES DE CIERRE
// =============================================

process.on("SIGTERM", () => {
  cerrarServidor("SIGTERM");
});

process.on("SIGINT", () => {
  cerrarServidor("SIGINT");
});

// =============================================
// EJECUTAR SERVIDOR
// =============================================

iniciarServidor();
