# Backend — Sistema de Control de Almacén

API REST independiente construida con Node.js, Express y MySQL. Está preparada para conectarse posteriormente al frontend React existente, pero **este paquete no modifica ni integra el frontend**.

## Alcance incluido

- Catálogo Maestro: listar, crear, editar y activar/desactivar materiales.
- Inventario: listar, crear, editar, activar/desactivar y eliminar fotografía.
- Validación de códigos duplicados y de ocupación de ubicaciones/divisiones.
- Ubicaciones: catálogo de espacios, subdivisiones y ocupación.
- Historial de operaciones.
- Búsqueda por voz/texto en inventario.
- Inicio de sesión JWT y roles `admin` / `almacen`.
- Carga de fotografías a Cloudinary cuando se configuren sus credenciales.
- Script para crear el primer administrador.

## 1. Requisitos

- Node.js 20 o superior.
- MySQL 8.0 o superior.
- Una base de datos MySQL y un usuario con permisos sobre ella.

## 2. Instalar

```bash
npm install
```

## 3. Crear la estructura de base de datos

Importar `database/schema.sql` desde phpMyAdmin, MySQL Workbench o consola MySQL. El script crea `almacen_db`, sus tablas, las 24 ubicaciones y sus divisiones internas, además de los cinco materiales de ejemplo que aparecen en el `catalogoSeed.js` recibido.

Si el hosting entrega una base de datos con otro nombre, ejecutar el SQL en esa base o ajustar la primera línea `CREATE DATABASE` / `USE` antes de importarlo.

## 4. Variables que se configuran directamente en el hosting

Este paquete **no contiene archivo `.env`**, claves privadas ni credenciales. En el panel de variables de entorno del hosting se deben declarar cuando se despliegue:

| Variable | Uso |
|---|---|
| `PORT` | Puerto asignado por el hosting |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | Dominio del frontend; admite varios separados por coma |
| `DB_HOST` | Host MySQL entregado por el hosting |
| `DB_PORT` | Normalmente `3306` |
| `DB_NAME` | Nombre de la base de datos |
| `DB_USER` | Usuario MySQL |
| `DB_PASSWORD` | Contraseña MySQL |
| `JWT_SECRET` | Clave aleatoria larga y privada para firmar tokens |
| `JWT_EXPIRES_IN` | Vigencia del token; por defecto `8h` |
| `CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |
| `CLOUDINARY_FOLDER` | Carpeta destino; por defecto `control-almacen` |

No colocar estas claves en React ni publicarlas en Git. Las claves de MySQL, JWT y Cloudinary permanecen exclusivamente en el entorno del backend.

## 5. Crear el primer administrador

Después de configurar las variables del hosting y de importar el SQL:

```bash
node scripts/crear-admin.js "Administrador" admin@tuempresa.com "UNA-CONTRASEÑA-SEGURA"
```

El comando crea o actualiza el usuario administrador. No se incluye ningún usuario ni contraseña predeterminados.

## 6. Ejecutar

Desarrollo:

```bash
npm run dev
```

Producción:

```bash
npm start
```

Comprobar el estado:

```text
GET /api/health
```

## 7. Rutas de la API

Todas las rutas, excepto `/api/health` y `/api/auth/login`, requieren `Authorization: Bearer <token>`.

| Método | Ruta | Función |
|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/catalogo` | Listar materiales |
| POST | `/api/catalogo` | Crear material (admin) |
| PUT | `/api/catalogo/:id` | Editar material (admin) |
| PATCH | `/api/catalogo/:id/estado` | Cambiar estado (admin) |
| GET | `/api/inventario` | Listar registros |
| GET | `/api/inventario/:id` | Consultar registro |
| POST | `/api/inventario` | Crear registro |
| PUT | `/api/inventario/:id` | Editar registro |
| PATCH | `/api/inventario/:id/estado` | Activar/desactivar |
| DELETE | `/api/inventario/:id/foto` | Quitar foto |
| GET | `/api/ubicaciones` | Listar ubicaciones y subdivisiones |
| GET | `/api/ubicaciones/ocupacion` | Resumen de capacidad |
| GET | `/api/historial` | Consultar historial |
| DELETE | `/api/historial` | Limpiar historial (admin) |
| POST | `/api/voz/buscar` | Buscar repuesto por texto reconocido |

Las respuestas exitosas siguen el formato `{ "ok": true, "data": ... }`. Los errores usan `{ "ok": false, "mensaje": "..." }`.

## 8. Fotografías y Cloudinary

El endpoint de inventario acepta el campo `foto` como Data URI (`data:image/...;base64,...`), que es el formato que produce `FileReader.readAsDataURL` en el frontend recibido. Cuando las variables de Cloudinary estén definidas, la API sube la imagen y guarda la URL segura, no el base64, en MySQL. El frontend actual limita la fotografía a 2 MB.

Si Cloudinary no está configurado, las operaciones que intenten subir una fotografía responderán `503`. El resto de la API puede funcionar sin Cloudinary.

## 9. Importante: integración pendiente

El frontend se ha dejado intacto, tal como se solicitó. Sus servicios actuales usan `localStorage`; por eso **todavía no consultan esta API ni guardan datos en MySQL**. La conexión React–API es una etapa posterior y requiere modificar los servicios frontend, que no se han tocado en este trabajo.

El selector de perfiles del frontend actual es una simulación local. El backend ya dispone de JWT y roles, pero la autenticación real tampoco queda conectada hasta realizar esa integración.
