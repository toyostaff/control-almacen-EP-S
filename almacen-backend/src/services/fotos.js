import { cloudinary, cloudinaryHabilitado } from '../config/cloudinary.js';
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

// Recibe data URI (el frontend actual usa FileReader.readAsDataURL).
export async function guardarFoto(dataUri, anterior = null) {
  if (!dataUri) return anterior;
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) {
    throw new HttpError(400, 'La fotografía debe ser una imagen válida.');
  }
  if (!cloudinaryHabilitado) {
    throw new HttpError(503, 'Cloudinary no está configurado todavía en el hosting.');
  }
  const resultado = await cloudinary.uploader.upload(dataUri, {
    folder: config.cloudinary.folder,
    resource_type: 'image',
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
  });
  if (anterior && anterior.includes('res.cloudinary.com')) {
    try {
      const partes = anterior.split('/upload/')[1]?.split('/') || [];
      const publicId = partes.slice(1).join('/').replace(/\.[^.]+$/, '');
      if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (e) { console.warn('No se pudo eliminar la foto anterior:', e.message); }
  }
  return resultado.secure_url;
}

export async function eliminarFoto(url) {
  if (!url || !cloudinaryHabilitado || !url.includes('res.cloudinary.com')) return;
  const afterUpload = url.split('/upload/')[1];
  if (!afterUpload) return;
  const publicId = afterUpload.split('/').slice(1).join('/').replace(/\.[^.]+$/, '');
  if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}
