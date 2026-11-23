
import {
  cloudinary,
  cloudinaryHabilitado,
} from "../config/cloudinary.js";

import { config } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

// =============================================
// CONFIGURACIÓN
// =============================================

const MAX_TAMANO_FOTO = 5 * 1024 * 1024;

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// =============================================
// VALIDAR CLOUDINARY
// =============================================

function validarCloudinary() {
  if (!cloudinaryHabilitado) {
    throw new HttpError(
      503,
      "Cloudinary no está configurado correctamente."
    );
  }

  if (
    !config.cloudinary.cloudName ||
    !config.cloudinary.apiKey ||
    !config.cloudinary.apiSecret
  ) {
    throw new HttpError(
      503,
      "Faltan credenciales de Cloudinary."
    );
  }
}

// =============================================
// EXTRAER PUBLIC ID
// =============================================

function obtenerPublicId(url) {
  try {
    if (
      !url ||
      typeof url !== "string" ||
      !config.cloudinary.cloudName
    ) {
      return null;
    }

    const parsedUrl = new URL(url);

    const dominioEsperado =
      `${config.cloudinary.cloudName}.res.cloudinary.com`;

    if (parsedUrl.hostname !== dominioEsperado) {
      return null;
    }

    const segmentos = parsedUrl.pathname.split("/");

    const indiceUpload = segmentos.indexOf("upload");

    if (indiceUpload === -1) {
      return null;
    }

    const ruta = segmentos.slice(indiceUpload + 1);

    if (!ruta.length) {
      return null;
    }

    const indiceVersion = ruta.findIndex(
      (segmento) => /^v\d+$/.test(segmento)
    );

    const partes =
      indiceVersion !== -1
        ? ruta.slice(indiceVersion + 1)
        : ruta;

    if (!partes.length) {
      return null;
    }

    const publicId = decodeURIComponent(
      partes.join("/")
    ).replace(/\.[^.]+$/, "");

    return publicId || null;

  } catch (error) {
    console.error(
      "Error obteniendo Public ID:",
      error.message
    );

    return null;
  }
}

// =============================================
// VALIDAR FOTOGRAFÍA
// =============================================

function validarFotografia(dataUri) {
  if (
    !dataUri ||
    typeof dataUri !== "string"
  ) {
    throw new HttpError(
      400,
      "La fotografía recibida no es válida."
    );
  }

  const coincidencia = dataUri.match(
    /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i
  );

  if (!coincidencia) {
    throw new HttpError(
      400,
      "Formato de fotografía no permitido."
    );
  }

  const tipo = coincidencia[1].toLowerCase();

  const contenidoBase64 = coincidencia[2];

  if (!TIPOS_PERMITIDOS.includes(tipo)) {
    throw new HttpError(
      400,
      "Tipo de imagen no permitido."
    );
  }

  const buffer = Buffer.from(
    contenidoBase64,
    "base64"
  );

  if (!buffer.length) {
    throw new HttpError(
      400,
      "La fotografía está vacía."
    );
  }

  if (buffer.length > MAX_TAMANO_FOTO) {
    throw new HttpError(
      413,
      "La fotografía supera el límite de 5 MB."
    );
  }

  return {
    tipo,
    buffer,
  };
}

// =============================================
// GUARDAR FOTOGRAFÍA EN CLOUDINARY
// =============================================

export async function guardarFoto(dataUri) {
  if (!dataUri) {
    return null;
  }

  validarCloudinary();

  const { tipo, buffer } = validarFotografia(dataUri);

  try {
    console.log("--------------------------------");
    console.log("INICIANDO CARGA DE FOTOGRAFÍA");
    console.log("--------------------------------");

    console.log("Cloudinary habilitado:", cloudinaryHabilitado);
    console.log("Cloud Name:", config.cloudinary.cloudName);
    console.log("Tipo de imagen:", tipo);
    console.log("Tamaño:", buffer.length, "bytes");
    console.log("Carpeta:", config.cloudinary.folder);

    // Prueba de carga sin transformaciones adicionales.
    // Primero verificamos que Cloudinary acepte la imagen.

    const resultado = await cloudinary.uploader.upload(
      dataUri,
      {
        folder: config.cloudinary.folder,
        resource_type: "image",
        timeout: 60000,
        unique_filename: true,
        overwrite: false,
      }
    );

    if (!resultado || !resultado.secure_url) {
      throw new Error(
        "Cloudinary no devolvió una URL segura."
      );
    }

    console.log("--------------------------------");
    console.log("FOTOGRAFÍA GUARDADA CORRECTAMENTE");
    console.log("Public ID:", resultado.public_id);
    console.log("URL:", resultado.secure_url);
    console.log("--------------------------------");

    return resultado.secure_url;

  } catch (error) {
    console.error("--------------------------------");
    console.error("ERROR DETALLADO DE CLOUDINARY");
    console.error("--------------------------------");

    console.error("Nombre:", error.name);
    console.error("Mensaje:", error.message);

    console.error(
      "Código HTTP:",
      error.http_code || error.httpCode || "No disponible"
    );

    console.error(
      "Detalle:",
      error.error?.message || "Sin detalle adicional"
    );

    console.error(
      "Respuesta:",
      error.response?.body || "Sin respuesta adicional"
    );

    console.error("--------------------------------");

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(
      502,
      "No se pudo almacenar la fotografía. Revisa los registros del servidor."
    );
  }
}

// =============================================
// ELIMINAR FOTOGRAFÍA
// =============================================

export async function eliminarFoto(url) {
  if (!url) {
    return;
  }

  validarCloudinary();

  const publicId = obtenerPublicId(url);

  if (!publicId) {
    console.warn(
      "No se pudo identificar la fotografía en Cloudinary."
    );

    return;
  }

  try {
    console.log(
      "Eliminando fotografía:",
      publicId
    );

    const resultado = await cloudinary.uploader.destroy(
      publicId,
      {
        resource_type: "image",
        invalidate: true,
      }
    );

    if (
      resultado.result !== "ok" &&
      resultado.result !== "not found"
    ) {
      throw new Error(
        `Cloudinary respondió: ${resultado.result}`
      );
    }

    console.log(
      "Fotografía eliminada correctamente."
    );

    return resultado;

  } catch (error) {
    console.error(
      "ERROR ELIMINANDO FOTOGRAFÍA:",
      error.message
    );

    throw new HttpError(
      502,
      "No se pudo eliminar la fotografía almacenada."
    );
  }
}
