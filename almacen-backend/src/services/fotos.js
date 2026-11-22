
import {
  cloudinary,
  cloudinaryHabilitado,
} from "../config/cloudinary.js";

import { config } from "../config/env.js";

import { HttpError } from "../utils/httpError.js";

// =============================================
// CONFIGURACIÓN DE FOTOGRAFÍAS
// =============================================

const MAX_TAMANO_FOTO = 5 * 1024 * 1024;

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// =============================================
// VALIDAR CONFIGURACIÓN CLOUDINARY
// =============================================

function validarCloudinary() {
  if (!cloudinaryHabilitado) {
    throw new HttpError(
      503,
      "Cloudinary no está configurado en el servidor."
    );
  }
}

// =============================================
// EXTRAER PUBLIC ID DE CLOUDINARY
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

    // Verificar que la fotografía pertenezca
    // a nuestra cuenta de Cloudinary.

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

    // Obtener elementos posteriores a /upload/
    const ruta = segmentos.slice(indiceUpload + 1);

    if (ruta.length === 0) {
      return null;
    }

    // Buscar la versión de Cloudinary.
    // Ejemplo: v1730000000

    const indiceVersion = ruta.findIndex(
      (segmento) => /^v\d+$/.test(segmento)
    );

    // Si existe versión, tomar lo posterior.
    // Si no existe, utilizar la ruta disponible.

    const publicIdPartes =
      indiceVersion !== -1
        ? ruta.slice(indiceVersion + 1)
        : ruta;

    if (publicIdPartes.length === 0) {
      return null;
    }

    // Reconstruir public_id
    const publicId = decodeURIComponent(
      publicIdPartes.join("/")
    ).replace(/\.[^.]+$/, "");

    return publicId || null;

  } catch {
    return null;
  }
}

// =============================================
// GUARDAR FOTOGRAFÍA EN CLOUDINARY
// =============================================

// Recibe un Data URI generado mediante
// FileReader.readAsDataURL() desde React.
//
// Importante:
// No elimina la fotografía anterior.
// La eliminación se realiza después de
// confirmar la actualización en MySQL.

export async function guardarFoto(dataUri) {

  if (!dataUri) {
    return null;
  }

  // Validar formato recibido
  if (typeof dataUri !== "string") {
    throw new HttpError(
      400,
      "La fotografía recibida no es válida."
    );
  }

  // Validar estructura Data URI
  const coincidencia = dataUri.match(
    /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i
  );

  if (!coincidencia) {
    throw new HttpError(
      400,
      "Formato de fotografía no permitido. Utiliza JPG, PNG o WEBP."
    );
  }

  const tipoImagen = coincidencia[1].toLowerCase();

  const contenidoBase64 = coincidencia[2];

  if (!TIPOS_PERMITIDOS.includes(tipoImagen)) {
    throw new HttpError(
      400,
      "El tipo de imagen no está permitido."
    );
  }

  // Calcular tamaño real aproximado del archivo
  const tamano = Buffer.from(
    contenidoBase64,
    "base64"
  ).length;

  if (tamano === 0) {
    throw new HttpError(
      400,
      "La fotografía está vacía."
    );
  }

  if (tamano > MAX_TAMANO_FOTO) {
    throw new HttpError(
      413,
      "La fotografía supera el límite permitido de 5 MB."
    );
  }

  // Verificar Cloudinary
  validarCloudinary();

  try {

    // Subir fotografía
    const resultado = await cloudinary.uploader.upload(
      dataUri,
      {
        folder: config.cloudinary.folder,

        resource_type: "image",

        transformation: [
          {
            width: 1200,
            height: 1200,
            crop: "limit",
          },
          {
            quality: "auto",
            fetch_format: "auto",
          },
        ],

      }
    );

    if (!resultado.secure_url) {
      throw new Error(
        "Cloudinary no devolvió una URL segura."
      );
    }

    console.log(
      "Fotografía almacenada correctamente en Cloudinary."
    );

    return resultado.secure_url;

  } catch (error) {

    console.error(
      "Error subiendo fotografía:",
      error.message
    );

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(
      502,
      "No se pudo almacenar la fotografía. Intenta nuevamente."
    );

  }
}

// =============================================
// ELIMINAR FOTOGRAFÍA DE CLOUDINARY
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
      console.warn(
        "Cloudinary no confirmó la eliminación:",
        resultado.result
      );
    }

    return resultado;

  } catch (error) {

    console.error(
      "Error eliminando fotografía de Cloudinary:",
      error.message
    );

    throw new HttpError(
      502,
      "No se pudo eliminar la fotografía almacenada."
    );

  }
}
